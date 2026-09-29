# r3c-bands-1: the Nauvoo band marches past, the handcart company, the gulls

*GUEST crew, round 3c (guests A). Branch `kolob-r3c-bands`. 2026-09-29.*

> **Round 2 (at the end of this note) amends the integration recipe:** the
> band's material leaves the doxology's hymn out until a doxology has been
> sung, a start-up line warms the company's throat, and ENGRAVE's staff
> patch is now a **required** block of the recipe. Apply the recipe as
> Round 2 gives it.

**What is new to hear:** three guests from outside the windows, each built as
a module the engine can seat, and a lab to hear them in. None plays in a
meeting yet: the integration step wires them in (the exact recipe is below,
and it has been tried on a throwaway copy of the engine). Nothing was pushed
or published, and VERSION is not bumped.

How much is new, honestly: **the band is the big one** — it replaces the
looping fife with a real march, and it is the guest you will meet most often
(about one Sunday in three, three Pioneer Days in four). The handcart company
is a new, rarer, gentler sound (about one meeting in twenty; one funeral in
five). The gulls are a ten-second joke (about one meeting in thirteen).

- **The Nauvoo Brass Band goes by** (replaces `twoBandsCross`). A saxhorn
  band comes up the road playing one of the day's own hymns turned into a
  quickstep — in its own key (a fifth or a fourth from the meeting's), at its
  own marching pace — in real strains: an introduction (the tune's head in
  octaves by the whole band; or four bars of oom-pah; or the drums' roll-off
  alone), the first strain twice, the second strain twice (half the time the
  first of them is the *bass strain*, the tune down in the tuba and alto horns
  while the cornets punch the after-beats), the trio in the subdominant,
  softly, with the alto horns holding the chords and the snare silent, then
  often the *grandioso* (the trio again, full, the drums rolling into it), and
  the stinger. Cornet on the tune (a second cornet a third or sixth under it
  on the repeats), alto horns on the after-beats, the tuba's oom-pah on the
  chord's root and fifth, the bass drum on the downbeat, the snare light. It
  is heard far off at one end of the colony, swells, passes the meetinghouse
  partway through the second strain, and goes on out of the other end — and
  the ward keeps singing: it crosses the verse. It plays its march through
  once and is gone. About one visit in ten (one Pioneer Day in four) a
  **second band** comes the other way with another of the day's hymns, in
  another key, at another pace — the two cross each other (Putnam's Camp).
- **The handcart company.** Far across the fields: first the carts (a dry
  axle creaking once a turn of the wheel — once a bar of the song — iron
  tires on gravel, a knock at a rut), then the captain strikes up and the
  company sings ALL IS WELL ("Come, Come, Ye Saints", the Earth tune in
  kolob-tunes.js) in unison as it walks — the men an octave under the women,
  a child a hair behind — one or two verses (Clayton's 1st, and his 4th:
  "And should we die before our journey's through… All is well!"), and on out
  of hearing while the wheels are still faintly heard. It never comes near.
  The house hushes to listen.
- **The gulls.** A flock crosses over the meetinghouse — harsh bright cries
  from one side of the sky to the other, eight to fourteen seconds. The
  loudest bird's held cries are the head of the day's first hymn, in its own
  rhythm, two octaves up; the others laugh around it. Sometimes a second bird
  answers the end of the phrase; sometimes the flock wheels round and one
  more bird calls the first notes again from far off. **The wave-1 note is
  fixed:** the whole head is moved by one octave shift (never a note folded
  on its own), so its shape survives — measured, every interval heard as the
  head has it.

Nobody has listened to any of this yet. Every check below was made with the
sound muted. The ear is still to come.

---

## How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8171 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3c-bands`
2. Open **http://127.0.0.1:8171/art/kolob/guests3a-lab.php**
3. Pick a **dialect** and a **seed**: the composer writes the day's first and
   second hymns (named under the controls). Then press **▶ the band goes
   by**, **▶ the company passes**, **▶ the gulls fly over** or **▶ the lead
   bird alone**.

The room menu starts at **as seated**: the tabernacle's wide send, which is
how the engine seats a guest from outside. While the band plays, the strip of
strains lights the one playing and a dot walks along the road from west to
east (brighter as it nears). A link can carry the settings:
`guests3a-lab.php?seed=2&dialect=tabernacle&which=0&second=1&still=1&meeting=1`.

### What to listen for

| lab settings | what it is | listen for |
|---|---|---|
| seed 2, Tabernacle, ▶ the band | NEW HANDCART as a march in 2/4 at 124 a minute, a fifth above the meeting | The whole band gives out the tune's head in octaves, then two bars on the dominant and a drum roll into the first strain. The first B is the **bass strain** (the tune low in the tuba and horns, the cornets on the after-beats); the cornets take it back the second time. The trio drops into the subdominant and goes soft; the grandioso comes back full. Nearest at 0:37; 62 s in all. |
| seed 2, Tabernacle, **the meeting carries on** ticked | the same, over the day's first hymn on a plain organ at its own tempo and key | The collision: two keys, two tempos, neither waiting for the other. (The lab's organ is a stand-in for the ward; in the meeting the ward and its organist sing on.) |
| seed 2, Tabernacle, **a second band** ticked | a second band (DAYBREAK) from the other side, in another key, at another pace | Putnam's Camp: two marches crossing. Each band is 2 dB quieter when there are two. |
| seed 2, Tabernacle, **standing in the street** ticked | the march with no road: the band stays put, near | The arrangement alone, for judging the parts. |
| seed 4, Tabernacle | LAMPLIGHT HILL (3/4) as a **6/8 quickstep** at 114 | The hymn's first beat held, the other two a lilting quarter and eighth; the drums' **roll-off** alone before the band comes in. |
| seed 6, Tabernacle | FAR BOUNTIFUL, 2/4 at 119 | The second strain **dotted** (long–short where the hymn ran in even halves), the snare's extra tap on the off-beats. |
| seed 2, the Old Way | MORNING STAR (3/2, a unison tune) as a 6/8 quickstep | A tune with no harmony, harmonized the bandmaster's way (here i and v, the chord moving at the bar, passing notes left over it). |
| seed 2, gospel | WASATCH: the verse is the first strain, **the refrain the second** | 102 s, one of the longest; the strains shorten when a march would pass 106 s (the grandioso goes first). |
| seed 3, ▶ the company | ALL IS WELL, two verses, the captain a tenor, a child | The carts first (about 9 s), the captain alone on "Come, come, ye Saints", everyone from "But with joy wend your way", nearest at about 0:39, "All is well! All is well!" twice. |
| seed 4, ▶ the company | the captain a bass | Set **hear** to *the carts alone* for the axles' creak once a bar, and *the singers alone* for the company. |
| seed 2, ▶ the gulls | 7 birds; a second bird answers; the flock wheels back | Then **▶ the lead bird alone**: NEW HANDCART's head, *do mi re mi sol la sol sol fa la*, two octaves up, in its rhythm. **check the trace** pitch-tracks it. |

## What shipped

| file | what |
|---|---|
| `kolob-guest-bands.js` (new) | `KOLOB.GuestBands`: the march (the arranger's desk: the hymn read as a barred tune, its chords tuned justly on their roots, the bandmaster's harmony for a tune with none; the march meter and the warp from hymn beats to march beats; the strains, the parts, the drums, the introduction, the stinger; the length cap), the road, the second band, the seat |
| `kolob-guest-handcart.js` (new) | `KOLOB.GuestHandcart`: ALL IS WELL for a walking company (Clayton's vowels, verse 1 and 4), the company's pitch, the road, the carts, the seat |
| `kolob-guest-gulls.js` (new) | `KOLOB.GuestGulls`: the head, one octave shift for all of it (fitted to the gulls' register), every cry as data, the seat |
| `kolob-voices-band.js` | `road()` (a traveller: the distance stage's curves laid along a path); `lendTown()` and a fuller `warm()` (a town room made ahead and lent, the noise and the saxhorns' waves built per context at start-up — so no convolver, noise buffer or wave is built in a clock callback); the waves are now kept per context, not per band |
| `kolob-voices-folk.js` (the gulls and the carts only) | `gull()` takes `up` and `fall`; `gulls()` takes a rhythm and keeps its chatter in the lead's span; `wheels()` takes `still`, `spread`, `dest` and `only` (a cart standing in a company that a road carries; one cart a call) |
| `guests3a-lab.php`, `guests3a-lab.js` (new) | the lab |
| `handoff/r3c-bands-1.md` | this note |

The three modules follow the trombones' and the handbells' interface:
`plan(meetingInfo, stream)` → a seat `{guest, seat, section, at, dur,
holdUntil, …, odds, logged}` or null; `decide()` (the plan, explained);
`prepare(material, stream)` (pure; the result is itself material);
`score(material, stream, t0)` (the whole performance as data, pure);
`perform(ctx, dest, t, material, stream, hooks)` → the end time, with
`hooks.defer(at, fn)`, `hooks.onNote(x)`, `hooks.onStage(st)`. Streams:
`guest:bands:<n>` (forks `seat`, `shape`, `synth` → `band:<k>`),
`guest:handcart:<n>` (`seat`, `shape`, `synth` → `carts`, `company`),
`guest:gulls:<n>` (`seat`, `shape`, `flock`, `synth`). Every die is thrown
before any refusal.

---

## How it was checked (all silent)

Muted headless Chrome over CDP (`--headless=new --mute-audio`, port 9491,
profile `kolob-r3c-bands-chrome`), the lab's own offline **check** (the app's
master chain; BS.1770 loudness; the organ reference is the v0.30 organChord,
rendered in the same room), Node for the pure parts, and the harness run on a
throwaway copy of the engine with the recipe applied.

| check | result |
|---|---|
| the lab at 860 and 390 px | 0 console errors after every play, the stop, every menu and box, each of the six dialects, compose another, a check, the odds and purity; no sideways scroll at either width (scroll width = viewport throughout) |
| purity | plan and score repeat exactly on the same stream for all three; 0 `Math.random` calls while planning and scoring |
| **the band's level** (loudest 3 s against the organ reference, as seated) | see the table after this one: −1.8 to +1.8 LU over nine marches (seven hymns in six dialects, two with a second band) |
| **the company's level** | −1.7 to +0.6 LU over eight Sundays (seeds 1–8; one or two verses) |
| **the gulls' level** | −1.0 to −1.9 LU over four flocks (Tabernacle, Sacred Harp, gospel, the Old Way) |
| clicks (bursts nothing scheduled, the guests lab's ruler) and clipping | 0 and 0 in every render (more than 30 marches, 25 companies, the carts alone, the singers alone, 4 flocks, 4 lead birds); at the final levels the peaks are ≤ −7.4 dBFS (band), ≤ −9.2 (company), ≤ −11 (gulls) |
| **the band crosses** (3 s of the render: first heard / nearest / going) | first heard 36–41 dB down on its own side (balance 1.8–5.4 dB toward it), nearest 22–27 dB down in the middle (within ±1.1 dB), going 30–42 dB down on the other side — in every march; the swell from first heard to nearest is 11–15 dB |
| **the company passes** | first heard about 38–40 dB down (the carts), nearest 22–26 dB down, going about 38 dB down; the carts alone sit 8 LU under the singing |
| **the gulls' trace** (the lead bird alone, dry, each held cry pitch-tracked) | every interval heard as the head has it: 7/7, 9/9, 7/7, 7/7 (worst 1.3 cents); in Node over 240 hymns in six dialects, 1,805 of 1,805 intervals exact |
| the band's forms (Node) | 240 hymns in six dialects, every march built, 0 errors; 72 of them checked note by note (every note 20 Hz–3 kHz, every time ≥ its start); 33–109 s, median 59 s; 2/4 and 6/8 each about half; all three introductions |
| the odds (a stand-in planner on the calendar, 20,000 meetings) | the band 33.0 % (ordinary 36.7, fast 17.2, conference 34.8, **Pioneer Day 75.0**, Christmas 16.2, Easter 24.3, wedding 20.4, funeral 6.0, dedication 33.8); a second band in 13 % of the bands. The handcarts 5.3 % (Pioneer Day 14.1 — the band takes three Pioneer Days in four, and the company never comes with it — funeral 18.5, Christmas 2.3). The gulls 7.6 % (Pioneer Day 20.5, wedding 10.5, funeral 0). Meetings with any guest: 72.3 % (67.8 % without the handcarts and the gulls; PLAN §13's starting point was about 55 %). **Rules broken: 0** (the band with the handcarts, the band with the trombones, the handcarts or the gulls in or beside another guest's section, the gulls at a funeral) |
| **the recipe in the engine** (the harness, 900 s, on a copy with the recipe applied) | 0 runtime errors in all eleven runs. The band forced: seeds 7, 12, 3 and 33 (33 with a second band) PASS — the band arrives in its hymn section, crosses the verse, holds the joint (0 turnovers during a guest), 535–1,107 notes on the band layer; seeds 20 and 41 fail one check only (the organist under the ward plays on — see Requests, 4). The handcarts forced (seed 7): PASS — seated in the testimony, 498 notes, the captain strikes up. The gulls forced (seed 7): seated in the prelude, 77 notes (the run's one failure is that meeting's band, as in seeds 20 and 41); seed 9 unforced: its 96.9 % pitch adherence is the same on the unpatched engine (that meeting's singing school and handbells: not this step's) |

The band's loudness, measured at the final level (`LEVEL` 0.43; a pair of
bands 0.85 of it each):

| seed, dialect | the march | loudest 3 s against the organ | integrated | peak | nearest: level, side |
|---|---|---|---|---|---|
| 1, Tabernacle | NAUVOO, 2/4 | −0.7 LU | −26.6 LUFS | −9.8 dBFS | −25.5 dB, −0.2 |
| 2, Tabernacle | NEW HANDCART, 2/4 | +1.8 | −26.0 | −7.4 | −22.4, −0.1 |
| 3, Sacred Harp | EVENING, 6/8 | +0.5 | −26.4 | −8.6 | −23.8, +0.3 |
| 4, gospel | EMIGRATION, 6/8 (a refrain) | −1.8 | −27.6 | −9.3 | −26.3, −1.0 |
| 5, the Old Way | NAUVOO CROSSING, 6/8 | −1.1 | −25.5 | −8.7 | −25.4, +0.8 |
| 6, Shaker | EMIGRATION CROSS, 6/8 | −1.2 | −26.4 | −10.1 | −25.6, +0.8 |
| 7, psalmody | OLD COTTONWOOD (2/2), 6/8 | +0.7 | −25.7 | −7.7 | −24.5, −0.3 |
| 2, Tabernacle, two bands | NEW HANDCART and DAYBREAK | +0.8 | −26.1 | −7.5 | −23.4 / −25.8 |
| 4, gospel, two bands | two marches | −1.6 | −27.2 | −10.0 | −27.1 / −25.7 |

The meeting's own organ now plays about 2.3 dB under this reference (the
owner lowered it), so a band at its nearest sits about level with the organ
as it is heard today, and well under it far off. The trombones, turned down
4 dB by the owner, end about 2 LU under the reference; the band's crossing is
louder than the trombones at its nearest and much quieter for most of its
length. If it is too much, the one number is `KOLOB.GuestBands.LEVEL`.


---

## The integration recipe (exact, and tried)

This is the text of a script that was applied to a copy of this branch's
engine and run through the harness (the results are in the checks above).
Apply it in the round-3c integration step; nothing here edits a file this
crew owns.

**What it does, in words.**

- **Load order** (`_engine.php`): `kolob-guest-bands.js`,
  `kolob-guest-handcart.js`, `kolob-guest-gulls.js` after
  `kolob-guest-singingschool.js`, before `kolob-guests.js`. (The voices they
  play — band, folk, vocal — are already loaded.) Until this is done the
  harness fails its module-list check on this branch ("on disk but not in
  _engine.php"): expected.
- **The band replaces `twoBandsCross`** (the looping fife) in `VISIT_FN`, and
  its seat replaces the old band's seat in `planMeeting`, in the same place
  (planned first among the guests, so the trombones still see it and refuse).
  `bDie` and `bSeatDie` are still thrown, unused, so every later die of the
  meeting falls where it did. `GuestBands.plan` keeps the owner's 36 % and the
  calendar's `guests.bands` welcome exactly (its `ODDS.weight` mirrors
  `kolob-calendar.js`; if the calendar's numbers change, change both), and the
  old seats (the doxology seven times in ten, else a hymn; a band asked for by
  name in a hymn). `bandsLeaveTheDoxology()` and the payoff rule are
  unchanged: they move a band's `section`, and its `at` still applies.
- **The band is cued** (`cued: true`, `at` seconds into its section): it
  strikes up while the ward sings and **crosses the verse** — the hymn gives
  it no gap (a cued guest is not a `waitingGuest`). The joint waits for it
  (its span, `guest-start … guest-end`). This is the one change of behaviour
  a listener will notice besides the march: the old band came in the gap
  between two verses while the hymn waited; now the collision is with the
  ward's own hymn, as PLAN §8.2 asks ("the meeting carries on regardless").
- **The house lets go** as the band enters (as for every guest: the owner's
  rule before v0.34). The ward and the organist under the hymn sing on — the
  organist's hands are not the house's (see Requests, 4).
- **The handcarts and the gulls** are planned last of all the guests (after
  the handbells), so each sees every seat taken; each is cued. The company's
  passage is exact at plan time (ALL IS WELL needs no composer) and its
  section is held for it (`holdUntil`); the gulls' length is an estimate until
  their cue (8–14 s; their section is held for 16 + 2 s).
- **A handcart company asked for by name** (`force: "handcart"`) keeps the
  band away, as the trombones asked for do. `FORCEABLE` gains `handcart` and
  `gulls`.
- **The material** is made at each guest's cue (`outsideMaterial`): the
  band's march from the day's hymns (the plan's `pick` among the hymns
  written so far — leaving out the one its own section sings when there is
  another, and preferring hymns already back from the composer's desk; a
  second band takes the next), in its own key against the key sounding now
  (the section's hymn's `keyMonzo`); the company's ALL IS WELL on the day's
  keynote; the gulls' head of the day's first hymn. Pure; 0.3–0.8 ms warm (a
  march), measured in the page.
- **The house listens** to the company (`LISTENED.handcart`: the melodic
  voices find the air taken; the drone and the valley stay). The band and the
  gulls take no air.
- **The rooms:** all three are outside the windows — `wideSend()`, as the
  trombones and the old band. The town's air they share is `VoicesBand`'s,
  lent (below, Cost).

**The recipe, block by block** (each find text occurs exactly once):

**`_engine.php`** — find:

```js
'kolob-guest-handbells.js', 'kolob-guest-singingschool.js', 'kolob-guests.js',
```

replace with:

```js
'kolob-guest-handbells.js', 'kolob-guest-singingschool.js',
    // (round 3c: the Nauvoo band, reworked; the handcart company; the gulls)
    'kolob-guest-bands.js', 'kolob-guest-handcart.js', 'kolob-guest-gulls.js', 'kolob-guests.js',
```

**`kolob-guests.js`** — find:

```js
  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
```

replace with:

```js
  // ==========================================================================
  // THE GUESTS FROM OUTSIDE THE WINDOWS (round 3c; PLAN-COMPOSITION §8.2,
  // §8.10, §8.11; handoff r3c-bands-1): the NAUVOO BRASS BAND marching past
  // with one of the day's hymns as a march (it replaces twoBandsCross, the
  // looping fife), the HANDCART COMPANY singing ALL IS WELL far across the
  // fields, and the GULLS quoting the first hymn. Each plans and plays
  // itself (kolob-guest-bands.js, kolob-guest-handcart.js,
  // kolob-guest-gulls.js: pure plans, their own streams guest:<type>:<n>);
  // the meeting seats and cues them with their material; this is the glue:
  // their sound laid out a bar, a line or a few seconds at a time on the
  // guests' lane (hooks.defer), their notes reported as they are laid out,
  // their moments told when they come. They are OUTSIDE: into the
  // tabernacle's wide send, as every visitor from the town is.
  // ==========================================================================
  function outdoorGuest(V, tc, G, rows, noteOf, claim) {
    V.meetingNum = S.Meeting.meetingNum();
    if (!G || !V || !V.material || !V.stream) return 4;
    var end = G.perform(S.ctx, wideSend(), tc, V.material, V.stream, {
      defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
      onNote: noteOf,
      onStage: function (st) {
        if (st.dev || !rows[st.stage]) return;
        var ev = { type: "guest", guest: V.type, stage: st.stage, side: st.side || null, section: S.Meeting.section(),
                   cat: "visitation", label: st.label, detail: st.detail || "" };
        if (st.band != null) ev.band = st.band;
        if (st.t0 <= S.now() + 1e-6) tell(V, ev);
        else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
      },
    });
    // (the company is listened to: the melodic voices find the air taken;
    // the band and the gulls take no air — the meeting carries on)
    if (claim) claimAir(end - tc, 3);
    return end - tc + 1;
  }
  function nauvooBand(V, tc) {
    return outdoorGuest(V, tc, KOLOB.GuestBands, { approaches: 1, second: 1, cross: 1, passes: 1 }, function (x) {
      // (beat: the march's beat in seconds, as the page has always read a
      // band's note; beatInBar and bar, and downbeat on each bar's oom)
      emitNote("band", x.freq, x.t, x.dur, guestNote(V, "bands", { part: x.part, beat: x.beatS, bar: x.bar, beatInBar: x.beat, downbeat: x.downbeat,
        doubling: x.doubling, band: x.band, strain: x.strain, meter: x.meter, loud: x.loud, hymnId: V.material.hymnId || null }));
    }, false);
  }
  function handcartCompany(V, tc) {
    return outdoorGuest(V, tc, KOLOB.GuestHandcart, { approaches: 1, sings: 1, passes: 1 }, function (x) {
      emitNote("handcart", x.freq, x.t, x.dur, guestNote(V, "handcart", { part: x.part, voice: x.voice, verse: x.verse, line: x.line, beat: x.beat, syl: x.syl, octave: x.octave, loud: x.loud, hymnId: "earth:all-is-well" }));
    }, true);
  }
  function gullsOver(V, tc) {
    return outdoorGuest(V, tc, KOLOB.GuestGulls, { gulls: 1 }, function (x) {
      emitNote("gulls", x.freq, x.t, x.dur, guestNote(V, "gulls", { part: x.part, index: x.index, deg: x.deg, monzo: x.monzo, loud: x.loud, hymnId: V.material.hymnId || null }));
    }, false);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
```

**`kolob-guests.js`** — find:

```js
  S.singingSchool = singingSchool;
```

replace with:

```js
  S.singingSchool = singingSchool;
  S.nauvooBand = nauvooBand;
  S.handcartCompany = handcartCompany;
  S.gullsOver = gullsOver;
```

**`kolob-guests.js`** — find:

```js
    handbellsRing: handbellsRing, singingSchool: singingSchool,
```

replace with:

```js
    handbellsRing: handbellsRing, singingSchool: singingSchool, nauvooBand: nauvooBand, handcartCompany: handcartCompany, gullsOver: gullsOver,
```

**`kolob-meeting.js`** — find:

```js
  function singingSchool(V, t) { return S.singingSchool(V, t); }
```

replace with:

```js
  function singingSchool(V, t) { return S.singingSchool(V, t); }
  function nauvooBand(V, t) { return S.nauvooBand(V, t); }
  function handcartCompany(V, t) { return S.handcartCompany(V, t); }
  function gullsOver(V, t) { return S.gullsOver(V, t); }
```

**`kolob-meeting.js`** — find:

```js
    var FORCEABLE = { bands: true, steeples: true, oldtune: true, trombones: true, handbells: true, singingschool: true };
```

replace with:

```js
    var FORCEABLE = { bands: true, steeples: true, oldtune: true, trombones: true, handbells: true, singingschool: true, handcart: true, gulls: true };
```

**`kolob-meeting.js`** — find:

```js
    if ((forcedType === "bands" || bDie) && !dawnAsked) {
      var bSeat = forcedType === "bands"
        ? seatIn(["hymn", "doxology", "postlude"])
        : (bSeatDie ? seatIn(["doxology", "hymn", "postlude"]) : seatIn(["hymn", "postlude", "doxology"]));
      if (bSeat) C.visitations.push({ type: "bands", section: bSeat, fired: false });
    }
```

replace with:

```js
    // THE NAUVOO BRASS BAND (round 3c; PLAN §8.2): kolob-guest-bands.js
    // decides, on guest:bands:<n> — the owner's 36 % and the Sunday's welcome,
    // the section (the doxology seven times in ten, else a hymn), the moment,
    // which of the day's hymns it marches, and whether a second band comes.
    // It keeps its own time (cued): it strikes up while the ward sings and
    // crosses the verse — the hymn gives it no gap; the collision is the
    // piece. (bDie and bSeatDie above are still thrown, unused.)
    // (a handcart company asked for by name keeps the band away, as the
    // trombones asked for do: one procession a Sunday)
    var GBg = KOLOB.GuestBands || null;
    if (GBg && !dawnAsked && forcedType !== "handcart") {
      var bStream = stream("guest:bands");
      var bSeat = GBg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, force: forcedType === "bands" }, bStream);
      if (bSeat) C.visitations.push({ type: "bands", section: bSeat.section, at: bSeat.at, dur: bSeat.dur, fired: false, cued: true, stream: bStream, pick: bSeat.pick, second: bSeat.second });
    }
```

**`kolob-meeting.js`** — find:

```js
    // THE HOSANNA (PLAN §8.12: Easter and a dedication only; audio-only,
```

replace with:

```js
    // THE HANDCART COMPANY and THE GULLS (round 3c; PLAN §8.11, §8.10):
    // planned last, so each sees every guest already seated (never with the
    // band, the handcarts; never in or beside another guest's section, both;
    // never at a funeral, the gulls). Both keep their own time (cued); the
    // company's passage is exact at plan time (ALL IS WELL needs no composer),
    // and its section is held for it.
    var GHc = KOLOB.GuestHandcart || null, GGu = KOLOB.GuestGulls || null;
    function holdSection(type, until) {
      for (var hs = 0; hs < plan.length; hs++) if (plan[hs].type === type) { plan[hs].dur = Math.max(plan[hs].dur, until); break; }
    }
    if (GHc) {
      var hcStream = stream("guest:handcart");
      var hcSeat = GHc.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, force: forcedType === "handcart" }, hcStream);
      if (hcSeat) { C.visitations.push({ type: "handcart", section: hcSeat.section, at: hcSeat.at, dur: hcSeat.dur, fired: false, cued: true, stream: hcStream }); holdSection(hcSeat.section, hcSeat.holdUntil); }
    }
    if (GGu) {
      var gStream = stream("guest:gulls");
      var gSeat = GGu.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, force: forcedType === "gulls" }, gStream);
      if (gSeat) { C.visitations.push({ type: "gulls", section: gSeat.section, at: gSeat.at, dur: gSeat.dur, fired: false, cued: true, stream: gStream }); holdSection(gSeat.section, gSeat.holdUntil); }
    }
    // THE HOSANNA (PLAN §8.12: Easter and a dedication only; audio-only,
```

**`kolob-meeting.js`** — find:

```js
                   handbells: handbellsRing, singingschool: singingSchool };
```

replace with:

```js
                   handbells: handbellsRing, singingschool: singingSchool, handcart: handcartCompany, gulls: gullsOver };
  // (the band that marches replaces the band that looped, when its room is loaded)
  if (KOLOB.GuestBands) VISIT_FN.bands = nauvooBand;
```

**`kolob-meeting.js`** — find:

```js
  var LISTENED = { trombones: true, handbells: true, singingschool: true };
```

replace with:

```js
  var LISTENED = { trombones: true, handbells: true, singingschool: true, handcart: true };
```

**`kolob-meeting.js`** — find:

```js
    if ((V.type === "handbells" || V.type === "singingschool") && !V.material) standingMaterial(V);
```

replace with:

```js
    if ((V.type === "handbells" || V.type === "singingschool") && !V.material) standingMaterial(V);
    if ((V.type === "bands" || V.type === "handcart" || V.type === "gulls") && !V.material) outsideMaterial(V);
```

**`kolob-meeting.js`** — find:

```js
  // THE DAWN PLAYS THE FIRST HYMN (round 3): the trombones take up the
```

replace with:

```js
  // THE GUESTS OUTSIDE: THEIR MATERIAL (round 3c) — made ready at their cue
  // (pure, a millisecond or two): the band's march from one of the day's
  // hymns (its plan's pick among the hymns written so far, the one its own
  // section sings left out when there is another; a second band the next),
  // in its own key against the key sounding now; the company's ALL IS WELL
  // on the day's keynote; the gulls' head of the day's first hymn. A hymn not
  // yet back from the composer's desk is not asked for when another is.
  function outsideMaterial(V) {
    var HY = Hymnal(), keynote = S.F0 * S.ROOT_MULT;
    function ready(r) { return HY && (!HY.ready || HY.ready(r.id)); }
    try {
      if (V.type === "handcart") { V.material = { homeHz: keynote }; return; }
      var rows = (C.hymnal || []).filter(function (r) { return r.piece !== "round"; });
      if (V.type === "gulls") {
        var first = rows[0] && HY ? HY.get(rows[0].id) : null;
        V.material = KOLOB.GuestGulls.prepare({ hymn: first, keynoteHz: keynote }, V.stream);
        return;
      }
      var own = C.hymn ? C.hymn.id : null, others = rows.filter(function (r) { return r.id !== own; });
      var pool = (others.length ? others : rows).filter(ready);
      if (!pool.length) pool = others.length ? others : rows;
      if (!pool.length || !HY) { V.material = null; return; }
      var i = Math.min(pool.length - 1, Math.floor((V.pick || 0) * pool.length));
      var h = HY.get(pool[i].id), h2 = V.second && pool.length > 1 ? HY.get(pool[(i + 1) % pool.length].id) : null;
      var here = own ? HY.get(own) : null;
      var home = keynote * (here && here.keyMonzo ? KOLOB.Pitch.ratio(here.keyMonzo) : 1);
      V.material = KOLOB.GuestBands.prepare({ hymn: h, homeHz: home, second: h2 ? { hymn: h2 } : null }, V.stream);
    } catch (e) { V.material = null; if (window.console) console.warn("Kolob: the " + V.type + " could not be made ready:", e); }
  }
  // THE DAWN PLAYS THE FIRST HYMN (round 3): the trombones take up the
```

**The staff (`kolob-viz.js`, ENGRAVE's; a request, not yet tried).** The band's
notes now come a bar at a time, with more parts than the fife's two. Today's
`takeBand` would make each bar a "visit" of its own (and keep only three), put
a barline on every tuba note (the oom *and* the pah), and print the after-beats
and the doublings as tune. The smallest patch that keeps its look — the tune in
round heads, the oom under it, a barline every bar:

```js
  function takeBand(ns) {
    ns.sort(function (a, b) { return a.startTime - b.startTime; });
    // (round 3c: the tune and the tuba are written; the after-beats, the
    // second cornet and the doublings are heard, not printed — and a march
    // laid out a bar at a time is one visit, per band, while it plays)
    ns = ns.filter(function (n) { return n.part !== "alto" && n.part !== "cornet2" && !n.doubling; });
    if (!ns.length) return;
    var beat = ns[0].beat || 0.46;
    var r = clamp(1.1 / beat, 1.6, 2.6);
    var bd = null;
    for (var vi = visits.length - 1; vi >= 0 && !bd; vi--) if (visits[vi].band === (ns[0].band || 0) && ns[0].startTime - visits[vi].tp1 < 4) bd = visits[vi];
    if (!bd) { bd = { tp0: ns[0].startTime, beat: beat, r: r, tp1: 0, bass: [], band: ns[0].band || 0 }; visits.push(bd); if (visits.length > 4) visits.shift(); }
    ns.forEach(function (n) {
      var mel = n.part !== "bass", q = bandQ(n.freq);
      if (mel) { q -= 7; while (q > 26) q -= 7; while (q < 11) q += 7; }
      else { while (q > 9) q -= 7; while (q < -2) q += 7; }
      var v = valueOf(n.duration / beat, "band");
      var nb = { tp: n.startTime, dur: n.duration, q: q, loud: n.loud == null ? 0.6 : n.loud, mel: mel, v: v, bd: bd };
      if (!mel && n.downbeat !== false) bd.bass.push({ tp: nb.tp });   // its barlines fall on each bar's oom
      bd.tp1 = Math.max(bd.tp1, n.startTime + n.duration);
      bandNotes.push(nb);
    });
  }
```

(`n.downbeat` is on every tuba note the band sends; the old band's notes,
which have none, keep their barline on every oom.) Two bands at once are two
visits, one each.

**SCORE.md, to adopt.**

- **Modules:** `kolob-guest-bands.js`, `kolob-guest-handcart.js`,
  `kolob-guest-gulls.js` beside the other guests (`_engine.php`).
  `KOLOB.VoicesBand` adds `road(ctx, dest, {room, echoDelay})` and
  `lendTown(ctx, dest, {seconds})`; `warm(ctx)` now also makes a town room to
  lend, the noise and the saxhorns' waves.
- **Streams:** `guest:bands:<n>` (forks `seat`, `shape`, `synth` →
  `band:<k>`), `guest:handcart:<n>` (`seat`, `shape`, `synth` → `carts`,
  `company` → `women-1` … `leader`, `child`), `guest:gulls:<n>` (`seat`,
  `shape`, `flock`, `synth`). The old band's `guest:bands:<n>` draws (the
  fife's tempo, key, side) are gone with it.
- **Layers:** `band` — `part` (`melody` | `cornet2` | `alto` | `bass`), `beat`
  (the march's beat in seconds, as the page has always read it), `bar`,
  `beatInBar`, `downbeat`, `doubling`, `band` (0, or 1 for a second band),
  `strain` (`intro` `A` `A2` `B` `B2` `trio` `grandioso` `stinger`), `meter`,
  `loud`, `hymnId`. New `handcart` — `part: "tune"`, `voice` (`women` `men`
  `leader` `child`), `verse`, `line`, `beat`, `syl`, `octave` (−1 for the men
  and the captain), `loud`, `hymnId: "earth:all-is-well"`. New `gulls` —
  `part` (`lead` `echo` `wheel` `chatter`), `index` (the head's note), `deg`,
  `monzo`, `loud`, `hymnId`. All guest-tagged (`guest`, `logged`). None of the
  three layers is in the harness's `PITCHED` (the band is in its own key; the
  company in a key of its own choosing; the gulls' cries scoop and fall).
- **`guest` event stages:** `bands` — `approaches` (label "⇋ a band
  approaches", `side`), `second` ("⇋ a second band approaches"), `cross`
  ("⇋ the bands cross", once a band), `passes` ("⇋ passes on"), each with
  `band`; `handcart` — `approaches`, `sings` ("♪ all is well"), `passes`
  (`gone` is told only in the span's end); `gulls` — `gulls` ("∿ gulls"; the
  `head` stage is dev-only and not told). The harness counts band starts and
  ends by "approaches" and "passes" in the label: both bands say both.
- **Forcing:** `handcart` and `gulls` join `FORCEABLE`.


---

## The cost, measured (not cut)

The owner's ruling stands: build as though there were no phone; measure and
report. Nothing was cut to a budget.

**The main thread** (measured in the page: a live context in muted Chrome,
the lab's clock laying each guest out as the engine's will, `hooks.defer`):

| guest | at the press (the cue) | then | largest callback |
|---|---|---|---|
| the band (two bands, seed 2) | 4.4 ms (2.4–4.5 over repeated presses) | 106 callbacks, one a bar (a second band built in a callback of its own) | **0.8 ms** (mean 0.48) |
| the handcart company | 1.0–1.5 ms | about 92: one a throat's line, one a cart's roll | 0.5 ms median, 1.2 ms the largest when the voice is warm (timed line by line); in the lab page, the first line any throat sings costs 5.8–7.6 ms (compiling the voice — in a meeting the ward has been singing since the prelude), and in two of three live runs one callback took 6.4–11.3 ms (a garbage collection landing in it: the same line timed alone is under 1.2 ms) |
| the gulls | 2.4 ms | 3 (a few seconds of cries each) | 1.7 ms |

What it took to get there: the first press cost 13–17 ms. A convolver takes
its impulse when it is made (5.4 ms for the 2.6 s town), the band's noise
buffer (3.6 ms) and its periodic waves (about 4 ms) were built on first use
per context, and two bars were laid at the press. Now `VoicesBand.warm(ctx)`
— which the engine already calls at start-up — builds one town room to lend,
the noise and the saxhorns' waves (33–42 ms, once per context, at start-up),
the waves are kept per context, the march is laid out a bar at a time with
only the first at the press, a second band is built in its own callback, and
each cart rolls from its own. The march's material is made at the cue in
0.3–0.8 ms (warm).

**The audio thread** (offline render time per second of sound, in muted
Chrome on a loaded machine — load average about 4.4 — so the absolute numbers
overstate a live audio thread; the ratios are the thing):

| what | ms of render per second of sound | against the organ reference |
|---|---|---|
| the organ reference (the v0.30 organChord) | 7.9–8.3 | 1× |
| the trombones at dawn (already in the meeting, for scale) | 69.5 | ×8.6 |
| **one band** | 120–138 (its players about 100, the town's air about 27) | ×16 |
| two bands | 267 | ×33 |
| **the handcart company** | about 240 (the six throats about 170, the carts about 40, the air about 27) | ×29 |
| the gulls | 12.9–13.2 | ×1.6 |

So a band passing costs about twice what the trombones at dawn cost, while
it plays (one to two minutes); the company about three and a half times. The
r3b round measured a whole meeting at 16–20 % of the audio thread at the
median with the live tools; these guests should be measured the same way once
they are in the meeting (tools/capture, `KolobAudio.clockHealth()`).

**Nodes** (created per passage; alive at the peak): one band 1,500–5,700
made, 72–82 alive (+11 its road, +4 the lent town, shared); two bands up to
5,700 made, 154–160 alive. The company 355–434 alive at the peak (its singers
312–386 of them, the VoicesVocal budget's count). The gulls 41–57 alive.

**Levers, if the owner wants them later** (none applied): the saxhorns'
cornet and tuba buses run a WaveShaper with 2× oversampling (their "grain");
the company could sing in fewer pews (two, the women and the men); the
trombones could borrow the town room too (Requests, 5).

---

## Requests

1. **To the integrator: the recipe above**, in the round-3c integration
   step. `twoBandsCross` in kolob-guests.js is then unused (the recipe
   seats no band at all if `KOLOB.GuestBands` is missing); retire it, or keep
   it for an A/B.
2. **To ENGRAVE: the staff patch above** (`takeBand`). The two new layers,
   `handcart` and `gulls`, are not engraved today; whether the page should
   show the company's tune (far off, small) or the lead gull's quotation (the
   joke made visible) is ENGRAVE's call. Every note carries what it needs
   (the head's `index`, `deg` and `monzo` on the gulls'; `verse`, `line`,
   `beat`, `syl` on the company's).
3. **To the integrator: SCORE.md**, the adoptions above.
4. **To the integrator (and the harness): "the house lets go" when a guest
   crosses a hymn.** The band is the first guest to arrive mid-verse. The
   house does let go (the engine logs "the house lets go bands · organ"), but
   the organist's own case under the ward's hymn plays on — which is right:
   the ward and its organ are the meeting that carries on (PLAN §8.2). The
   harness's graph check counts every organ-layer source as the house's, so
   when the organist's case has a long-lived source (its wind) born before the
   entrance, it reports "a source … goes round the hands that let go" (seeds
   20 and 41, and 7 with the gulls forced, where that meeting's band entered
   the same way; the organ notes sounding there are the organist's, `h:1:1`,
   under verses 0 and 1). Suggested: the check leaves out sources that reach
   only the organist's hymn hands (or the hands registered by a performance
   whose hymn owns the section). The alternative — the band waiting for the
   gap between verses, as the old band did — would stall the hymn for a
   minute or more and lose the collision.
5. **To the GUEST crew's trombones (one line, their file):** they make a
   town room at their cue (5.4 ms of convolver in one callback). With
   `var town = VB.lendTown ? VB.lendTown(ctx, bus, { seconds: 2.6 }) :
   VB.townRoom(ctx, bus, { seconds: 2.6 });` their press loses it; their
   existing `town.dispose()` gives it back.
6. **To the integrator: `VoicesBand.warm(ctx)`** is already called at
   start-up (kolob-core.js); it now takes 33–42 ms there (it was the
   impulse alone). Keep it at start-up, never in a cue.

## Known issues

- **Nobody has listened.** The questions for the ear: does the saxhorn band
  sound like a brass band, at its nearest and far off (its voice is wave 1's,
  unchanged but for the per-context waves); is the march recognisably the
  hymn (a 3/4 hymn's 6/8 lilt especially); is the collision with the ward
  delightful or merely busy; is the trio's softness (the whole band 4 dB down, and
  playing piano) and the drums' lightness right; does the company read as people walking far off;
  do the gulls read as gulls, and is the quotation findable.
- **The band's arrangement is plain.** Tune, second cornet, three alto horns
  on the after-beats, the tuba's oom-pah, two drums. No euphonium
  countermelody in the trio, no breakstrain, no dynamic hairpins inside a
  strain. The harmony is the composer's where the hymn has one (with its
  sevenths and secondary dominants, tuned justly on each root); a unison
  tune gets I, IV, V (vi, ii) or, in a minor mode, i, iv, v, VII, III — the
  mode's own v, no raised leading tone.
- **The march re-bars the hymn.** Fermatas are not held; where a line of the
  hymn starts on a different beat than the last one ended, the band holds
  the last note over to keep each line's own accent. A hymn in 4/4 marches
  beat for beat, so its long notes stay long (the oom-pah keeps the step).
- **A head wider than the gulls' register overhangs it.** The one shift is
  fitted to 600–1500 Hz, but a head spanning more than about 1.3 octaves
  cannot fit; over 240 hymns the lead bird cries between 446 Hz and 1.9 kHz.
  No note is ever folded.
- **The company sings vowels.** Clayton's words as their vowels (verse 1,
  and 4 for a second verse); it is too far off for words. Its singers are the
  ward's voice in four pews and two singers, not the Sunday's cast. Its key is
  chosen by pitch (the tune's middle near A-flat, 415 Hz) among the day's
  key, its dominant's and its subdominant's.
- **Guests at 72 % of meetings** (the stand-in planner; 68 % without these
  two). PLAN §13's starting point was about 55 %. The numbers to turn are
  `GuestHandcart.ODDS.base` (0.07) and `GuestGulls.ODDS.base` (0.08); the
  band's are the owner's (0.36).
- **The odds are a stand-in's.** The real planner's other guests are
  approximated (the singing school, the handbells); the harness should
  re-count once the engine seats these three.
- **This branch fails the harness's module-list check** until the recipe's
  first step ("kolob-guest-bands.js is on disk but not in _engine.php", and
  the other two). Expected; the integrator adds them.
- **The render cost is real** (the table above): while it plays, a band
  costs about twice the trombones at dawn and the company about three and a
  half times. Measured, not cut.
- **The lab's first press of a page** pays the voices' compile once (the
  company's first line 5.8–7.6 ms); a collection pause can land in any
  callback (6–11 ms, twice in three live runs of the company).

## The honest listening note

What is genuinely new to hear, by size:

1. **The band** — the biggest. A march in strains instead of a fife on a
   loop, from a hymn the ward sings that day, crossing the ward's own verse.
   It is also the commonest guest (a third of Sundays), so it is the one to
   listen to first: seed 2 Tabernacle, then the same with *the meeting
   carries on* ticked, then *a second band*.
2. **The handcart company** — new, gentle, rare (one meeting in twenty; one
   Pioneer Day in seven; one funeral in five). Seed 3.
3. **The gulls** — ten seconds, whimsical; the quotation is the point, and
   it is best heard with *▶ the lead bird alone* first, then the flock.

Nothing else changes: the three voices they use (band, folk, vocal) sound
as before, except that the lab's own flock (`gulls()`) keeps its chatter in
the lead's span.

---

## Round 2 — the critic's findings, answered

*Same branch, `kolob-r3c-bands`, 2026-09-29. VERSION not bumped; nothing
pushed or published. Every check was made with the sound muted.*

**What is new to hear (small, and honest about it).** Everything round 1
promised still sounds as it did; round 2 changes the edges:

- **The band leaves on its drums.** After the stinger the drums alone play
  a street beat (four-bar phrases, 16–21 s) while the road carries the band
  round the last houses and out of hearing. It no longer stops dead in
  earshot. The meeting still waits only for the stinger.
- **The band and the company come from one side.** Far off, a band is now
  7–10 dB toward its end of the colony and the company 5–8 dB (in round 1,
  2–5 and 0–3). The town's air leans toward the traveller instead of
  standing all around it.
- **The company's last verse goes over the rise.** Its song ends 5–14 dB
  under its nearest point (in round 1 it ended about level with it), and
  its wheels fade out after it.
- **The alto horns' after-beats no longer rub against the tune.** A chord
  tone within a semitone of the tune's note is left out of that pah (the
  tune's passing fa against the horns' mi). Few listeners will notice this.
- **The minutes** say "⇋ the band goes by" for a lone band. They say "⇋ the
  bands cross · two times at once" only when a second band is nearest while
  the first still plays.

Everything else is the same: the march, the company's singing and the gulls.
The rest of round 2 is plumbing the ear won't hear. It fixes the cost of
the company's and the second band's callbacks, stops the band from giving
away the doxology's tune, and makes the staff patch part of the recipe.

### The findings, one by one

| # | the critic found | done | evidence |
|---|---|---|---|
| 1 | the company breaks 5 ms in a prelude seat: (a) a cold first line, (b) three throats in one clock wake | (b) each throat of a line is laid `STAGGER` 0.06 s after the last, so each gets a wake of its own. (a) `GuestHandcart.warm(ctx)` runs at start-up (a new **required** recipe block): it sings one silent line **with a breath in it** and bakes the carts' noise (`VoicesFolk.warm`, new). Then each throat sings one silent note in a callback of its own, a second after the press, before the company strikes up. The prelude seat stays. The round-1 claim that "the ward has already been singing" was false for a prelude seat and is withdrawn | live in the engine, below: the company's worst callback is **3.6–4.2 ms**, and no wake over 5 ms holds a company callback. The critic's wakes were 5.1–11.2 ms; after the stagger alone the worst callback was still 5.1–16.1 ms (the inhale, below) |
| 2 | the second band is built at the press | `if (hooks.defer && (i > 0 \|\| bd.k > 0))`, as the critic wrote. Every callback of a passage (both bands' bars and the second band's building) now takes a moment none of its others has (`slot()`, at least 0.05 s apart) | the press wake for two bands (their material, then `perform`) is 3.8 ms in the engine, and `perform` alone 2.2 ms. The band's callbacks are at most 3.1 ms |
| 3 | the recipe gives away the withheld tune | the recipe's `outsideMaterial` leaves out every doxology row until a doxology section has been sung (any section of `C.plan` before `C.si`). This is the critic's "better still": it keeps both the withheld Sunday and the doxology's payoff | harness, recipe copy, band forced: seeds 12, 20 and 7 on withheld Sundays march **h:1:2** (the critic saw h:1:3 for 12 and 20); seed 12 not withheld marches h:1:2 (it marched h:1:3 in round 1's own run) |
| 4 | the staff patch is required | it is now block D of the recipe (kolob-viz.js, ENGRAVE's file), applied with the rest | the critic's two screenshots (without and with the patch) are the verification; I did not re-shoot them |
| 5 | meetings of 3–4 guests | `MAX_GUESTS = 2`: the company and the gulls are never seated as a third guest unless asked for by name | census below: 3-guest meetings at 2.0 % either way, 0 with 4 |
| 6 | "the bands cross" for a lone band | fixed (above) | seed 4's minutes in the lab at 390 px: "⇋ the band goes by · its own key, its own time" |
| 7 | the march stops dead in earshot; the company ends its song at about −28 dB | the band's street beat, with the road going on and the band's gain falling 30 dB (`AWAY_DB`) past the last houses. The company goes over the rise: up to 14 dB more past its nearest point (`RISE_DB`, deepening with the square of the way gone) | below: the drums' last 3 s at −73 to −78 dB; the company's last line 5–14 dB under its nearest |
| 8 | the dead ternary | gone. The captain, bass or tenor, sings in the men's octave. ALL IS WELL spans 131–330 Hz there, and an octave lower its foot would sit near 65 Hz. A bass captain is told by his darker throat, not by his octave (said in the code) | — |
| 9 | after-beat semitone clashes | `offTheTune()` reads the whole march at once, so it also catches the next strain's pickup in this strain's last bar and the first strain's pickup under the introduction's vamp. A pah's chord tone within 60–150 cents of a tune note sounding with it, in any octave, is dropped. A held trio chord is checked only at its onset | 120 marches in six dialects: **636 → 0** such chord tones (my count is per chord tone; the critic counted differently, 1.7 % of tune onsets). `prepare` costs 0.1–0.2 ms more |
| 10 | listening questions | (1) the band crossing the doxology's verse: kept for the owner's ear, with the lever below. (2) the level: kept (the dial is `GuestBands.LEVEL`). (3) the subtle lean: fixed. The road's town-air send now leans toward the traveller (`AIR_LEAN` 0.5), and gives back the coherent gain the panner adds, so it moves the air without making it louder | first heard 8.3–9.8 dB toward its side for a lone band, 7.3 for a second band (round 1: 1.8–5.4); a lone band going, 8.0–9.2 dB toward the other; levels unchanged (seed 2 +1.8 LU as in round 1, seed 1 −0.7) |

Also: each band's notes now carry **their own** `hymnId`. In round 1 a second
band's notes were tagged with the first band's hymn. The recipe's glue line
changes with it (block A).

### The cost on the main thread, measured again (live, in the engine)

**How.** A throwaway copy of this branch with the amended recipe applied,
served on its own port, in muted headless Chrome. The page's
`setInterval(…, 25)` was wrapped, so every wake of the engine's clock is
timed whole: every callback due in it, the guest's and the meeting's. Each
guest's `perform` and its deferred callbacks are timed too, so a slow wake
can be traced to whoever caused it. **Chrome must be started with timer
throttling off** (`--disable-background-timer-throttling
--disable-renderer-backgrounding --disable-backgrounding-occluded-windows
--disable-features=IntensiveWakeUpThrottling`). Without those flags a
long-lived headless page's 25 ms interval was stretched past two seconds
(40 wakes took more than two minutes), and cues bunch into wakes the real
page never has.

| what | round 1 (the critic's runs) | round 2, final |
|---|---|---|
| **the company**, seed 2, forced, seated in the prelude (before any hymn) | 6 and 5 wakes over 5 ms (5.1–11.2 ms); steady wakes 3.1–4.8 ms (three lines to a wake) | press 1.8–2.3 ms; 54 callbacks, one to a wake; the company's worst callback **4.2** and **3.6** ms in two runs; the 99th percentile of all wakes in the passage 1.9–2.0 ms; **no wake over 5 ms holds a company callback** |
| the other wakes over 5 ms in the company's window | — | two, both the meeting's own. One is the prelude's first chord of the day at 24.1 s (11–16.5 ms, 2.3 s before the company's press): **15.5 ms with no guest at all**. The other is the house's first chord after the company leaves (8.3–9.8 ms), where the house's ordinary chords stay under 3 ms. See Request 7 |
| **two bands**, seed 33, forced, jumped to the hymn | the press 3.8–5.8 ms; `VoicesBand.create` twice at the press | the press wake (both marches' material, then `perform`) **3.8 ms**; `perform` alone 2.2 ms (`lendTown` 0.1, `road` 0.2, `create` 0.3); 68 callbacks, the largest 3.1 ms |
| the ward in that hymn window | — | **15 wakes over 5 ms with no guest at all** (up to 13 ms), at the ward's verse lines; 14 with the two bands there. The band adds none of its own over 5 ms |

How the company got there, run by run (all seed 2, prelude), since each
step found something:

1. Stagger and a warm line with no breath: the worst callback was 5.1, 9.4,
   15.4 and 16.1 ms in four runs, **every time the second line's first
   desk**. It allocated 1.87 MB where a throat's line allocates 0.1–0.6: the
   first line that breathes bakes the voice's inhale noise (five filter
   stages over two seconds of noise). The first cart's roll baked the folk
   voice's noise the same way (+1.86 MB).
2. With the inhale and the carts' noise warmed, the worst was 4.9–6.3 ms:
   the first line's four desks, each singing for the first time. Primed, a
   desk's first line costs 0.5–1.0 ms (0.8–2.2 cold).
3. With every throat primed: 3.6–4.2 ms, the figures in the table.

**The lab** now lays its guests out on `PJ2.Clock` itself (25 ms, 0.25 s
look-ahead, each wake timed whole). The critic was right that round 1's lab,
with a timer for each callback, hid the batching. One caution: on an idle
lab page the same callbacks run 2–5× slower than they do back to back (the
company's, paced a few seconds apart on an offline context: 4–8 ms; run
back to back: 0.3–2.9 ms). A mostly idle page seems to run on a slower
core. **Read the engine's numbers, not the lab's live ones.**

**The press, broken down (lab, back to back, warm):** a march's `prepare`
0.4–1.0 ms (two bands 0.7–1.0), `score` 0.1–0.4 ms. Warm in Node, `prepare`
for two bands is 2.2 ms (median; 3.9 at most). `lendTown` is 0.1 ms when the
pooled town room is free and 5.6–6.1 ms when it is out and a new one must be
built. In a meeting that happens only if two borrowers overlap, and the
band and the company never do.

**The audio thread and nodes** changed little. The road is 12 nodes (was
11: the air's panner). The company adds one silent gain and six one-note
priming lines into it; nothing is connected, so the audio thread never
visits them. The band's nodes live 16–21 s longer while its drums play
(drums only).

### The guest census (the real planner, the harness)

400 first meetings (seeds 1–400, 2 s each, the `guests-drawn` event), on
this branch as it stands and on the recipe copy with the two-guest rule:

| | 0 guests | 1 | 2 | 3 | 4 | with a guest |
|---|---|---|---|---|---|---|
| unpatched (the critic: 103 / 212 / 77 / 8) | 105 | 208 | 79 | 8 | 0 | 73.8 % |
| the recipe, round 1 (the critic's count) | 87 | 201 | 93 | 18 | 1 | 78.3 % |
| **the recipe, round 2** | 90 | 196 | 106 | **8** | **0** | 77.5 % |

The eight three-guest meetings that remain are the older planner's own (a
band with the singing school and the handbells, and the like). None has the
company or the gulls, and they are there unpatched too. Over the 400: the
band 132 times, the handcart company 16, the gulls 20.

### The integration recipe, amended (exact)

Apply round 1's recipe (above) with these four changes. All of them were
applied, with the rest, to the throwaway copy the checks above ran on. Each
find text occurs exactly once.

**A. `kolob-guests.js`, round 1's glue (`nauvooBand`'s `onNote`)**: each
band's notes carry their own hymn. In the glue block round 1 inserts, find:

```js
meter: x.meter, loud: x.loud, hymnId: V.material.hymnId || null }));
```

replace with:

```js
meter: x.meter, loud: x.loud, hymnId: x.hymnId || V.material.hymnId || null }));
```

**B. `kolob-meeting.js`, round 1's `outsideMaterial`**: the band never
marches the doxology's hymn before a doxology has been sung (critic 3). In
the function round 1 inserts, find:

```js
      var own = C.hymn ? C.hymn.id : null, others = rows.filter(function (r) { return r.id !== own; });
      var pool = (others.length ? others : rows).filter(ready);
      if (!pool.length) pool = others.length ? others : rows;
```

replace with:

```js
      // (the band never marches the doxology's hymn before a doxology has
      // been sung: on a withheld Sunday it is the day's tune assembled at
      // last — even a stranger's quickstep must not give it away — and on
      // any Sunday the theme's coming home is the doxology's to make)
      var sungDox = false;
      for (var di = 0; di < C.si && di < C.plan.length; di++) if (C.plan[di].type === "doxology") sungDox = true;
      var marchable = rows.filter(function (r) { return sungDox || r.section !== "doxology"; });
      var own = C.hymn ? C.hymn.id : null, others = marchable.filter(function (r) { return r.id !== own; });
      var pool = (others.length ? others : marchable).filter(ready);
      if (!pool.length) pool = others.length ? others : marchable;
```

**C. `kolob-core.js` (new; REQUIRED):** the company's throat and the carts'
noise are warmed at start-up, beside the town's air. Without this block a
company passing in the prelude pays a cold first line and a cold first
breath inside one wake of the clock, and the prelude seat must then be
dropped (`GuestHandcart.SEATS`, remove `["prelude", 1]`). Find:

```js
      try { KOLOB.VoicesBand.warm(ctx); } catch (e) { if (window.console) console.warn("Kolob: the town's air could not be built:", e); }
    }
```

replace with:

```js
      try { KOLOB.VoicesBand.warm(ctx); } catch (e) { if (window.console) console.warn("Kolob: the town's air could not be built:", e); }
    }
    // (the handcart company's throat, sung once and silently, now: the first
    // line a voice sings bakes its breath and compiles it — 5–7 ms — which
    // must not land in the clock's wake of a company passing in the prelude)
    if (KOLOB.GuestHandcart && KOLOB.GuestHandcart.warm) {
      try { KOLOB.GuestHandcart.warm(ctx); } catch (e) { if (window.console) console.warn("Kolob: the company's throat could not be warmed:", e); }
    }
```

**D. `kolob-viz.js`, ENGRAVE's file (REQUIRED with the band; critic 4):**
`takeBand`, as round 1's Request 2 gave it, now applied by the recipe.
Find today's function:

```js
  function takeBand(ns) {
    ns.sort(function (a, b) { return a.startTime - b.startTime; });
    var beat = ns[0].beat || 0.46;
    var r = clamp(1.1 / beat, 1.6, 2.6);
    var bd = { tp0: ns[0].startTime, beat: beat, r: r, tp1: ns[ns.length - 1].startTime + ns[ns.length - 1].duration, bass: [] };
    ns.forEach(function (n) {
      var mel = n.part !== "bass", q = bandQ(n.freq);
      if (mel) { q -= 7; while (q > 26) q -= 7; while (q < 11) q += 7; }   // the fife is written an octave under its sound
      else { while (q > 9) q -= 7; while (q < -2) q += 7; }
      var v = valueOf(n.duration / beat, "band");
      var nb = { tp: n.startTime, dur: n.duration, q: q, loud: n.loud == null ? 0.6 : n.loud, mel: mel, v: v, bd: bd };
      if (!mel) bd.bass.push({ tp: nb.tp });              // its barlines fall on the oom
      bandNotes.push(nb);
    });
    visits.push(bd);
    if (visits.length > 3) visits.shift();
  }
```

replace with:

```js
  function takeBand(ns) {
    ns.sort(function (a, b) { return a.startTime - b.startTime; });
    // (round 3c: the tune and the tuba are written; the after-beats, the
    // second cornet and the doublings are heard, not printed — and a march
    // laid out a bar at a time is one visit, per band, while it plays)
    ns = ns.filter(function (n) { return n.part !== "alto" && n.part !== "cornet2" && !n.doubling; });
    if (!ns.length) return;
    var beat = ns[0].beat || 0.46;
    var r = clamp(1.1 / beat, 1.6, 2.6);
    var bd = null;
    for (var vi = visits.length - 1; vi >= 0 && !bd; vi--) if (visits[vi].band === (ns[0].band || 0) && ns[0].startTime - visits[vi].tp1 < 4) bd = visits[vi];
    if (!bd) { bd = { tp0: ns[0].startTime, beat: beat, r: r, tp1: 0, bass: [], band: ns[0].band || 0 }; visits.push(bd); if (visits.length > 4) visits.shift(); }
    ns.forEach(function (n) {
      var mel = n.part !== "bass", q = bandQ(n.freq);
      if (mel) { q -= 7; while (q > 26) q -= 7; while (q < 11) q += 7; }
      else { while (q > 9) q -= 7; while (q < -2) q += 7; }
      var v = valueOf(n.duration / beat, "band");
      var nb = { tp: n.startTime, dur: n.duration, q: q, loud: n.loud == null ? 0.6 : n.loud, mel: mel, v: v, bd: bd };
      if (!mel && n.downbeat !== false) bd.bass.push({ tp: nb.tp });   // its barlines fall on each bar's oom
      bd.tp1 = Math.max(bd.tp1, n.startTime + n.duration);
      bandNotes.push(nb);
    });
  }
```

**The lever for the doxology (critic 10, question 1).** Seven times in ten
the band is seated in the doxology and crosses its verse, at about the
level of the organ, where the reckoning's recognition lands. If the owner
would rather the doxology were left alone, set `GuestBands.SEATS.usual =
["hymn", "postlude", "doxology"]` (the plan's odds are unchanged; only the
seat moves). If he would rather keep the doxology seat but have the band
arrive after the verse's recognition, raise `GuestBands.AT.doxology` (for
example `[0.5, 0.75]`; the band is far off for its first twenty seconds or
so either way).

### SCORE.md, to adopt (amending round 1's list)

- **`guest` stages, the band:** `cross` is labelled "⇋ the band goes by"
  ("its own key, its own time"), or "⇋ the second band goes by". It reads
  "⇋ the bands cross" ("two times at once") only when a second band is
  nearest while the first still plays. Neither label says "approaches" or
  "passes", so the harness's count of starts and ends is unchanged.
- **The band's layer:** each note's `hymnId` is its own band's. The street
  beat after the stinger is drums only (no notes; `strain: "cadence"` in the
  score). The score gains `gone` and `cadence {t0, t1}` per band and `gone`
  overall. `end` is still the stinger's, and it is what `perform` returns and
  the meeting waits for.
- **New surface:** `GuestHandcart.warm(ctx)` (start-up only),
  `GuestHandcart.MAX_GUESTS` and `GuestGulls.MAX_GUESTS` (2), `GuestBands.AT`
  (exported, for the lever), `VoicesFolk.warm(ctx)` (the folk voice's noise).
  `VoicesBand.road` is 12 nodes, and its town air leans toward the
  traveller (`AIR_LEAN` 0.5, inside the voice).
- **Streams:** unchanged labels. The company's `synth` draws now include its
  priming notes, so its throats' small dice differ from round 1's; `plan`
  and `score` are unchanged by it.

### How round 2 was checked (all silent)

| check | result |
|---|---|
| purity (Node) | `plan` and `score` repeat exactly for all three guests, 40 seeds each (a Pioneer Day in five), two bands; **0** `Math.random` calls; the lab's own purity check agrees |
| the band's forms (Node) | 240 hymns in six dialects: 0 errors; every note 20 Hz–3 kHz and inside its march; every drum inside `[start, gone]`; the street beat always after the stinger, 16.3–20.7 s (median 18.2); the road drawn to the end of the drums |
| the band's level (the lab's offline check, as seated) | seed 2 +1.8 LU (as round 1), seed 1 −0.7, seed 4 −0.2, seed 6 +0.6, seed 2 with a second band +0.8: every one within ±2 LU of the organ reference |
| the band's going | 3 s before the stinger: −28.8 to −38.7 dB; the drums' last 3 s: **−73 to −78 dB** |
| the lean, first heard | a lone band 8.3–9.8 dB toward its side, a second band 7.3 (round 1: 1.8–5.4); the company 5.5 and 8.3 dB (seeds 4 and 3; round 1: 0.2–3.3) |
| the company's level and going | +0.2, −1.7 and +0.2 LU (seeds 3, 1, 4); first heard about −41 dB; nearest −26.5 to −31.5; **its last line −35.4 to −40.4** (5–14 dB under its nearest; round 1 ended about level with it, −28.8 on seed 3); the wheels' last 3 s about −54 |
| clicks and clipping | 0 and 0 in every render of round 2 (10 bands, 6 companies) |
| the after-beats against the tune (Node) | 636 → 0 chord tones within a semitone of a sounding tune note, 120 marches |
| the lab at 860 and 390 px | 0 console errors after every play (a band with a second, the company, the flock, the lead bird), the stop, every menu and box, the odds and purity; no sideways scroll at either width (scroll width = viewport) |
| the harness, recipe copy (900 s unless noted) | the band forced, withheld: seeds 12 and 7 PASS; seed 20 fails one check only, the organist's wind round the hands that let go (round 1's Request 4, unchanged). Seed 12 not withheld: PASS. Two bands, seed 33: PASS. The company forced: seed 2 (the prelude, 600 s) PASS, seed 7 (the testimony) PASS. The gulls forced, seed 7 (600 s): only that meeting's band fails the same organist check, as in round 1. **0 runtime errors** in all nine runs. None marches the doxology's hymn before the doxology |

### Requests (new; round 1's 1–6 stand, and its 2 is now recipe block D)

7. **To the integrator (and whoever keeps the 5 ms bound meeting-wide):**
   in these measurements the slow wakes near a guest were the meeting's own.
   The prelude's first chord of the day takes 15.5 ms in one wake with no
   guest at all. The house's first chord after a guest leaves takes
   8.3–9.8 ms (its ordinary chords stay under 3). The ward's verse lines in
   a hymn produced 15 wakes over 5 ms in 78 s, up to 13 ms, with no guest at
   all. All of these were on this machine, muted. Nothing in the guests
   causes them. They are reported here because anyone timing a guest's
   window will see them.
8. **To CAST:** `VoicesVocal.warm(ctx)` would be the natural home for what
   `GuestHandcart.warm` does: bake the breath's noise and the inhale, and
   compile the voice once. When it exists, the company's warm should call
   it. The ward would gain the same way: its first breathing line bakes the
   inhale today, inside the meeting.

### Known issues (round 2)

- **Nobody has listened.** The new questions for the ear: is the street
  beat right (a band on parade between marches, 16–21 s, fading past the
  last houses), or should the band simply stop; is the company's rise too
  steep (`RISE_DB` −14) or not steep enough; does the lean read as "from one
  end of the colony".
- **The 5 ms bound** is met by the guests' own callbacks in the runs above
  (3.1 ms for the band, 4.2 for the company, at their worst). It is not met
  by every wake in their windows: those belong to the meeting (Request 7),
  and a garbage collection can land in any callback. Headroom is thin: the
  company's live callbacks varied from 2.2 to 6.8 ms before the
  priming (its first line's desks), run to run, on the same seed.
- **The band's drums outlast the march** by 16–21 s. The meeting does not
  wait for them. If a band is seated late in its section, its drums fade
  under the next section's first seconds. That is by design (the meeting
  carries on). If the owner prefers the meeting to wait, `perform` would
  return `sc.gone` instead of `sc.end`.
- **The withheld-tune rule lives in the recipe** (the meeting's
  `outsideMaterial`), not in the module: a march is given a hymn and cannot
  know which section's it is.
- **The lab's live cost display overstates** on an idle page (above). Its
  offline **check** is unaffected.

### How to hear round 2

Serve the worktree and open the lab as round 1 says
(`http://127.0.0.1:8171/art/kolob/guests3a-lab.php`). None of this plays in
a meeting until the integration step applies the recipe.

| lab settings | listen for |
|---|---|
| seed 2, Tabernacle, **▶ the band goes by**, heard to the end (about 80 s) | after the stinger, the drums alone go on (bass drum on every step, the snare's taps and a roll) and fade round the last houses. There is no dead stop. With headphones: the first drum and cornet come from one side, and the drums leave by the other |
| the same, **a second band** ticked | the minutes say "the bands cross" once, when the second band is nearest while the first plays. Each band leaves on its own drums |
| seed 3, **▶ the company passes**, its last verse | "All is well! All is well!" is already going over the rise: quieter and further off than at the middle of the song, and the wheels after it into nothing |
| seed 1, Shaker, ▶ the band | DAYBREAK was the critic's worst for after-beat clashes (42). The horns now leave out the chord tone that would rub against the tune's passing note. This is subtle |

### The honest listening note (round 2)

What is new to hear, by size. Every item is an edge, not a new sound:

1. **The band's exit on its drums.** Every band has it, so it is the most
   often heard. Listen for whether the street beat reads as a band on
   parade walking on, or as a drum solo nobody asked for; 16–21 s is a
   starting point (`CAD_S`).
2. **The lean.** Every band and every company has it, far off. It is a
   modest image, not a hard pan: 5–10 dB toward one end at first hearing.
3. **The company's last verse over the rise.** One company in twenty
   meetings will carry it.
4. **The after-beats' courtesy.** Probably inaudible to most listeners, and
   that is the aim.

Nothing else changed: the march, its strains and its level, the company's
singing and the gulls. The cost work (the stagger, the warm, the priming,
the second band's building) is inaudible by design.

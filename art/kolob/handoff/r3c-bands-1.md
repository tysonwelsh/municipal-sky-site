# r3c-bands-1: the Nauvoo band marches past, the handcart company, the gulls

*GUEST crew, round 3c (guests A). Branch `kolob-r3c-bands`. 2026-09-29.*

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

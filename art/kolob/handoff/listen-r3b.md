# Listening packet: round 3b

*For the owner. Round 3b built the meeting out "as though there were no
technical constraints", as you asked: the whole ward, the organist, every
style and guest, and now the shape of a visit. Nothing has been published,
and VERSION is unchanged. This page says what is new to hear, how big each
thing is, where to hear it, and what it costs, so you can decide what to
scale back.*

## How to listen

The local server is running. Open a seed and press PLAY:

> http://127.0.0.1:8141/art/kolob/index.php?seed=17

- Change the number after `seed=` for another Sunday.
- The times below (mm:ss) are the page's own clock, shown beside each line of
  the clerk's minutes. They count from when you press PLAY. They were read
  from the test harness, and the browser keeps them: seed 17 in the browser
  read the drone's first turn at 1:16 and the invocation at 1:24, as the
  harness did.
- **The programme card now names the Sunday** (in Deseret, where it used to
  say ORDINARY, FAST DAY, CONFERENCE or JUBILEE). `&latin=1` shows it in
  English. The minutes' meeting row names it too: ☀ MEETING 1 · (the Sunday).
- **Every seed plays a different meeting than it did before this round.** The
  calendar changed the dice once, on purpose. From now on a seed plays the
  same meeting every time.

## What round 3b changed, by size

Honestly, from biggest to smallest.

1. **The ward sings the hymns. (The biggest change.)** Every hymn is now
   sung by thirty-two singers, each with a voice of their own, not by four
   synth voices. People come forward one or two at a time, and the minutes
   name them (✦): a child on the tune, a visitor who joins late, the old
   bass, the harmony alto, the enthusiast, the soloist's descant. The
   chorister gives the note before an unaccompanied hymn. Before a Sacred
   Harp tune, the sections "pitch" it: a chord of thirty-two voices builds
   up. The Old Way is lined out by the precentor, a man of the ward.
2. **An organist plays the hymns. (Big.)** Each Sunday seats one of three
   organists: a plain one, a Victorian or an improviser. The organist plays
   the pipe organ: gives out the tune, plays under every verse on the
   chorister's tempo, plays interludes and the amen, walks into a new key,
   and now and then plays a fill between two lines. On about one Sunday in
   five, the morning is the organist's prelude on the day's first hymn.
3. **A Sunday of the colony year. (Medium. You will notice it across visits
   more than within one.)** Each visit draws one of nine Sundays:
   - an ordinary Sunday (45 %);
   - a fast Sunday (15 %): testimony-heavy and sparse, the Sacred Harp and
     the Old Way, the plain organist;
   - General Conference (12 %): three hymns, the Tabernacle, the Victorian
     organist, the full organ;
   - Pioneer Day (8 %): the gospel ring and the brass bands;
   - Christmas (6 %): the handbells and the steeples, shape-note and Shaker
     songs, the Primary;
   - Easter (6 %): the brightest light, the Tabernacle in full, the
     trombones;
   - a wedding (4 %): gentle, the soloist, the organ voluntary, the handbells;
   - a funeral (3 %): slow and dark at dawn, then rising into a Tabernacle
     doxology; no raspberry, no round, no refrain;
   - a dedication (1 %): the Tabernacle all day, the full organ.

   The Sunday decides the house style, how many hymns there are, which
   guests are likely, how the morning wakes, which organist plays, and how
   many of the ward you come to know.
4. **The rites between the hymns are seated. (Medium.)** The invocation, the
   testimony, the sacrament, an interlude and the postlude each draw how the
   house sits for them:
   - lined out only: the deacon's clarinet gives lines and the ward answers;
   - the brush arbor: no organ, the strings on bare fifths;
   - an organ voluntary: the organ leads;
   - the choir alone: the ward hums a few chords;
   - or the house as it always was.

   Two plain rites never come in a row. The minutes name each one with a
   ⌖ row (for example ⌖ INVOCATION · LINED OUT ONLY).
5. **Every style, and new forms. (Medium, occasional.)** All six styles are
   sung in the meeting: the Tabernacle, the Sacred Harp, New England
   psalmody (the fuging tunes), gospel, the Shaker and Primary songs, and the
   Old Way. On top of those come:
   - a round (about one meeting in five);
   - the wandering refrain: a short tune the enthusiast starts after the
     first hymn, which comes back later and in the doxology (about one
     meeting in four);
   - the partner hymn: the closing hymn written on the first hymn's chords,
     with the first hymn played against it (heard in about one meeting in
     eight);
   - gospel's standing quartet;
   - the Primary's children.
6. **Two new guests. (Occasional.)** The ward's handbell choir (about one
   meeting in eight) and the singing school: you arrive while the choir is
   still practising (about one Sunday in ten; experimental,
   `&exp=-singingSchool` turns it off).
7. **The arc of light. (Small to medium, and gradual.)** A meeting now rises
   from dawn to full daylight:
   - The prelude and the invocation are plainer. The house organ is on its
     flutes, and the early hymns lean toward the Sacred Harp, the Old Way and
     the Shakers.
   - The hymns grow fuller one after another.
   - The sacrament is the stillest point.
   - The doxology is full light. It leans hard toward the Tabernacle (about
     six doxologies in ten) and the gospel ring, and the organ reaches for
     the full organ.
   - The postlude is evening.

   The old jump in loudness and busyness at every joint is gone: each rite
   now fades in from where the last one ended. (Measured: the biggest
   one-second step fell from 0.35 to 0.12 on the engine's 0–1 scale.)
8. **The Kolob reckoning. (Small and subtle. It is for the attentive
   listener.)**
   - On about seven Sundays in ten, the drone no longer sits on one note all
     meeting. At each joint it glides, over four to six seconds and under the
     joint's quiet, to a new note, one note per rite.
   - Those notes are the opening of the tune the doxology will sing. In the
     doxology the drone is home again, and the ward sings that tune at
     normal speed.
   - Each drone note is the tonic, third or fifth of the key its rite is
     sung in. The house's own chords lean toward the drone's note, and under
     a hymn whose tonic it is not, the drone steps back.
   - On the other Sundays (about three in ten) no tune fits the day's keys.
     The drone then stays on the keynote all meeting, as before.
   - The minutes print one row: ∿ THE DRONE'S TUNE, as the doxology begins.
   - `&exp=-reckoning` turns it off for an A/B.
9. **Small things.**
   - A verse given to the men or to the women, now and then (the chorister
     says so in the minutes).
   - A refrain that comes back is sung out a little more each time.
   - The Hosanna has a hook for Easter and a dedication. It is not built
     yet and makes no sound.

**Not there yet:** words (the ward sings on vowels and on "fa sol la mi");
the testimony-bearers are seated but do not speak; the Hosanna, the Social
Hall, the far ward and the other guests in the plan's section 8 are not built.

## Ten Sundays to hear

1. **Seed 17 — General Conference, and the reckoning at its clearest.**
   http://127.0.0.1:8141/art/kolob/index.php?seed=17
   - 0:05 the trombones at dawn; 0:19 the near choir answers.
   - The drone moves: it starts on the keynote (do), then turns to mi at
     1:16, sol at 2:40, la at 5:28, do (an octave up) at 8:12, la again at
     13:04 (the sacrament), and home at 15:22. Each glide takes about five
     seconds, under the joint.
   - 15:28 the doxology (№311, Tabernacle): its tune begins do–mi–sol–la–do–
     do–la, the notes the drone has spelled. At 16:43 the organist draws
     the full organ.
   - Also: gospel's quartet at 2:56; a round at 8:42 (the trebles first); at
     10:51 the testimony, where the ward hums (⌖ THE CHOIR ALONE).
2. **Seed 236 — a funeral: slow, then rising.**
   - The prelude is the darkest dawn of any Sunday (the old tune remembered
     at 0:14).
   - The drone turns at 1:12, 3:17, 8:30 and 11:07. The hymns are plain:
     the Sacred Harp on the notes at 3:26, psalmody at 6:00.
   - 13:38 the doxology rises into the Tabernacle. This Sunday withheld its
     tune, and the whole tune arrives at last (13:50). It is the tune whose
     strong notes the drone has been spelling since dawn: do, sol, mi, mi,
     do, sol.
3. **Seed 7 — a wedding.**
   - 1:28 the invocation is lined out.
   - 2:48 a Tabernacle hymn, with a Victorian at the organ: the principal,
     then the vox humana over the flutes. The soloist's descant comes at 4:41.
   - 8:24 the ward hums the testimony.
   - 13:25 the doxology is a partner hymn. At 14:16 the organist sets the
     first hymn on the trumpet against it, on the full organ.
4. **Seed 9 — Christmas.**
   - 0:08 the singing school.
   - 3:13 a gospel hymn; at 4:07 the enthusiast starts the refrain.
   - 5:45 the men sing the first verse of the next hymn alone. The refrain
     comes back at 7:42.
   - 8:37 a round across the pews.
   - 11:02 the handbells in the sacrament, with the cascade at 11:56.
   - 14:29 the refrain a third time, in the doxology.
5. **Seed 37 — Easter.**
   - 0:20 and 0:38 the trombones; 1:49 the invocation lined out.
   - 3:20 the women sing a verse; 4:24 the refrain.
   - 5:49 a round (the trebles first); 8:45 gospel's quartet.
   - 16:14 the doxology: the men's verse at 16:26, the full organ at 17:05,
     and the refrain at 17:38.
6. **Seed 5 — a fast Sunday.**
   - A humming morning. At 3:14 a Sacred Harp hymn, on the notes.
   - 6:08 the testimony lined out: the deacon gives lines and the ward
     answers.
   - A long sacrament, then at 10:53 a Shaker doxology in unison. Sparse
     throughout.
7. **Seed 11 — Pioneer Day.**
   - 2:45 a Shaker song keyed down a fourth; 5:05 gospel.
   - 8:11 the quartet stands.
   - 11:00 the testimony in the brush arbor: the strings on bare fifths, no
     organ.
   - 15:06 a Tabernacle doxology in which the withheld tune arrives; at
     15:29 the full organ.
   - A second doxology follows (the reprise), at 16:59.
8. **Seed 20 — an ordinary Sunday with the Primary.**
   - 0:58 an organ voluntary for the invocation.
   - 2:46 the Tabernacle hymn; at 3:47 the soloist's treble verse.
   - 5:59 the chorister leads the Primary, and the ward's children sing the
     Primary song at the front, in unison.
   - 8:38 the testimony in the brush arbor; 13:21 the doxology and the full
     organ.
9. **Seed 181 — a dedication (one Sunday in a hundred).**
   - The Tabernacle all day, with a Victorian at the organ.
   - The descant with the full organ at 5:11, the treble verse at 10:43.
   - The ward hums through the sacrament (15:48).
   - At 18:32 the men sing the first verse of the doxology, and the full
     organ comes on the last.
10. **Seed 3 — an ordinary Sacred Harp Sunday.**
    - 0:05 the plain organist's chorale prelude on the first hymn, twice
      through, on soft flutes.
    - 1:23 the invocation lined out.
    - The drone spells do (1:14), mi (2:25), fa (4:58), mi (7:44), do
      (10:27). The doxology (12:49, on the notes first) begins do–mi–fa–mi–do.

**A/B switches** (add to the address):

| switch | what it does |
|---|---|
| `&exp=-reckoning` | the same Sunday with the drone on the keynote all meeting |
| `&choir=house` | round 3's four voices instead of the ward |
| `&organ=house` | the old organ instead of the pipe organ and the organist |
| `&exp=-singingSchool` | no singing school |
| `&latin=1` | the page in English |

## What it costs (measured on this Mac, not cut)

The whole first meeting of seed 17 was traced in muted Chrome, next to the
build from before round 3b (v0.35) playing the same seed at the same time
(the same machine load, about 4):

| seed 17, the whole first meeting (19 minutes) | round 3b (this build) | before round 3b (v0.35) |
|---|---|---|
| the audio thread's share of each second: typical · busy (p90) · worst | 20 % · 32 % · 38 % | 15 % · 21 % · 28 % |
| Chrome's own "render capacity": typical · worst second | 20 % · 67 % | 14 % · 51 % |
| one audio callback (5.3 ms of sound each): typical · worst | 1.05 ms · 5.14 ms | 0.76 ms · 3.72 ms |
| audio nodes alive at once, at the most | 2,863 | 455 |
| cues late, lines of the ward late | 0 · 0 | 0 · — |

The two builds played different meetings for seed 17, because this round
changed the dice. Both are a conference with the trombones at dawn.

By rite, this build (Chrome's render capacity, typical · worst second):

| rite | render capacity | nodes, at the most |
|---|---|---|
| the prelude, with the trombones | 21 % · 52 % | 409 |
| the invocation | 20 % · 38 % | 232 |
| hymn 1, gospel's quartet | 23 % · 66 % | 1,899 |
| hymn 2, the Sacred Harp by the whole ward | **27 % · 67 %** | 2,616 |
| hymn 3, a round | 22 % · 49 % | 2,863 |
| the testimony, the ward humming | 17 % · 62 % | 795 |
| the sacrament | 13 % · 36 % | 477 |
| the doxology, the full organ | **29 %** · 49 % | 2,669 |
| the postlude | 15 % · 48 % | 750 |

What to read from it:

- **Over a whole meeting, round 3b costs about 1.4 times the audio work of
  the build before it** (1.5 times in the busy seconds).
- **The ward is the weight.** Thirty-two voices with a throat each take
  about twice the audio work of the four old voices in a hymn (step 1's
  measurement). The hymns hold 1,900–2,900 audio nodes, against 230–800 in
  the rites around them. The organist, the guests, the calendar and the
  reckoning are small beside it.
- **This step (the Sunday, the light, the seatings, the reckoning) adds
  almost nothing on the audio thread.** The drone's glide moves the
  frequencies of sines that were already sounding, and a hummed rite is a
  few seconds of the ward.
- **The worst moments are in the hymns, where the whole ward sings.**
  Chrome's render capacity reached 66–67 % there for a second, and one audio
  callback took 5.14 ms of its 5.3 ms. On this Mac, busy with other work,
  that is close to an audible glitch at the peaks. The build before round 3b
  had more headroom (its worst callback took 3.72 ms).
- **The reckoning's real cost is off the audio path.** The composer writes
  the doxology up to twelve ways in its own thread until one fits the day's
  keys: 21 to 375 ms of the composer's thread in the browser (seeds 3, 17
  and 9), within seconds of pressing PLAY. The drone does not need it until
  the prelude has ended.
- **If you scale back, the obvious levers are:**
  - the ward's size, or a lighter throat for the inner parts;
  - the number of candidate doxologies, `RECKON_CANDIDATES` in
    `kolob-calendar.js` (12 now; 1 means the reckoning only happens where
    the composer's first doxology fits, about one Sunday in five);
  - the reckoning itself, with `&exp=-reckoning` (the switch's default
    lives in `kolob-experimental.js`).

## Known rough edges

- **The drone and the harmony, measured.** A moving drone sits inside the
  sounding chord a little less often than the old keynote drone did (62 %
  against 68 % of the moments with a harmony, over 20 seeds). It clashes a
  second against it about as often (39 % either way).
  - It fits better in the testimony.
  - It fits a little worse in the invocation, and in the sacrament's few
    harmonies (the tines and a hummed chord there).

  Listen for whether the moving drone sounds right to you. If it sounds
  forced, `&exp=-reckoning` is the fallback.
- **The testimony is seated on most Sundays.** Because two plain rites may
  not come in a row, and the sacrament keeps its stillness, the testimony
  before it usually takes a seating instead: most often the ward humming.
- **The doxology's sevenths.** Full light leans the doxology toward the
  Tabernacle much more than toward gospel, so the ringing seventh is still
  only an occasional sound at the end. The weights are in
  `kolob-calendar.js` (`LIGHT_ANCHORS`) if you want more of it.
- **Guests keep their own time.** The trombone choir's known compass issue
  (seeds 17 and 37) is unchanged from before this round.

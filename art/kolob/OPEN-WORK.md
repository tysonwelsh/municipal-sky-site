# KOLOB — open work

*What is planned, requested or known-broken and NOT done, each with its source and one
line on what it would take. Written 2026-10-01 at v0.36.2; every "not built" below was
checked against the code that day (a grep that finds nothing is named). The owner's
rulings are in `OWNER-RULINGS.md`; the staff's rules in `STAFF.md`.*

## The refactor

- **`PLAN-REFACTOR.md`** (2026-10-01; §2 built, v0.36.3; §3.6, §3.1 and §3.3 built): the owner asked for a plan to improve
  efficiency, reliability and maintainability without changing what is heard or seen. Its §2, the
  real faults, is done (commits 3eefffb to a373760: a cue that threw ended its layer for the visit; a
  stillness survived STOP; STOP's own race; errors swallowed silently; a broken page let PLAY be
  pressed; the harness's accounting), §3.6, the golden tests (`tools/golden.js`, commit 22f8bf5), and
  §3.1, one home for the pitch and Score arithmetic (`KOLOB.Pitch`, `KOLOB.Num`, `KOLOB.Score`, commit ea82e61),
  and §3.3, the near-duplicate pairs (the plagal amen, the drone's step back, the cast row, the
  assembly's span, the ward's telling, one Deseret speller, `KOLOB.Fault`).
  What remains is §3 (one place for each thing: the guest-room scaffold, the planner out of the
  conductor, the staff in pieces, the wrappers, the lint) and §4 (the page's load and frame, the minutes' poll, the
  audio graph with the owner), in §6's order.
  The §2 builders' follow-ups, not done:
  - the drone stays ducked after a broken hymn's chain is released by the net (§2.1);
  - a cue's fault that repeats is now logged at each of the net's retries (every 5 s for a layer), not once (§2.1);
  - `C.ward` and `C.organist` survive a reseed while stopped, so the rail sings the old ward until the next meeting is planned;
  - the chord book's ids count for the page's life, not per visit;
  - `no-empty` could now be added to the lint (§3.8), with `allowEmptyCatch` or a comment in each empty catch;
  - a hymn the idle road fails to write warns, while a worker's failure to write one errors.
  The §3.6 builder's follow-ups, not done:
  - `S.pipeOn()` reads `S.ctx`, so a meeting's plan depends on whether an AudioContext exists (no
    variations seated, no chorale prelude drawn without one); §3.4's pure planner should be handed it;
  - the golden walks the ward's and the organist's hymns the labs' way (the Cast's own verse count, the
    hymn's own beat): a pure export of the choir's `performancePlan` would let it walk them as the meeting does;
  - not under the golden: the guests' `prepare()` and `score()`, `Cast.planRefrain` and `Cast.score`, any
    meeting after the first, and the switches (ives, force=, cumulative, razz, exp=).
  The §3.1 builder's follow-ups, not done:
  - the page's own copies in `kolob-viz.js` (`COLLECTIONS`, `clamp`, `monzoCents`, `unitsOf`, `spanBeats`)
    fold into `KOLOB.Pitch`, `KOLOB.Num` and `KOLOB.Score` with the screens, in §3.5;
  - the labs keep their own (`earth-tunes-lab.js`, `guests3b-lab.js`, `hymn-lab.js`, `organist-lab.js`
    ratio; the guests labs' `mod`); `DO_OF` is typed beside `KOLOB.Composer.doOf` by the staff
    (`kolob-viz.js`, page code) and the guests labs (`guests-lab.js`, `guests3a-lab.js`) — the singing
    school's was folded in §3.3; the far ward's and the tongues' `pickWith` over `pickW` belong to
    the pickW variants; the composer's inline span at its round differs from `Score.spanBeats` (no
    "stands later" test) and was left;
  - `tools/loadcheck.js` could load every lab's list of rooms headless, in the lab's order (a scratch
    check did, 13 of 13), so a room that comes to need `kolob-score.js` is caught where a lab lacks it
    (`trombone-lab` loads no `kolob-score.js`; `voices-lab`, `instruments-lab` and `earth-tunes-lab`
    no `kolob-pitch.js`).
  The §3.3 builder's follow-ups, not done:
  - `S.activeVoices` is lent and now read by no other room (the plagal amen it served is the choir's
    own); `tools/lends.js` lists it among the lends never read;
  - the ward's voices (`kolob-voices-vocal.js`) keep a guarded `confess` (to `KOLOB.Fault` where it is
    loaded, plainly where not) because `voices-lab` loads them with only `PJ2.Rand`, as their `clamp`;
    `kolob-pitch.js` on that lab's list would let both borrow;
  - `kolob-guest-variations.js` keeps its own `deseretCaps` (it throws on a missing letter; `guests3b-lab`
    loads it without `kolob-cast.js`);
  - the drone's two releases — STOP's (`kolob-core.js`, the transport) and the dev jump's
    (`skipToSection`, `kolob-meeting.js`): let go, stand at full — still write the duck themselves;
    they are not step backs, and a `droneLetGo(t)` beside `S.droneStepBack` could take them;
  - `kolob-guests.js`'s list of the state it reads names `S.moment` and `S.reportLine`, which it does
    not read (stale before §3.3);
  - the singing school reads where do sits from the composer (`KOLOB.Composer.doOf`) even when it is
    handed a hymn: every list that loads it loads the composer, but a bench that did not would fail at
    its first shape, though `prepare()` still says "a hymn is required (material.hymn), or
    KOLOB.Composer loaded".

## Ideas approved, not built

- **The drone as a waveform on the staff** — the owner's own request
  (handoff/drone-wave-handoff.md §6): "a wavelength line that drifts across the bottom of
  the staff … positioned where the drone should be, given the note that it's playing …
  actually visualizing the data of the drone." Nothing draws the `"drone"` layer
  (`kolob-viz.js` `MELODIC` has no drone; the ground reports it,
  `kolob-voices-ground.js` `droneCycle`/`droneTurn`). *It would take:* a tap on the
  drone's bus (an `AnalyserNode` behind a `KolobAudio` method), the wave drawn at the
  drone's staff position and sliding with each reckoning glide, green, no text; the
  owner's three design questions (register, what the wave shows, the look) settled on a
  mockup first.
- **Deseret phoneme singing — words** (PLAN-COMPOSITION §6.5 "owner: yes"; §5.5; Phase 7).
  The ward sings vowels and "fa sol la mi" (`kolob-voices-vocal.js`); no phoneme or
  underlay code in `kolob-text.js`. *It would take:* a vowel-lab, metered Deseret verses,
  syllable-driven fixed-formant banks (the no-chasing rule); the staff stays wordless by
  the owner's ruling.
- **The visions and the far tail** (§9's table of twelve named visions; Phase 6; §13 "1 in
  5 drifting, 1 in 50 named"). No vision code; `kolob-score.js` reserves the `vision`
  event; PLAN-EXECUTION names `kolob-visions.js`. *It would take:* a distance per seed
  with departures unlocking by threshold, a stream per vision, exclusions, home meetings
  untouched, the distinctness measure as the guard.
- **Ensemble pitch drift** (§3.6): anchored with the organ, floating unaccompanied along
  the comma path, capped about ±25 cents, found a few cents off when the organ re-enters.
  No such drift in `kolob-voices-choir.js`, `kolob-cast.js` or `kolob-hymnal.js` (only
  each singer's own drift in `kolob-voices-vocal.js`).
- **PLAN-ONE-ROOM phases C–E** (§10.1): the far wall (`Fx.delay`), the case
  (`Fx.sympathetic`), weather (`Fx.weather`), a shared high shelf. `kolob-core.js` loads
  `pj2-fx.js` for `roomBlend` only; no delay, sympathetic, weather or shelf. The
  owner accepted that weather reseeds old meetings (PLAN-ONE-ROOM status). *It would
  take:* three ports from `pj2-fx.js` and a re-listen.
- **The cast's longer threads** (§5.5): the newcomer who finds the tune by the doxology;
  the testimony's speech-melody as the theme the doxology quotes. The bearers speak and
  the reed plays them back (`kolob-meeting.js` `testimonyBegins`); nothing carries a
  bearer's phrase into the doxology.
- **The partner hymn beyond the Tabernacle** (archive/handoff/r3b-styles-1.md):
  `PARTNER_DIALECTS` (`kolob-hymnal.js`) allows only the Tabernacle, the Shakers and
  an Old Way tune under a Shaker doxology; Sacred Harp, psalmody and gospel partners never
  combined (0 of 12). *It would take:* a fit check that can pass in those dialects, then
  the owner hearing it in hymn-lab.
- **An `incipit` option for `compose`** (r3b-form-1, request 3): no `incipit` in
  `kolob-composer.js`. Today the doxology is chosen for the keys from up to 24 candidates
  (`RECKON_CANDIDATES`, `kolob-calendar.js`); about a third of Sundays fall back and
  half the reckoned ones spell only the stressed notes.
- **A Tabernacle doxology that reaches for its V7s** at full light (r3b-form-1, request
  4): the ringing chord is rare at the end because the Tabernacle carries 58 % of
  doxologies.
- **An AudioWorklet ward** (archive/handoff/r3-cast-1.md: "the next step is an
  AudioWorklet ward"): thirty-two voices in one node, the real answer for a phone; a
  project of its own.
- **The organist's variations off the clock** is done; **the trombones borrowing the
  band's reverb** (crew A's critic, optional) is not.

## Requests from the crews, not done

- **`VoicesVocal.warm(ctx)`** (r3c-integrate-1, request 2): no `warm` in
  `kolob-voices-vocal.js`; the press warms the band and each guest that has one
  (`kolob-core.js`). *It would take:* baking the ward's first inhale at the press
  as the company's warm does.
- **The re-barred dances carry no `beat`, so they print with no bars** (r3c-engrave-2,
  request 3, open since round 1; `kolob-viz.js`). *It would take:* the
  organ crew giving the dance's notes a beat in the dance's own bar.
- **The in-page engraving checker as a standing tool** (r3c-engrave-2, request 2):
  `crit.js`, `incheck.js`, `tone.py` live only in a scratchpad; `tools/` has `screens.js`
  (screenshots and frame cost) and nothing reads `probe("ink")` (`kolob-viz.js`). *It
  would take:* porting the checker under `tools/`, with `captureBeyondViewport: false` and
  curves keyed by `q1`.
- **The band's sliding layer** (r3c-engrave-2, request 1): the owner's call — the band's
  notes slide across our ink at the band's own rate (`kolob-viz.js` `r`
  `drawBand`); scrolling it with the page would stop the crossings.
- **The silent A/B packet of the hiss sources** recommended in PLAN-COMPOSITION §15 ("with
  and without each source, so he can confirm by ear which one he heard"): no such packet
  in `handoff/`.
- **The caterpillar: "let's give it a few more passes"** (PLAN-CATERPILLAR §7). Pass 2
  shipped (handoff/caterpillar-2.md); nobody has watched it at full frame rate
  (caterpillar-1.md:287): headless Chrome draws about one frame a second.
- **New staff layers** asked for in r3c-integrate-1 (request 1) were drawn in
  r3c-engrave-1/2 (`kolob-viz.js`); the request is closed.

## Known issues

- **The staff** (handoff/r3c-engrave-2.md, Known issues): one far-ward stem touches one of
  our heads (seed 10, 860 px, 7:05); one slur of ours crosses a pale far-ward head (seed
  10, 860 px, 227.7 s); our own stacked thirds count as heads struck and a bar is squeezed
  where the hymn runs quicker than the page's cap (seed 44's first 40 s, seed 37's
  doxology 1:27–1:31); the organist's variations stand late where densest (seed 119's
  canon 12.2 sp at 860 px; the cure to try: at most two voices to a staff at one instant);
  a curve appears whole when its last note is struck; a note set past its time waits for
  the burin (our hymn up to 2.4 spaces, a crowded guest more); two stems a pixel apart in
  the trio read as one thick stem; at 390 px the wheel's rim overlaps the plate's corner
  (the page's layout).
- **The meeting** (handoff/r3c-integrate-1.md, Known issues): the PLAY press is one long
  task of 105–129 ms (122–125 ms now, 70–82 before round 3c); the Hosanna has 18 of 40,849
  render callbacks over the 5.33 ms budget (longest 5.9 ms) and the far ward 1 (6.4 ms) —
  no dropout measured, but "listen at the shout's entries and the far ward's first verse
  for a click"; REPRO at exactly 1,250 s on seed 22 lays three organ chords of the next
  meeting a pump early; the dev jump to "hymn" lands on the first hymn, so a far ward
  seated later is heard only by playing on.
- **Round 3b's rough edges** (handoff/listen-r3b.md; archive/handoff/r3b-form-1.md): the drone's
  landing rubs in 53 % of turns (39 % for the keynote drone), most before a hymn in
  another key — the lever is to land the glide on the next rite's first chord; the
  Tabernacle's men's verses are mostly in unison; the arc's harmony rises only a little;
  the trombone choir's compass (seeds 17, 37); the distinctness tail's closest pair is
  closer than before.
- **The Earth tunes** (archive/critic/wave1-open-issues.md): SIMPLE GIFTS's data still says the
  second strain follows a transcription, "not a facsimile" (`kolob-tunes.js`), though
  Mary Hazzard's manuscript exists (Winterthur ASC 893, canvas 893_057, no US copyright);
  KINGSFOLD's soprano D4→G4 (27/20) and KEDRON's tenor G4→D5 (40/27) are wolf leaps
  because `temper` (`kolob-tunes.js`) scores sourness, moves and repeated notes
  but no melodic interval; comma jumps across line breaks (temper runs per line); cadence
  labels read "imperfect" where no chord is named; the Earth Tunes Lab's engraved rows
  shrink to the card at 390 px (the site's `svg { max-width: 100% }`).
- **The second look's four latent items** (archive/handoff-second-look.md), checked: accessor
  lends non-configurable — **fixed** (`configurable: true` at `kolob-pitch.js`,
  `kolob-meeting.js`, `kolob-core.js`); `commaOf` when the spelled
  degree carries more sevens than the note — **still latent** (`kolob-pitch.js`
  sets `septimal` 0 for `d[3] < 0` and leaves the 36/35 in the remainder; SCORE §2 still
  says `septimal: 0|1`; harmless while `TUNING_MARKS` is off); mixolydian solmized as a
  major tune with its seventh "mi" — **as found, now documented as a choice**
  (`kolob-viz.js`; the second look's `sol la mi fa sol la fa` not taken);
  `roundRect` without a fallback — **fixed** (`kolob-viz.js`).
- **The hymns hold 1,900–2,900 nodes** and a callback can take 4.3–5.1 of its 5.3 ms on a
  busy Mac (listen-r3b): "close to an audible glitch at the peaks".

## Decisions waiting on the owner's ear

- **Rounds 3b and 3c have not been listened to.** Every level since the ward was set by
  measurement against the organ reference (listen-r3b, listen-r3c).
- **The last path no live page reaches:** a ward's hymn without the organist's hands on
  it — `organistAt` null — sings over the sheet's own organ lines on sines (`wardOrgan`,
  `organModulates`, `voiceChord` in `kolob-voices-choir.js`; `organPartLine` in
  `kolob-voices-organ.js`; the cast writer's organ lines in `kolob-cast.js`). The organist is
  always seated and a Tabernacle hymn has no fuge, so it never runs; retiring it means the
  writer stops writing organ lines when it has no organist. The house organ, the house choir
  and the fife were retired on 2026-10-01.
- **The guests' odds** (`kolob-calendar.js` `GUEST_ODDS`): the band's share against the
  rest; each guest's row "a starting point, for the owner's ear"; the trombones' base 0.21
  "the integrator's to rule on once the owner has heard the new sound."
- **The Hosanna's levers:** `SHOUT_EFFORT`, `SHOUT_FRIC`, `SHOUT_H_SWELL`
  (`kolob-guest-hosanna.js`), `YIELD`, `HYMN_CONSONANTS`.
- **The far ward:** 24 throats or eight pews (`kolob-guest-farward.js`).
- **The testimony:** does a speaking voice without words read as testimony?
- **The staff:** the band's sliding layer; Johnston's marks (`kolob-viz.js`); the
  sparer look (PLAN-COMPOSITION §15 "may come back later").
- **The drone:** the landing, and how many Sundays reckon (`RECKON_CANDIDATES`).
- **The organ under the ward:** `UNDER_WARD_DB` (`kolob-voices-organ.js`).
- **What to scale back**, "either for technical or aesthetic reasons" (2026-09-28).

## Cost

- **Measured, not cut** (r3c-integrate-1; listen-r3c): the Hosanna 34 % of the audio
  thread, 43 % at its busiest, about 5,800 nodes; the far ward 46–48 % at its busiest with
  our hymn, about 2,900 nodes; a whole meeting with two bands and the Social Hall 17 %
  typical, 41 % busiest, 2,540 nodes; the ward's hymn alone 30–35 %. The yardstick build
  before round 3b ran 15–28 %.
- **No phone has played it** (README; r3-cast-1 §3): a phone two or three times slower
  than the Mac is at or under the edge; the owner ruled no cuts for phones.
- **Where to save, if asked** (listen-r3c "Where to save"; none done): the far ward in
  pews (`material.voices: "desks"`); the Hosanna without the Primary's children (32
  voices, not 40) or on "hymn principal" instead of the full organ; fewer second bands
  (`kolob-guest-bands.js` `ODDS.second`); `RECKON_CANDIDATES` 24 → 12 (the reckoning's
  cost is off the audio path: 156–436 ms of composing after PLAY).

# KOLOB — open work

*What is planned, requested or known-broken and NOT done, each with its source and one
line on what it would take. Written 2026-10-01 at v0.36.2; every "not built" below was
checked against the code that day (a grep that finds nothing is named). The owner's
rulings are in `OWNER-RULINGS.md`; the staff's rules in `STAFF.md`.*

## The refactor

- **`PLAN-REFACTOR.md`** (2026-10-01; §2 built, v0.36.3; §3.6, §3.1, §3.3, §3.7, §3.8, §3.2, §3.4, §4.0(a), §3.5, §4.0(b) and §4.0(c) built): the owner asked for a plan to improve
  efficiency, reliability and maintainability without changing what is heard or seen. Its §2, the
  real faults, is done (commits 3eefffb to a373760: a cue that threw ended its layer for the visit; a
  stillness survived STOP; STOP's own race; errors swallowed silently; a broken page let PLAY be
  pressed; the harness's accounting), §3.6, the golden tests (`tools/golden.js`, commit 22f8bf5), and
  §3.1, one home for the pitch and Score arithmetic (`KOLOB.Pitch`, `KOLOB.Num`, `KOLOB.Score`, commit ea82e61),
  and §3.3, the near-duplicate pairs (the plagal amen, the drone's step back, the cast row, the
  assembly's span, the ward's telling, one Deseret speller, `KOLOB.Fault`), and §3.7, the BORROWED
  wrappers kept as each room's manifest and checked exact by `tools/lends.js` (with `VISIT_FN` one list
  of names), and every lab's list of rooms loaded headless in its order by `tools/loadcheck.js`, and
  §3.8, the lint a notch tighter (`no-empty` with every quiet catch saying why, `default-case`,
  `no-prototype-builtins`; `complexity` and `max-lines-per-function` as warnings), and §3.2, one
  scaffold under every guest room (`KOLOB.GuestRoom`, `kolob-guest-room.js`, commit 5f366f8) and one
  host for the guests the glue plays (`kolob-guests.js`, commit 7a3bc81), and §3.4, the planner out
  of the conductor (`KOLOB.Plan`, `kolob-plan.js`, commits f48e06d and 728aa87: the day and the
  seating, pure; the golden runs them with the house shut), and §4.0(a), the frame-exact capture
  (`KolobViz.freezeAt`, `screens.js --freeze`, commit e06bfee), and §3.5, the staff in pieces
  (`kolob-viz.js` and five files behind one `KolobViz`, `_viz.php`'s list, commits 4ca4631 and 1478f2d:
  every statement moved whole, held by `samecode.js --split`; everything the page draws traced
  headless by the harness's `staff=`, the same before and after), and §4.0(b) and (c), the rest of
  the tools: the audio graph's cost per work (the harness's `cost`, `tools/cost.js`, commit d05a5c6:
  every node, automation call and disconnect charged to the lane, guest or press that made it) and
  the tally four at a time, both builds on one pool (`--jobs`, commit e4dbe57: about 70 s).
  What remains is §3.5's tail (the composer's steps in order) and §4 (the page's load and frame,
  the minutes' poll, the audio graph with the owner), in §6's order.
  The §2 builders' follow-ups, not done:
  - the drone stays ducked after a broken hymn's chain is released by the net (§2.1);
  - a cue's fault that repeats is now logged at each of the net's retries (every 5 s for a layer), not once (§2.1);
  - `C.ward` and `C.organist` survive a reseed while stopped, so the rail sings the old ward until the next meeting is planned;
  - the chord book's ids count for the page's life, not per visit;
  - a hymn the idle road fails to write warns, while a worker's failure to write one errors.
  The §3.6 builder's follow-ups, not done:
  - ~~`S.pipeOn()` reads `S.ctx`, so a meeting's plan depends on whether an AudioContext exists~~ —
    §3.4 hands the plan the answer (`info.pipeOn`); the house still answers it by `S.ctx`;
  - the golden walks the ward's and the organist's hymns the labs' way (the Cast's own verse count, the
    hymn's own beat): a pure export of the choir's `performancePlan` would let it walk them as the meeting does;
  - not under the golden: the guests' `prepare()` and `score()`, `Cast.planRefrain` and `Cast.score`, any
    meeting after the first, and the switches (ives, force=, cumulative, razz, exp=) — but for the
    plan's two halves, which §3.4 runs on 21 settings of the switches, twice each, against no baseline.
  The §3.1 builder's follow-ups, not done:
  - the page's own copies (`COLLECTIONS` in `kolob-viz-intake.js`, `clamp` in `kolob-viz-atlas.js`,
    `monzoCents`, `unitsOf` and `spanBeats` in `kolob-viz-hymnal.js`) fold into `KOLOB.Pitch`,
    `KOLOB.Num` and `KOLOB.Score` — not in §3.5, which moved code and changed none; a fold changes
    which function computes, and the harness's `staff=` can now hold it to the same drawing, frame by
    frame;
  - the labs keep their own (`earth-tunes-lab.js`, `guests3b-lab.js`, `hymn-lab.js`, `organist-lab.js`
    ratio; the guests labs' `mod`); `DO_OF` is typed beside `KOLOB.Composer.doOf` by the staff
    (`kolob-viz-hymnal.js`, page code) and the guests labs (`guests-lab.js`, `guests3a-lab.js`) — the singing
    school's was folded in §3.3; the far ward's and the tongues' `pickWith` over `pickW` belong to
    the pickW variants; the composer's inline span at its round differs from `Score.spanBeats` (no
    "stands later" test) and was left.
  The §3.3 builder's follow-ups, not done:
  - the ward's voices (`kolob-voices-vocal.js`) keep a guarded `confess` (to `KOLOB.Fault` where it is
    loaded, plainly where not) because `voices-lab` loads them with only `PJ2.Rand`, as their `clamp`;
    `kolob-pitch.js` on that lab's list would let both borrow;
  - `kolob-guest-variations.js` keeps its own `deseretCaps` (it throws on a missing letter; `guests3b-lab`
    loads it without `kolob-cast.js`);
  - the drone's two releases — STOP's (`kolob-core.js`, the transport) and the dev jump's
    (`skipToSection`, `kolob-meeting.js`): let go, stand at full — still write the duck themselves;
    they are not step backs, and a `droneLetGo(t)` beside `S.droneStepBack` could take them.
  The §3.7 builder's follow-ups, not done:
  - the lab check (`tools/loadcheck.js`) catches a room that needs another *at load*; one that reads
    another only when called (`KOLOB.Composer.doOf` in the singing school, the §3.1 wrappers onto
    `KOLOB.Pitch`, `KOLOB.Num` and `KOLOB.Score`) is caught only when its lab plays it — a static
    check of each room's `KOLOB.<Name>` reads against every list that loads it would close that;
  - `tools/lends.js` still lists three lends no room reads: `S.SHELVED` (core), `S.forceRaspberry`
    (meeting) and `S.reportLine` (the winds);
  - the §3.1 wrappers onto the namespaces (`function mz(a, b) { return K.Pitch.mul(a, b); }`) keep the
    room's old names by design and are not checked; only the BORROWED wrappers onto `S` are.
  The §3.2 builder's follow-ups, not done:
  - `kolob-guest-changes.js` `perform()` builds the tower twice (`var T = tower(…)` on two lines): the
    first tower's partials run silent to the end, and its dice are drawn from the synth stream first,
    so removing it moves the ringing's sound-level dice — a change for the owner's ear;
  - the trombones' rows are built and told when their cue comes and never asked again whether the
    dawn stands (every other guest's row asks, `tellAt`); kept as it was, an option of the host's
    `hooks`, not normalised;
  - `C_live` asks by the guest's type through the chorister's book (its guests are copies), so a cue
    of an old visit that outlived a reseed could find the new visit's meeting of the same number
    standing (not seen; the meeting's own guests ask their records, `standsFor`);
  - the variations, change ringing and the Social Hall keep their own prologues and epilogues beside
    the host (the organist's desk, the steeples' bells, the dance's drone); they could take `host`
    with an option or two more;
  - `GuestRoom.level` defines `LEVEL` after the room's other properties, so it now enumerates last
    (nothing reads the order).
  The §3.8 builder's follow-ups, not done:
  - `no-shadow` no longer waits (§3.2 is built and moved none of its 182 sites under `art/kolob`,
    116 in the engine and the page);
  - the warnings to watch, as `npm run lint` prints them on 2026-10-01: `complexity` over 25 in 98
    functions (75 in the engine and the page, 13 in the labs, 10 in the harness and the tools; two more
    since §3.4, which split `planMeeting`'s 218 into `Plan.seat` 157, `Plan.day` 38 and `planMeeting`
    32) and `max-lines-per-function` over 150 in 20 (18 and 2: `kolob-voices-folk.js create` 503
    lines, `kolob-voices-vocal.js renderLine` 398, the pipe organ's `create` 348, `kolob-plan.js seat`
    264 — `planMeeting`'s 368 before §3.4).
  The §3.4 builder's follow-ups, not done:
  - `Plan.seat` is still one function of about 500 lines (every guest's seat, the budget, the
    seatings, the hymnal, the reckoning's order): each guest's block could be a small function of
    its own, now that the golden proves the plan in seconds;
  - the road without a composer — the trombones' dawn chorale written by the house's pen
    (`info.dawnChorale`), which on a withheld Sunday develops the day's gestures, the one place the
    plan calls back into the house — is taken by no page and no lab (every one that loads the
    meeting loads the composer and the hymnal); it could be retired as §2.5 retired the
    calendar-less fallbacks;
  - the guests labs' stand-ins (`guests-lab.js`, `guests3a`–`3d-lab.js`) re-throw the plan's dice
    by hand; they could load `kolob-plan.js` and call `KOLOB.Plan.day`;
  - the plan reaches the rooms it calls (the calendar is handed in; the guest rooms, the hymnal,
    the cast and the organist are read off `KOLOB` at call time): pure given the rooms loaded;
  - `handoff/r3c-integrate-1.md` still names `kolob-meeting.js` for the guest budget (a handoff,
    left as written).
  The §4.0(a) and §3.5 builder's follow-ups, not done:
  - `kolob-viz.js` keeps 2,025 lines: the engraving (the drawing helpers, the hymn's signs, the
    static layer, about 800 lines) and the ward's page could each leave it, but they read the page's
    state most (`dpr` at 58 sites, `G`, `PT`, `FRAME`, the proof sheet), so a cut would read about fifty
    more names through `VS`; the harness's `staff=` would prove it in minutes;
  - the page's six files answer no roll call: a missing piece is found by `tools/loadcheck.js`, and on
    the page only when a frame first calls into it ("VS.x is not a function"); a guard like the
    engine's (`KOLOB._broken`) could name it at load;
  - the hot path now crosses files: the atlas's `headSprite`, `drawGlyph`, `rgba`, `clamp`,
    `shapeKey` and `anchorOf` are called through one-line wrappers from `kolob-viz.js`, and the atlas
    reads `VS.dpr` through a getter, per head per frame — measured, nothing the screens can see
    (seed 22 at 860 px, 4× throttled, 60 s from 90 s, builds alternated twice: p50 16.7 and 14.2 ms
    before, 17.0 and 16.7 after); §4.2 is the place to weigh it closer;
  - the frame-exact capture holds the staff only: the wheel's organ is the live spectrum and its arc
    the console's last poll, and the console and the broadside run on, so a `--full` page is not
    comparable by pixel (the staff's rows in it are); in the sacrament and the postlude the drying
    follows the section the console last reported, so a page there can differ by a shade; and the
    harness's `staff=` does not exercise the hook (`?kolobFreeze` is proved in Chrome only);
  - the visiting band's emission moves from run to run in the browser (the one the captures found): its
    march is sliced for laying by `Math.floor` over absolute audio times (`kolob-guest-bands.js`
    `perform`, `slices`), whose downbeat is wherever the context stood at PLAY, so a note on a
    slice's edge is written by one cue or the next, and the band's barlines (their shade follows how
    far the march is written, `takeBand`'s `tp1`) differ by a shade; slicing on the march's own time
    would make it the harness's every time (an engine change, for the tally);
  - the composer's numbered steps, the other half of §3.5's text, are still in the order 1, 3, 2, 3b,
    4, 4b, 7, 6, 5 (`kolob-composer.js`): left, as lower value than the risk of a two-thousand-line
    move the same day. Found for whoever takes it: nothing in those sections is read at load (the
    closure's only load-time reads are its top tables — SEMIS, MODES, K — and the exports at its
    foot; `JOHNSTON7 = mzCents(…)` calls a function of the top section), so the sections can move
    whole; `samecode.js --split` with one new file and its order check relaxed would hold every
    statement to its old tokens, and the golden (hymns, 40 of 40) and the tally prove the rest.
  The §4.0(b) and (c) builder's follow-ups, not done:
  - the cost counts what is built, not what sounds at once: the audio thread's share (§4.6's
    30–35 %, the Hosanna's 43 %) follows the nodes joined and sounding together, which the mock
    does not hold (it counts no connect); the vocal room's own ledger (`budget.aliveAt`,
    `kolob-voices-vocal.js`) or a live-node count in the mock (built less disconnected, minute by
    minute) would come nearer, and the browser's capture is still the measure;
  - a piece one lane hands to another's pump is the pump's when it is built: the hymn's throats are
    `ward`'s (the choir's lane tells their notes and builds 960 of seed 22's nodes), and a guest's
    line handed to the ward's or the organist's desk would be that desk's — following a piece
    through the desks would need the engine to say whose it is;
  - two anonymous builders of one file are one row in `cost.js` (it matches builders by function and
    file, not line, so that a moved builder stays itself): `kolob-voices-vocal.js`'s breath source
    and its oscillator, both `(anonymous)`;
  - `tally.js`'s default of four leaves cores idle on a bigger machine (a harness keeps about two
    busy, so half the cores would fill one); `render.js`, `distinctness.js`, `repetition.js` and
    `cost.js` keep half the cores, at most eight, a set, and `cost.js` renders its builds one after
    the other — each could take the tally's shared pool;
  - with both builds on one pool, the tally's progress dots of the two sides interleave on stderr.

## Ideas approved, not built

- **The drone as a waveform on the staff** — the owner's own request
  (handoff/drone-wave-handoff.md §6): "a wavelength line that drifts across the bottom of
  the staff … positioned where the drone should be, given the note that it's playing …
  actually visualizing the data of the drone." Nothing draws the `"drone"` layer
  (`kolob-viz-intake.js` `MELODIC` has no drone; the ground reports it,
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
  request 3, open since round 1; `kolob-viz-guests.js` `takeVariations`). *It would take:* the
  organ crew giving the dance's notes a beat in the dance's own bar.
- **The in-page engraving checker as a standing tool** (r3c-engrave-2, request 2):
  `crit.js`, `incheck.js`, `tone.py` live only in a scratchpad; `tools/` has `screens.js`
  (screenshots and frame cost) and nothing reads `probe("ink")` (`kolob-viz.js`). *It
  would take:* porting the checker under `tools/`, with `captureBeyondViewport: false` and
  curves keyed by `q1`.
- **The band's sliding layer** (r3c-engrave-2, request 1): the owner's call — the band's
  notes slide across our ink at the band's own rate (`kolob-viz-intake.js` `takeBand`'s `r`,
  `kolob-viz.js` `drawBand`); scrolling it with the page would stop the crossings.
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

# KOLOB — the owner's rulings

*Every binding ruling the owner has made about this app, dated, each naming the file and constant that
implements it. Written 2026-10-01 at v0.36.2; every reference was checked against the code that day.
Quotations are the owner's words. The record is `archive/plans/PLAN-COMPOSITION.md` §13–§15, the top of
`archive/plans/PLAN-ENGRAVING.md`, `PLAN-ONE-ROOM.md`, `PLAN-CATERPILLAR.md` §7, `archive/plans/PLAN-EXECUTION.md` §0 and the git log of
`VERSION`.*

## Sound

- **2026-09-13 — One room.** "sometimes it feels like the tracks are separate … separate recordings just
  kinda layered on top of each other": every layer now feeds a CLOSE and a WIDE room at its own depth
  (`kolob-core.js` `ROOM_CLOSE`/`ROOM_WIDE`; `PJ2.Fx.roomBlend`).
- **2026-09-14 — The tabernacle is St Margaret's Church, York,** chosen by ear on the room lab; the stereo
  take with its CC BY-SA credit, pre-delay 63 ms to match the mono take the owner heard
  (`kolob-core.js`).
- **2026-09-13 — The bagpipe is shelved: "just kind of obnoxious"** (`kolob-core.js`; its room and lab
  in `shelved/`; `SHELVED`, is the mechanism, empty).
- **2026-09-26 — The full ward:** 32 singers, 8 a part, each with a throat of their own; desks are a
  documented fallback, never a planned reduction; phones get no fewer voices
  (`kolob-voices-choir.js`; `kolob-voices-vocal.js`; PLAN §5.1).
- **2026-09-28 — Build without the phone constraint; measure the cost, report it, cut nothing.** The owner
  scales back by ear, "either for technical or aesthetic reasons" (`kolob-voices-choir.js`; the
  far ward's 24 throats, `kolob-guest-farward.js`).
- **2026-09-26 — Settled (§13):** build out, don't rework (§1.1); visions in about 1 meeting in 5, 1 in 50
  named, "a starting point to tune by ear" (not built; `kolob-score.js` reserves the event); guests in
  about 55 % of meetings, a starting point (`kolob-calendar.js` `GUEST_ODDS`, "The owner tunes them
  by ear"; the census reads about 60 %); the Social Hall may end a meeting (`kolob-guest-socialhall.js`;
  `kolob-meeting.js`).
- **The band comes 36 % of the time, "per the owner's taste"** (`kolob-meeting.js`;
  `kolob-guest-bands.js` `ODDS.base: 0.36`); round 3c kept it and fitted every other guest's row
  around it. **The Sundays' shares the owner ruled:** ordinary 45–55 %, fast about 15, conference 15–20,
  jubilee 10–15 (`kolob-meeting.js`).
- **2026-09-27 — Colony composers: approved** (fifteen built; the minutes name the author in Deseret, the
  staff shows nothing: `kolob-hymnists.js`; §14.1). **2026-09-27 — Rounds and the partner hymn:
  approved, for COMPOSED hymns only** — "this concerns the generated music, not the Earth tunes"
  (`kolob-hymnal.js` `FORM_ODDS` `PARTNER_DIALECTS`; §14.2).
- **2026-09-27 — The trombone choir at dawn: approved;** it leans to Easter, Christmas, funerals and
  dedications and never shares a meeting with the bands (`kolob-guest-trombones.js` `ODDS`,
  `EXCLUDES`; §14.3).
- **2026-09-27 — The organist between the lines: approved, sparingly — "let's not overuse it":** at most one
  strange fill a meeting, none in the unaccompanied dialects (`kolob-organist.js` `cap: 2` `STRANGE_ODDS`; §14.4).
- **2026-09-27 — The pitching: approved** (`kolob-cast.js`). **The pin drop: declined**
  (§14.5). **2026-09-27 — A section may lengthen for a guest: "it's ambient music … if the section needs to
  be a bit longer, that's okay"** (`kolob-meeting.js` `jointHeld`).
- **2026-09-27 — The Question is shelved: "one of the less interesting guests… there's better stuff we could
  be focusing on."** Its dice are still thrown (`kolob-meeting.js` planMeeting, `qDie`/`qSeatDie`); the
  code is in `shelved/` (the generator; since 2026-10-01 the set piece and the staff's cartouche too);
  the askers and the cornet's 55 % are withdrawn, the cornet stays as the band's lead.
- **2026-09-27 — The invocation prays (a chant on the drone): declined** (§15.1). **2026-09-27 — The
  organist's prelude on the day's first hymn: approved, "keep it a draw"** (`kolob-meeting.js`
  `preludeDraw`; §15.2).
- **2026-09-27 — The wandering refrain and the ward's handbell choir: approved** (`kolob-hymnal.js`;
  `kolob-guest-handbells.js`; §15.4–5). **2026-09-27 — The singing school: approved as EXPERIMENTAL** — "a
  more experimental feature, so let's flag it in case I want to make playthroughs like this disabled later
  if it is too much of a mess" (`kolob-experimental.js` `DEFAULTS`;
  `kolob-guest-singingschool.js`; `?exp=-singingSchool`; §15.3).
- **2026-09-27 — The trombones "sound muddy, like a muted, muddy organ":** brighter, clearer brass, less
  distance lowpass, real articulation (`kolob-voices-band.js`; the far choir's 600 Hz veil gone,
  `kolob-guest-trombones.js`). **Their ending stays open: "keep it open,"** the forced final I
  reverted (`kolob-guest-trombones.js`; `kolob-meeting.js`).
- **2026-09-27 — Before v0.34 (all approved):** fewer fast Sundays on first visits
  (`kolob-meeting.js`); "prioritize variation wherever we can" in the opening
  (`kolob-meeting.js`); the near trombone choir raised (`kolob-guest-trombones.js`); the old
  tune lowered and its repeated notes re-struck (`kolob-guests.js` `OLD_TUNE_DB: -7`, `ONSET_DIP`);
  the house lets go smoothly when a guest enters (`kolob-core.js` `houseLetsGo`).
- **2026-09-27 — SIMPLE GIFTS ran at twice a singing pace:** `beatS: 1.1` (`kolob-tunes.js`).
  **Tunes that ARE in the Latter-day Saints' hymnbook** join the Earth tunes, each with an `lds` field
  (§14); v0.30's hymnary.org drafts, which the owner "heard in the tune lab and judged wrong",
  are gone.
- **2026-09-28 — THE HISS: "a brushing s sound… like a breath, or air released out of a tire… in between
  notes when the hymns are being sung."** Four sources: the ward's breath and fricatives
  (`kolob-voices-vocal.js`, `FRIC_PEAK`, `INHALE`); the pipe organ's chiff
  (`kolob-voices-pipeorgan.js` `CHIFF_LEVEL: 0.55`); the singing school's shapes sung without f and
  s (`kolob-guest-singingschool.js`); the gift of tongues given no s or f
  (`kolob-guest-tongues.js`).
- **2026-09-28 — The organ is "pretty loud": 2.3 dB down, 0.52 → 0.40** (`kolob-core.js`); the
  organist sits within ±2 LU of it (`kolob-organist.js`) and is lifted under the ward by
  `UNDER_WARD_DB` (`kolob-voices-organ.js`).
- **2026-09-28 — The trombones: "still not terribly enthused… maybe just turn them down in the mix" — 4 dB
  down, 1.4 → 0.88** (`kolob-guest-trombones.js` `LEVEL`). The handbells
  (`kolob-guest-handbells.js`), the far tower (`kolob-guest-changes.js`) and the Social Hall
  (`kolob-guest-socialhall.js`) take their level from that.
- **Older level rulings (undated):** the bells 20 % down (`kolob-core.js`); the still small voice lifted
  at the source and in the trim (`kolob-core.js`; `kolob-voices-field.js`); the beacon pushed
  hard, Morse over hiss (`kolob-voices-field.js`); the tuba's blat doubled, "the blat WILL be heard"
  (`kolob-voices-ground.js`).
- **The Hosanna is audio-only and unlogged** (round 3c, overriding §8.12): nothing in the minutes, on the
  board or on the staff (`kolob-guest-hosanna.js` `LOGGED`, `ENGRAVE_HYMN`;
  `kolob-meeting.js`; `kolob-viz.js`).
- **The reckoning's A/B is the drone alone:** `?exp=-reckoning` holds the drone home and changes nothing
  else (`kolob-calendar.js`; `kolob-meeting.js`). **Round 2's re-base was owner-approved:**
  labelled streams and clock cues; seeds play differently from v0.32 on (`kolob-core.js`).
- **2026-09-30 (v0.36.1) — The bands never play over the ward's singing:** the prelude or the postlude,
  never a hymn (`kolob-guest-bands.js` `SEATS`; `kolob-meeting.js`). "It goes on a
  bit long": `MAX_DUR` 110 → 55 s (`kolob-guest-bands.js`).
- **2026-09-29 — The band's caterpillar, the owner's idea:** a volume for the band alone that "creeps onto
  the interface like a caterpillar" and crawls off when the band has gone (`kolob-ui.js`;
  `KolobAudio.setBandVolume`, `kolob-core.js`; 0–150 %, `index.php`).
- **2026-09-30 — The caterpillar, pass 2 (binding):** "It should just be a line with the thumb … a green
  circle with the white circle inside of it and not the hexagram … a little bit slower … more like a normal
  distribution curve when it is scrunched up" (`kolob-ui.js` `PACE: 1.5` `HUMP`, `SIGMA`;
  PLAN-CATERPILLAR §7). "So let's give it a few more passes."

## The staff and the page

- **2026-09-26 — Direction A, "The Colony Tunebook,"** from three mockups; B and C not pursued
  (`kolob-viz.js`; `mockups/engraving-a-tunebook.html`). Scroll 60 px/s (`SCROLL_PX_S`).
  **2026-09-26 — No rubrics (no vermilion), no words between the staves, no drone on the page, no decoded
  word on the telegraph** (PLAN-ENGRAVING top; `kolob-viz.js`; no `drone` in `MELODIC`).
- **2026-09-27 (for v0.32) — Green ink only:** no gilt strike, no cooling, no glow; only the drying fades a
  note (`C_INK`). **2026-09-27 — No text on the staff:** no 8va/15ma, no captions, no time
  figures for the band; out-of-range notes take the ledger room, then fold silently by octaves
  ("Everything is green; nothing is text"). The Question's cartouche and "?" — the one glyph that
  was text — left the live tree with its set piece on 2026-10-01 (`shelved/kolob-question-setpiece.js`).
- **2026-09-27 — The telegraph is holes punched straight into the paper** along the middle of the gap, no
  tape, no container. **2026-09-27 — No pulse or expanding-ring animations:** a bell is a
  static ringed head; only the scroll and the drying move .
- **The drone bar removed: "what's the deal with the greyish bar that occupies the bottom row of the staff?
  I don't care for it."** (handoff/drone-wave-handoff.md §4). Nothing draws `"drone"`; the owner has since
  asked for the drone as a waveform (OPEN-WORK).
- **2026-09-27 — Engrave the trombones and the old tune; the staff never sits blank while a guest plays.
  Keep the fuller staff (every sounded note); the sparer look may come back later** (§15; `takeTrombones`; the old tune; every round-3c guest).
- **2026-09-29 (v0.35.1) — Sharper notes: each head one clean strike,** the ink-spread halo and pale
  letterpress edge off . "As though there's two strokes for each note": every note is
  now struck whole on a proof sheet and laid once (`impress`/`stamp`); a ring stands off its
  head, a flag clears its head, a slur never cuts a head, a stem
  never crosses one.
- **Johnston's tuning marks are off until the owner rules** (`TUNING_MARKS: false`). **Words
  and the running head stay off the page**. **The Hosanna never prints** .
  **v0.30 — "let the pipes ignore the arc for now":** the facade's pipes may rise through the hour ring.

## Process and testing

- **Silent testing.** Every browser an agent launches is muted; `tools/lib/chrome.js` refuses a
  Chrome without `--mute-audio`; level checks render offline (SCORE §7; `tools/README.md`;
  drone-wave-handoff §3).
- **VERSION moves with the owner's experience:** any audible or visible change bumps `VERSION` in the same
  commit, in words the owner would notice; dev-only work does not (CLAUDE.md; SCORE §8; `index.php`).
- **2026-09-26 — Every agent runs at extra-high effort** (PLAN-EXECUTION §0; wave 1 ran at medium until the
  owner raised it). **Short checks, not batteries:** a harness run and a short listen; at most two critic
  rounds a milestone, then ship and iterate (PLAN-EXECUTION §0; `node art/kolob/_harness.js 300 7`).
- **Nothing publishes without the owner asking;** merges to `main` follow the owner's listen (PLAN-EXECUTION
  §0; drone-wave-handoff §2). **Approval before creative direction changes:** critics propose, a short brief
  goes to the owner, nobody builds first (PLAN-EXECUTION §0); design approval on a mockup or screenshots
  before a final build (drone-wave-handoff §3; PLAN-CATERPILLAR §6). **Plain language,** no internal jargon
  (drone-wave-handoff §3).
- **The hymn-lab is the owner's listening checkpoint for the composer** (§14.2, "the owner hears it in
  hymn-lab first"); §15's lesson: frame each packet honestly by how much is new to hear. **The comments
  carry the rules;** when a rule changes, fix every comment that states the old one (CLAUDE.md; README;
  SCORE §13).
- **2026-10-01 — Housekeeping at the owner's request:** the harness tracked, CI, one number for the Whole
  switch (`kolob-meeting.js` `CUMULATIVE_ODDS: 0.08`, read by the page through
  `KolobAudio.getCumulativeOdds`), the shelf (SCORE §13). **Dev switches for the owner:** Latin labels "so
  the owner can debug" (`kolob-ui.js`); `?guest=<name>` for the listening packets; the
  experiments' DEFAULTS are "the owner's switches" (`kolob-experimental.js`).

## Shelved and declined

- The bagpipe (2026-09-13) and the Question (2026-09-27), with the Question's askers, the cornet's 55 %,
  §8.1 and Phase 1 — `shelved/` (`kolob-question.js`, `kolob-question-setpiece.js`); its dice still
  thrown in `kolob-meeting.js`. The pin drop (§14.5) and the
  invocation that prays (§15.1): declined. Engraving directions B and C; on the page, rubrics, words, the
  gilt strike, 8va signs, captions, the band's time figures, the telegraph's tape and word, pulse
  animations, the drone's bar, the running head.
- Desks (pews sharing a throat): a documented fallback, never planned (`kolob-voices-vocal.js`).

## Open questions the owner has reserved for their ear

*From handoff/listen-r3c.md "Things left for your ear", listen-r3b.md and the code's own "for the owner's
ear" notes. None has been heard: rounds 3b and 3c were measured, not listened to.*

- **Levels.** Every level since round 3 was set by measurement against the organ reference, not by ear (the
  cast's `INHALE`, `FRIC_PEAK`, `kolob-voices-vocal.js`; `UNDER_WARD_DB`, `kolob-voices-organ.js`;
  `WARD_LEVEL`, `kolob-core.js`).
- **The band's share:** the band 35 %, every other guest together about 25 % (`kolob-calendar.js`
  `GUEST_ODDS`, row `bands`). **Every other guest's odds are "a starting point, for the owner's ear":** the
  trombones (`kolob-guest-trombones.js`, base 0.21, "0.27 is about one meeting in six"), the
  handbells (`kolob-guest-handbells.js`), the far ward (`kolob-guest-farward.js`), the gulls
  (`kolob-guest-gulls.js`), the handcarts (`kolob-guest-handcart.js`), the gift
  (`kolob-guest-tongues.js`), the variations (`kolob-guest-variations.js`), the singing school
  (`kolob-guest-singingschool.js`).
- **The Hosanna:** the shout's brightness (`SHOUT_EFFORT`, `SHOUT_FRIC`, `SHOUT_H_SWELL`,
  `kolob-guest-hosanna.js`); whether it gives way to a guest beside its doxology (`YIELD`, false today, "crew C's ruling, which the owner may reverse"); the hymn's consonants
  (`HYMN_CONSONANTS`).
- **The far ward's voices:** 24 throats of its own, or eight pews of three (`material.voices: "desks"`,
  `kolob-guest-farward.js`). **The testimony:** whether a speaking voice without words reads as a
  person bearing testimony.
- **The band's sliding layer:** at the band's own pace across our ink, or scrolled with the page
  (r3c-engrave-2, Requests 1; `kolob-viz.js`).
- **The drone's landing** rubs in about half the turns (53 %); the lever is to land the glide on the next
  rite's first chord; `RECKON_CANDIDATES` (`kolob-calendar.js`, 24) sets how many Sundays reckon. **The
  Tabernacle's men's verses** come out mostly in unison (listen-r3b).
- **Johnston's tuning marks** (`kolob-viz.js`); **the sparer staff** (§15, "may come back later").
  **The house choir A/B waits for the owner's choice** before the loser retires (`?choir=house`,
  `kolob-core.js`). **The house organ is retired** (2026-10-01, "let's ditch the old organ"): the pipes
  play every chord; `organPartLine` stays as the house choir's organ.
- **What to scale back:** the far ward in pews, the Hosanna without the Primary's children or on a smaller
  registration, fewer second bands (listen-r3c "Where to save"). **The caterpillar:** "a few more passes";
  nobody has watched it move at full frame rate (handoff/caterpillar-1.md:287).

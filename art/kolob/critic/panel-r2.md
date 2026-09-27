# Round 2 review panel

## listener

## The Listener, round 2: build `kolob-r2-engine` `f2184ca` (footer `e508d4`)

**I cannot hear.** Everything here comes from muted captures and measurements. The owner's ear decides.

**What I measured.** All captures used `tools/capture.js`, muted:
- **Six seeds, 0:00–4:00:** 1847, 48, 16, 5, 77 and 2026.
- **One whole meeting:** seed 27, 0:00–15:35.
- **Capture quality:** every sample was captured, with no dropouts, the audio clock ran at 1.000× and every console was clean. The browser matched the harness note for note.
- **Other inputs:** harness dumps for the same seeds, 12 seeds compared A/B against live v0.32, and 24 meetings with the trombones forced.

**How to read the loudness figures.** They are −16 to −18 LUFS with an LRA of 2.4–4.5 LU. In every minute that number mostly measures the drone: the band below 100 Hz sits at about −21 dB the whole time. So I read the music's shape from the **300 Hz–4 kHz band** instead.

### The best 30 seconds
**Seed 27, 13:36–14:06: the bands cross over the doxology.**
- It is the loudest stretch of the meeting (−15.6 dB rms) and the brightest (above 4 kHz: −50 dB, against −80 in the sacrament).
- It comes straight after a quiet 10:46–12:54 sacrament (mid band −42), so it lands as the payoff that stillness earned. Ives in a meetinghouse.
- On seed 77 at 3:45 the band is again the brightest 15 s of any four-minute capture (1–4 kHz −24.5; the spectrum's balance point, its centroid, is 562 Hz).

**The runner-up, and this round's own best moment: seed 1847, 0:14–0:44.**
- The near choir answers, the far choir joins the last chord at 0:33.5, and at 0:40 the house comes back.
- At that return the mid band rises 9 dB and the centroid moves from 116 to 242 Hz. It reads like a sunrise.

### Does the trombone choir sound like dawn over a town?
**The staging does; the tune doesn't yet.**

**The distance cues are real (seed 1847):**
- The far choir is 6–8 dB under the near one at 300 Hz–1 kHz and 10–20 dB darker at 1–4 kHz, with nothing above 4 kHz.
- The far choir sits left (+7 to +9 dB) and the near choir right (−3 to −5 dB).
- The house really does rest.

**It is quiet against the room:**
- The near choir measures about −31 dB in the mid band, against −24 dB for the house that follows it. The far choir is at −37 to −39 dB.
- The drone swells up over those same first 15 s.
- Worth trying the near choir 4–6 dB louder.

**The tune is one phrase, echoed:**
- Across the 24 forced chorales, the top line uses a median of 5 different pitches.
- 75 of 117 phrases share their first five notes with another phrase.
- Seed 1847 is re-do-re-mi-re-do four times, spanning a fourth, 30 s in all.
- It sounds like an echo game rather than a chorale. The cure is the hymn composer.

**The pace:** the median beat is 1.07 s, but fast Sundays run 0.52–0.60 s a beat (1847, and forced seeds 3 and 5). That is brisk for a dawn chorale; I suggest a floor of about 0.9 s.

**An out-of-tune entrance on seed 1847 at 0:06–0:10:**
- The organ's opening V chord, held from 2.7 to 10.3 s, sounds D at 295 Hz. The far choir enters on D at 290–291 Hz.
- The two are at equal level (51 and 48 dB at 290/295 Hz; 45 and 46 dB at 145/147 Hz) and a comma apart, so they beat for about 3 s. This is exactly where the packet sends the owner.
- "The house listens" only means it starts no new turns. Held notes keep ringing: in 17 of 24 forced chorales an organ chord is still sounding 1.6–8.1 s into the far choir's entry, and in 3 of them it clashes by a comma.

### Does the old tune sound like a real remembered hymn?
**By its notes, yes.** ASSEMBLY (seed 16 at 0:18) and MARTYR (seed 27 at 0:14) are the book's pitches and rhythm. Two things blur that:

1. **The voice cannot re-strike a repeated note.** `farVoice` (kolob-guests.js:630–679) glides into every note and dips its level only at breaths.
   - Seed 16: at 0:21.17 (re–re) and 0:24.63 (do–do) the level stays flat within ±1 dB.
   - Seed 27: MARTYR's "Praise to the" (do–do–do at 14.80, 15.70 and 16.38 s) is one 1.8 s swell. Its signature dotted pickup is gone, and most of it sits inside the 1.2 s fade-in.
   - Across the pool, 76 of 367 steps in the tunes' first two lines are repeated notes, and 18 of 21 tunes have one within the first four notes.
   - The voice itself is unchanged from v0.32, but now that the tunes are real, this matters.
2. **It isn't faint.** It measures −25 dB in the mid band, as loud as the hymn (−28), and it sits about 15 dB to one side. Only the second try is fainter (−31).

### Where it drags
1. **The invocation, on every seed, from about 1:20 to 3:00.**
   - No guest can sit there now; the Question was its only one.
   - A pitched voice is sounding in only 36% of it (median), against 57% on live v0.32.
   - In the captures the mid band falls 15–35 dB for 60–100 s. On seed 5 it reaches −42 to −62 dB between 1:30 and 2:45.
   - That is half of the three minutes that are supposed to carry the day's identity.
2. **Hymns that hold back the choir.** In 12 of 33 hymn sections the choir's first note comes more than 20 s in (v0.32: 6 of 35). Seed 1847 waits 67 s, from 3:03 to 4:10, while the clarinet and harmonium trade motifs.
3. **The sacrament** is pitched only 6–22% of the time. On seed 27 there are 3½ quiet minutes from 9:20 to 13:00. That hush pays off in the doxology, so keep it, but don't let it grow.

### Where it crowds
- **Not by note count.** The peaks are 17–21 notes at once, and they come from two organ chords overlapping at a joint (seed 27 at 1:11, seed 9 at 7:34, seed 77 at 8:42). That is the known rough edge.
- **By spectrum, yes.** The drone and its partials are the brightest thing in every spectrogram.
- **Seed 48:** rain at 0:16 and wind at 0:45 fall on the far choir and raise the 1–4 kHz band by 8 dB.

### Your decision on the tonic close
**Keep the final chord on I, but fix the chord before it.** In the 24 forced chorales that chord is:
- V or vii° in 5;
- IV or ii in 8;
- vi, a suspension, or I itself in 11.

Those last 11 are a landing, not a cadence. Re-voice the last two chords as V–I.

### Requests
1. **Trombones:**
   - release the house's held notes over about 1.5 s when the choir arrives;
   - try the near choir 4–6 dB louder;
   - set a floor of about 0.9 s per beat;
   - end on a V–I cadence.
2. **Old tune:** give each note onset a dip of about 50 ms, shorten the glide, bring the level down 6–8 dB, and start the first note at full level.
3. **For the owner and the Enrichment critic:** the invocation needs something.
4. **Packet:** lead with seed 48 or seed 7 for the trombones, not 1847.
5. **`capture.js`:**
   - report the 300 Hz–4 kHz level beside LUFS;
   - its "parting" line on seed 5 at 3:59 is an artefact of the window edge, and it is followed by an out-of-date explanation about v0.30.

*Scratch files are in /private/tmp/claude-501/kolob-r2-panel-listener/ (capA, capB, dumps, cmp, tb). I made no edits or commits, and my servers and Chrome are closed.*

Rubric: {"sophistication": "3. The plumbing is careful: the accompaniment plays the chord being sung, the amen waits for the breath, the choirs answer across the town, and the old tunes are the book's own. But the music the guests carry is thin: hymns poured from a motif, a chorale that is one phrase echoed, 82% plagal cadences, and trombone endings that land on I from vi or from I in 11 of 24.", "richness": "3. There are many colours and 0.85 guests per meeting, but every meeting has two near-empty stretches: the invocation (a pitched voice about 36% of the time, down from 57%, and it lost its only guest) and the sacrament (6\u201322%).", "variety": "3. Keys, modes, kinds of Sunday and guests all vary, and no two seeds are near-twins. But the first four minutes have the same shape on every seed: prelude, then a 60\u2013100 s dip to the drone, then the hymn at 2:36\u20133:21, with the same drone-dominated loudness (LRA 2.4\u20134.2 LU).", "joyful_novelty": "3. The trombones' staging, and the bright return of the house at 0:40 on seed 1847, are a genuine new moment, and the bands crossing on seed 27 at 13:36 still delights. But the trombones are quiet and melodically static, and the old tune's rhythm is smeared.", "kolobness": "4. It is hopeful, rooted in hymns and never dark: Moravian brass at dawn, minor chorales that end major, LDS tunes remembered. The ever-present hum and the long hushes pull toward stillness rather than rising light."}

## variety

# Variety critic, round 2: `kolob-r2-engine` at `f2184ca` (modules `c1ebb93aee`)

*Read-only review. I edited and committed nothing. My scratch files are in `/private/tmp/claude-501/kolob-r2-panel-variety/`. I launched no browsers or servers; everything ran through the Node harness.*

**What I ran:**
- `distinctness.js` on seeds 1–20 (180 s window, and again at 30 s and 60 s) and on seeds 21–40.
- `repetition.js` and `tally.js` on seeds 1–20 at 1200 s. All 20 harness verdicts PASS.
- A 400-seed pass over the first 5 s of each meeting (`open/`).
- Scripts: `audible.js` recomputes D without the label-only features, `opentwin.js` measures how alike the openings are, and `side.js` prints two seeds side by side.

## 1. Near-twins
- **The tool finds none.**
  - Seeds 1–20: median D 0.585, 5.5× the planted twin, closest pair 8/12 at 0.357.
  - Seeds 21–40: median 0.564, 9.2×, closest pair 24/34 at 0.295.
  - At a 30 s window: median 0.551, closest pair 5/17.
- **Some of that distance comes from labels, not sound.** The kind of Sunday and the three gesture *names* are both announced at 0.1 s. Together they carry about a fifth of all distance, even in the 30 s window, before any gesture has been heard.
  - Without them, seeds 8/12 fall under the tool's own twin line at 180 s (0.257 < 0.5 × median = 0.274).
  - At 30 s, six pairs fall under it: 9/19 (0.164), 5/17, 11/12, 12/19, 10/14 and 12/18.
- **Twins you can hear:**
  - **`?seed=4` and `?seed=15`, 0:00–0:16, sound the same.**
    - Both have a 69 Hz drone at 0:00.1, then the same five-voice open fa–do chord (46/92/138/184/276 Hz) at 0:02.7, 2 ¢ apart.
    - Yet one is a mixolydian conference and the other an ionian ordinary Sunday.
  - **Seeds 9 and 19 share about 25 s.**
    - They play the same two organ chords in the same voicing (0:02.7, then 0:16.4 and 0:20.1).
    - Each has a field tone on do at 0:16.2 and the strings on do–sol–do′ at 0:24.2.
    - The two are 34 ¢ apart.
  - **Seeds 24 and 34** (58 ¢ apart, both ordinary, no guest) drew the same three gestures with the same theme, ensign peak. That is chance: over 400 seeds gesture use is uniform (χ² 30.9 on 26 df).

## 2. What is the same in every meeting
- **The valley wakes on the same timetable** (`kolob-core.js:966–977`).
  - Fixed entries: drone at 0:00.1, organ at 0:02.7 (400 of 400 seeds), a field sound at 0:16.1 (20 of 20), strings at 0:24.2 (18 of 20; the 2 exceptions are the trombone seeds).
  - The harmonium, clarinet, bells and telegraph each get their first turn at a fixed second: 30.2, 34.2, 42.2 and 55.2.
- **The first chord is almost always a bare fifth.**
  - 358 of 400 first organ chords have no third, and four voicings cover 71% of seeds.
  - 13.8% of random pairs of visits open on the same chord relative to their key (one return visit in seven).
  - 1.55% open within 25 ¢ in absolute pitch (one in 65).
  - The strings at 0:24.2 are always an open fifth or octave.
- **The keynote sits in a narrow band.** `F0 = rnd(58, 74)` puts every keynote between B♭3−4¢ and D4+13¢, a window of 4.2 semitones. In 43% of pairs the keynote does not separate the two seeds.
- **The same instruments every time.** All ten standing layers play in 20 of 20 meetings.
  - "Wind off the benches" is heard in 20 of 20, 6.2 times per meeting.
  - Six of the eight field sounds turn up in at least 16 of 20 meetings.
- **The same form.** Every meeting runs prelude → invocation → hymn.
  - The first hymn starts at 144–193 s (median 2:53), so the choir, the voice that carries the most identity, barely reaches design law 2's three-minute window.
  - Every meeting ends on a plagal cadence (20 of 20). That is the kept plagal amen; the rut is the 80.5% plagal share inside the meeting (plan: 30–55%).
- **Fast Sundays are over-drawn.** Meeting 1's season die is `rnd(0, 0.3)`, the trough of a cosine built for multi-meeting sessions that the plan has since dropped.
  - Over 400 seeds, meeting 1 is fast 36% (plan ≈ 15%), ordinary 40%, conference 18% and jubilee 7%.
  - Two visits draw the same kind of Sunday 33% of the time.
  - The fast Sunday is the leanest: 1 hymn, a choir of 2, silence ×1.7, about 12.5 min. The same bias makes the "plain" temper 32% of meetings.

## 3. What recurs too often
- **The melodic material itself does not repeat much.**
  - Only 3.2% of phrases repeat a shape their own voice sang earlier in the meeting.
  - 96% of the 1,480 shapes belong to a single meeting, and the most common shape of four or more notes is in only 2 of 20 meetings.
- **The band's march loop is the rut.** 47% of its phrases were heard before; seed 15 plays one 11-note figure ×11.
- **The trombone soprano repeats itself.** 25% of its phrases were heard before, because lines 1 and 3 are the same poured theme (seed 7).
- **The two trombone seeds are each other's nearest neighbour** (7/13, D 0.461). That's fine at about a 20% seat rate.
- **On the tonic close:** from a variety standpoint, I at the end is fine, because hymns close home. The variety belongs in how the chorale approaches that last chord, not in leaving it open.

## 4. What would most increase visit-to-visit variety next (ranked)
1. **Draw the prelude's waking per Sunday** (FORM and integrator; small). The prelude is half of the three-minute window and is currently fixed.
   - Draw from a new `prelude:<n>` stream so no other die moves: who enters first, who sits the prelude out, the gaps between entries, and whether the first organ chord has its third, an inversion, or no organ at all. These are the §7.4 seatings: organ voluntary, brush arbor, strings alone, bells.
   - The trombone seeds show the lever works: every entry moves (strings at 64–72 s).
   - Success test (`opentwin.js`): no entry time shared by more than 25% of seeds, and fewer than 5% of pairs opening on the same chord.
2. **Give meeting 1 the §7.1 calendar odds** (FORM; the interim is one line). Replace the cosine trough with plan weights, or at least `rnd(0, 1)`. That brings fast Sundays down from 36% toward 15%, and it adds richness too.
3. **Proposal for the Enrichment critic (needs the owner): the organist's prelude plays the day's first hymn on some Sundays.**
   - It would reuse `dawnChorale` on quiet flue stops. That is real LDS prelude practice, and it would announce the day's material before the choir enters.
   - Keep it drawn (about 40% of Sundays), never on withheld-tune Sundays, so it does not become the new fixed opening.
4. **Widen the keynote to about 7 semitones** (for example F0 52–78 Hz), once the harness has checked every voice's compass at both extremes.
5. **Tool requests** (to r2-tools):
   - Read `hymns-of-the-day.temper` into the empty style group.
   - Report an audible-only D (without the kind and the gesture names) and a 30 s window beside the default.
   - Seat the field per Sunday as weather: 2–4 of the 8 sounds, weighted.
   - Longer term, the dialects fix the plagal share and the cast fills the cast group.

## Rubric (1–5)
| axis | score | reason |
|:---|:---:|:---|
| Sophistication | 3 | The chord timeline, the alto kept under the tune and the trombone chorale's clean voice-leading are real. But 80.5% of cadences are plagal and there are no composed hymns yet. |
| Richness | 3 | Ten layers, a field, and guests in 60% of meetings, with the trombones as a new colour. But it is the same orchestra every Sunday, 36% of first visits are the lean fast Sunday, and there is no cast yet. |
| Variety | 3 | The material and the pitch and tempo profiles differ (no near-twins by the tool). But the first 30 s follow one timetable and a small set of bare-fifth chords, so one return visit in seven opens on the same chord. |
| Joyful novelty | 3 | The trombones at dawn (unheard, about 1 Sunday in 5) and the real Earth tunes are promising. 40% of meetings have no guest. |
| Kolob-ness | 4 | Open fifths over the drone, the valley's field sounds, the wire home, Moravian brass at dawn: hopeful and hymn-rooted, never dark. |

Rubric: {"sophistication": "3: the chord timeline, the alto kept under the tune and the trombone chorale's clean voice-leading are real, but 80.5% of cadences are plagal and there are no composed hymns yet", "richness": "3: ten layers, a field, and guests in 60% of meetings, with the trombones as a new colour; but the same orchestra plays every Sunday, 36% of first visits are the lean fast Sunday, and there is no cast yet", "variety": "3: the material and the pitch and tempo profiles differ (no near-twins by the tool), but the first 30 s follow one fixed timetable (drone 0:00.1, organ 0:02.7, field 0:16.1, strings 0:24.2) and a small set of bare-fifth chords, so one return visit in seven opens on the same chord", "joyful_novelty": "3: the trombones at dawn (unheard, about 1 Sunday in 5) and the real Earth tunes are promising; 40% of meetings have no guest", "kolobness": "4: open fifths over the drone, the valley's field sounds, the wire home, Moravian brass at dawn: hopeful, hymn-rooted, never dark"}

## eye

## The Eye: round-2 panel report on kolob-r2-engine f2184ca (footer e508d4)

**Verdict: pass on craft, but the page doesn't look finished yet.** Everything the engraving draws, it draws cleanly and within the owner's rules. The problem is what it doesn't draw. Round 2's two headline guests, the trombones and the old tune, leave the staff blank. So a trombone Sunday opens on an empty page for 40–75 s while the facade is at full height and the minutes are naming the trombones.

All checks were silent: muted headless Chrome on :8216/:9427, and the Node harness. The worktree was not touched; `git status` is clean. My servers and Chrome are stopped, and the integrator's :8114 was left alone.

### How it was checked
- `tools/screens.js`: seed 1847 (its natural trombones), at 8, 20, 34, 45, 70 and 150 s, at 860 and 390 px, 4× CPU throttle.
- A scratch driver (`eye.js`) for the forced guests, throttled 4× from each guest's entry:
  - trombones on seed 9, from 0:12;
  - bands on seed 1847, jump to the hymn, entry 30 s after the jump;
  - old tune on seed 10, KINGSFOLD from 0:15;
  - a hymn A/B on seed 9, this build against v0.32 from `git archive`.
- A what-if that re-served `kolob-viz.js` inside the browser only, with the trombones and the old tune turned on.
- Harness dumps of 8 seeds × 900 s (new and v0.32), measured with `ink.js` and `gap.js`.
- Evidence is in `/private/tmp/claude-501/kolob-r2-panel-eye/`.

### Owner's rulings: all hold
| Ruling | Result |
|---|---|
| Green ink only (the band is green too) | ✓ |
| No text on the staff (the only text call is the shelved Question's "?") | ✓ |
| No drone bar | ✓ |
| No tape and no decoded word; telegraph holes punched in the paper, centred, never under a note | ✓ (`tb9` +50 s, `bands1847` +32 s) |
| Bells are static ringed heads, no pulse | ✓ |
| Nothing clips the plate | ✓ |

- **Frame cost at 4× throttle:** p99 is 1.5–2.4 ms and the worst frame 6.5 ms. There were no long tasks, headless ran rAF at 16.7 ms, and the load average was 3.6–8.4 on 11 cores.
- **Page health:** consoles are clean and nothing scrolls sideways at either width.

### Findings, most important first
1. **[major] The trombones and the old tune are not engraved, so the page is empty at dawn.** From the harness at 860 px:
   - First ink arrives at 40 s on seed 1847, 55 s on seed 48 and 64 s on seed 4242. Without the trombones it is 24 s on every seed, as in v0.32.
   - The prelude is blank 48 %, 70 % and 84 % of the time on those three seeds, against 26–49 % in v0.32.
   - Forced trombones on seed 9 (0:12–1:15): the only ink before 1:17 is one telegraph message at 0:55.
   - Old tune on seed 10: KINGSFOLD sounds from 0:15 to 0:47. The staff shows one strings chord.
2. **[decision] The trombones can't simply be switched on; the old tune can.**
   - **The trombones don't fit the current layout.** Their notes span 61–328 Hz. The half-split rule puts S and A on ledgers under the treble and T and B on ledgers under the bass, with stems running through the gap and flags down at the transport buttons. See `wi-tb1847/` at 390 px, +27 s.
   - **What works:** far choir at 0.45 ink and near choir at full ink reads well.
   - **Recommendation:** staff by `part` (S and A on the treble, T and B on the bass) and write the chorale an octave above its sound, as the band's fife is already written an octave off. The page would then show the first hymn before anyone sings it.
   - **The old tune works now:** round heads at 0.5 ink, and 0.3 for the second try, read as a faint remembered melody in front of nothing. See `sheet-wi-old10.png`. Owner's call; I recommend both.
3. **[moderate] The invocation is an empty page.** It is blank 83–100 % of the time in all 8 seeds (100 % on 5, 12 and 77), because the organ's solo sections are not printed. PLAN-ENGRAVING §4.6 prints organ interludes. With the Question shelved, nothing else fills that roughly 90 s.
4. **[minor] At the crossing, the band's notes pass for the ward's.** The round head is almost the same shape as a sol head (ellipse tilts −0.36 against −0.26 rad), and at the crossing its ink reaches 0.8 (`bands1847` 860 px, +32 s). The band's barlines and stems also cut through the ward's heads, because they are not part of `placeColumn`. The band alone at +44 s reads beautifully.
   - **Fix:** cap the band's ink at about 0.45.
5. **[minor] Staff choice ignores `part`.** Every note now carries a part, but the half-split rule decides. A strings root at q14 (a treble line) is printed on the bass staff with three ledgers, in the telegraph's lane (seed 9, hymn jump, +30 s; crop `z-h30.png`).
   - It is rare: 4 of 4,132 heads are on the wrong staff, and 39 (0.9 %) have 2+ ledgers into the gap.
6. **[polish]**
   - The strings' three stacked breves read as a ladder. The plan asked for two heads a fifth apart, so drop the octave from the page.
   - A cue-size filled la on a ledger reads as a dash (`bands1847` +32 s at 860, +22 s at 390).
   - A hollow fa breve on the middle-C ledger reads as "H⊿H".
   - A phone shows about 3.3 s of music, so a hymn is one or two chords. This was already open.

**Density against v0.32 (the packet's question):** on average about 20 % more heads are visible (6.0 against 4.9; the busiest moment 51 against 42). Harmonium ink is 4–8× and strings 2–3×. In the hymn A/B this reads fine, not crowded, so keep it. Only the strings' octave should go.

### Requests
- **ENGRAVE crew:**
  - engrave the trombones and the old tune as in (2);
  - choose the staff by `part`;
  - cap the band's ink and bring it into `placeColumn`;
  - print the strings as the open fifth;
  - print the organ when it plays alone.
- **Owner:** engrave the trombones and the old tune, yes or no. The packet already asks about the trombones.
- **Integrator:** none. The tonic close is an ear question, not a visual one.

Rubric: {"sophistication": "3: The engraving is properly made: stems grow from the heads, note values and dots come from each note's length, a second voice is set aside, and the telegraph holes give way to notes. But it ignores the S/A/T/B parts the engine now reports (a strings note lands on the wrong staff; the trombone what-if is unusable), and it has no barlines or beams yet, so a hymn prints as separate chords.", "richness": "3: The meeting gained the trombones, real Earth tunes and a guest in 63% of meetings, but the page shows less of it. The trombones, the old tune, the organ and the drone are invisible, and the invocation is blank 83-100% of the time.", "variety": "3: The music's distinctness is good (median 0.585, no near-twins), but every trombone Sunday opens on the same empty staff, and each page has the same furniture. The variety is in the minutes and the sound, not the picture.", "joyful_novelty": "3: The band crossing at its own speed in round notes over the ward's shapes is a real Ivesian delight (seed 1847, forced bands, +14 to +44 s), and the punched holes are charming. The round's new delight, the trombones, is invisible on the page.", "kolobness": "4: Clear light, one green ink on cream, never dark, a hymnbook and not a screen. But a minute of empty staff at dawn looks like the page hasn't started, not like it is listening."}

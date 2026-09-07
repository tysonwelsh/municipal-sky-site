# ZANKYŌ — 逸脱 ITSUDATSU: pushing the far tail into interstellar space

*Plan, 2026-09-06. Branch `zankyo-far` from main (2.1.0-rc.1, live). Music
only: the interface does not change. The median night does not change. The
far tail does.*

The owner's brief, in substance: what we have is great — keep it. But push
the boundaries of the aleatoric generation so that the weirdest 5–10 % of
playthroughs go far beyond anything the engine can do today: one night in
twenty should make a listener say "this is something else." Stranger,
more experimental, more variable between nights — not necessarily harder
to listen to. Median unchanged. UI unchanged.

## 1. The mechanism: one seeded draw sets the night's distance

At PLAY, a new `PJ2.Rand` fork ("far") draws the night's **distance from
home** `d ∈ [0, 1]` from a heavy-tailed law:

| share of nights | d | the night |
|---|---|---|
| ~80 % | < 0.15 | home: today's engine, **byte-identical** (no other stream sees a new draw) |
| ~15 % | 0.15–0.7 | one or two departures, moderate |
| ~5 % | > 0.7 | far: several departures stacked; d > 0.9 (≈ 1 in 50) is "interstellar" |

Within a night the meta-tide may lift one cycle further out than the rest
(a home night can have one strange cycle; a far night can have one calm
one). Every departure below reads d and unlocks past its own threshold;
which departures a far night carries is itself a seeded draw, so two far
nights differ. Dev: `?far=0.95` forces d; the VFD names the night
(逸脱 · <name> · d 0.xx) so the owner can tell what they are hearing;
`?seed=` reproduces it exactly.

The **distance metric** (probe): pitch-class entropy and deviation from
12-TET, tempo variance and rate excursion, density variance, spectral
centroid/roughness of the master, form-shape deviation from jo-ha-kyū,
ensemble synchrony. One scalar per night. The gates in §4 are stated on it.

## 2. The departures (each seeded, each gated by d, each with a name)

**Pitch and tuning** 音律
- *Sagging clock* (d > 0.2): the octave stretches or compresses (1180–1230
  cents) — the field's tuning system leaves 12-TET; everything stays
  self-consistent, nothing is "out of tune" with itself.
- *Koto by ear* (d > 0.3): just-intonation tunings for the plucked bodies
  while the shakuhachi and hichiriki stay tempered — a real ensemble's
  disagreement, scaled up with d.
- *Meri quarter-tones* (d > 0.4): the shakuhachi's meri pitches and the
  in-sen semitone split into quarter-tones; ornaments walk them.
- *Two modes at once* (d > 0.6): bitonality — one voice in iwato on the
  tonic, another in in-sen a tritone away; the shō cluster straddles both.
- *The spiral* (d > 0.75): the tonic glides continuously (a few cents per
  second), Shepard-style — a key that never arrives; the drones follow.

**Time** 時間
- *Dilation* (d > 0.25): a cycle at 0.4× (glacial: a forty-minute jo made of
  single notes) or 2.5× (frantic), drawn per cycle; the clock's lanes do it.
- *Varispeed* (d > 0.5): the whole ensemble sags in pitch AND time together
  like a dying tape (−1 to −4 semitones over minutes), then snaps or crawls
  back; drones and reverb tails included.
- *Tempo canons* (d > 0.6): the same motif in koto / shamisen / biwa at
  duration ratios 3:4:5 (Nancarrow) — they converge, pass, diverge.

**Form** 形
- *Eroded arc* (d > 0.3): kyū-ha-jo — the cycle opens at the wall and
  decomposes; or a jo that never arrives; or a double kyū.
- *The KIRU fails* (d > 0.5): the cut does not come; the wall runs straight
  into the next cycle's jo, which is born inside it.
- *Disintegration* (d > 0.65): the station gets stuck — one motif fragment
  loops like a locked groove and decays (Basinski): each pass loses notes,
  gains grit, drifts in pitch, until only the room remains; then the next
  cycle begins from the residue.
- *Ma inverted* (d > 0.4): a cycle in which silence is the material and
  sound is the interruption — single events minutes apart.

**Ensemble** 合奏
- *Swarm* (d > 0.55): the air's limit is lifted and the motif engine runs a
  canon of 6–10 entries at short delays — micropolyphony (Ligeti) on a
  Japanese pentatonic.
- *Hocket* (d > 0.45): one melody split note-by-note across all voices.
- *Strict mirror* (d > 0.5): every phrase answered by its exact
  retrograde-inversion; the ledger enforces it.
- *Gagaku heterophony at scale* (d > 0.35): all five melodic voices read
  the same phrase at once, each in its own ornaments and lag.
- *Clouds* (d > 0.7): Xenakis — the plucked bodies as stochastic glissando
  clouds, hundreds of short notes on distributions, not phrases.
- *Polymeter* (d > 0.4): the taiko kit in 3 against 4 against 7 across its
  three drums; the pulse magnet pulls each voice to a different drum.

**Spectrum** 音色
- *Metal* (d > 0.35): ring modulation of the shō by the sub-drone; the
  bells and the koto through FM — inharmonic, gong-like, still pitched.
- *Reverse* (d > 0.4): envelopes reversed — plucks that swell, breaths that
  end in the attack; a tape played backwards.
- *Freeze* (d > 0.5): a shakuhachi note held into a drone for a minute
  (jittered sustained partials), the ensemble re-tuning around it.
- *Noise leads* (d > 0.6): the japanoise vocabulary becomes the soloist,
  claims the air, and the melodic voices become texture behind it.
- *The reel as the room* (d > 0.7): a two-second slice of a broadcast reel
  becomes the convolution impulse — the whole station played through the
  voice of Duck and Cover or the Buzzer. Audio only; the set stays dark.
- *Phasing* (d > 0.6): two copies of a signal's two-second window drift out
  of phase (Reich) instead of the normal tune-in/hold/loss.

**Composition** at d > 0.85 ("interstellar"): three or four of the above
stacked by a seeded draw with compatibility rules (no clouds + dilation
0.4×; no spiral + bitonality), a named night (渦 the vortex, 崩 the
collapse, 凍 the freeze, 鏡 the mirror, 塵 the dust …), and the VFD tells
the story as it happens.

## 3. What does not change

- The interface: nothing on the faceplate, console, set or log changes
  shape; the VFD only gains words.
- The median: at d < 0.15 the note stream is byte-identical to **the current
  release baseline** (named in the crew's STATUS). It was 2.1.0-rc.1 until
  §8.1 raised the broadcast seating rate on ordinary nights — a deliberate
  change to home nights, at the owner's ask — and the baseline was re-based
  on that commit. Home nights are byte-identical to the baseline; the
  baseline moves only when the owner asks for it and never as a side effect.
- Ceilings: master integrated within ±0.7 dB at any d; no layer peak
  moves; a harshness cap (master spectral centroid and roughness never
  above the current kyū wall's) so "weird" never becomes "painful".
- The character: still a derelict Japanese station; still no cheer, no
  ending; still seeded and shareable. The contract's "12-TET dark
  pentatonics only" is relaxed *at high d only*, and only toward tunings
  and modes with Japanese roots (just koto tunings, meri quarter-tones,
  bitonal pentatonics) — never toward Western triads.

## 4. Phases and gates

| phase | delivers | gate |
|---|---|---|
| W0 | the `far` fork and d law; distance metric in `_probe.js`; `?far=`; VFD naming; departure registry (no departures yet) | home nights byte-identical on 20 seeds; metric stable; REPRO |
| W1 | pitch/tuning + time + form departures | at `?far=0.8` the metric ≥ 3× the base p95; p50 over 40 seeds within ±10 % of base; ceilings |
| W2 | ensemble departures | same, plus node budget ≤ 90 % under swarm/clouds |
| W3 | spectrum departures (incl. reel-as-room, phasing) | same; harshness cap holds under metal/noise-leads |
| W4 | composition at d > 0.85, names, compatibility rules, the meta-tide's per-cycle lift | 1-in-20 nights ≥ 3× base p95 and 1-in-50 ≥ 5× over 200 simulated seeds; owner listens to `?far=0.95` on three seeds |

Each phase bumps VERSION (2.1.0-rc.2 …); the release is 2.2.0 — "the far
tail". Three rounds per phase; the critic holds the distance gates, the
ceilings, the harshness cap and byte-identity of home nights.

## 5. Owner addition: the hidden switch (W0)

A hidden switch on the machine — unlabeled, diegetic, not discoverable by
reading (a small toggle inside one of the chassis vents, or a screw that
turns; the designer's choice, but it must look like it has always been
there). Flipping it ON restarts the station and the night it begins is a
far one: the engine draws fresh seeds until the `far` fork yields
d ≥ 0.8 (a pure function of the seed, so cheap), rewrites `?seed=` in the
URL so that night is shareable, and plays. While ON, every restart is far;
flipping it OFF returns to the ordinary lottery. The switch itself shows
its state (a physical position, a faint glow); nothing else on the panel
changes. This is the one deliberate interface addition of this plan.

## 6. Owner addition: the transport plate loses its print (W0)

Remove the text on the transport plate under the second set — the
「操作 · TRANSPORT」 label and the 「TYPE 9-B · No. 2887-R」 stamp. The
buttons and the knob speak for themselves. Keep aria-labels. The plate's
metal, bolts and layout are unchanged.

## 7. Owner addition: the tuning dial (between W1 and W2)

A second knob on the CRT-9's chin beside the existing 選局 knob — a
tuning DIAL. Fidgeting it is what makes it work: as it turns, the tube
shows snow and the receiver band-noise rises with the motion (the feel of
sweeping a dial); once the cumulative rotation within a few seconds
passes a threshold (about a turn and a half), a real reel LOCKS IN
immediately — tune-in, hold, loss as usual — not at the next legal moment.
Works while playing (any time except inside a signal already playing or a
KIRU hush, where the dial only makes snow) and while stopped (an
audition). Rate-limit: one lock per 30 s; further fidgeting makes snow.
The existing 選局 knob keeps its behavior. Unlabeled like the first; same
size; it shows its position. Delivered as its own commit with a VERSION
bump; the critic checks feel (snow follows the hand), timing, ceiling, and
that a home night's note stream is unchanged when the dial is not touched.

**§7 addendum (owner):** while the station is STOPPED, the 選局 knob's
audition plays a FULL window of the reel (its whole 10–12 s, with the
complete tune-in / hold / loss gesture on the tube), not a two-second
tune-in. The new dial's stopped-state audition does the same.

## 8. Owner additions after the rc.9 listen (receiver; deliver while the critic holds the W2 turn)

The owner: "the direction we're going in" — and three changes to the
receiver, which is its own module and may be worked while W2 is under
review (zk-broadcast.js, zk-set.js, index.php/zankyo.css for the button;
never the engine files the W2 round is judging). Own commits, VERSION bumps,
reviewed by the critic in the same round.

1. **Signals more often, video favored.** Raise the seating rate from
   ≈ 1 per 3 cycles to ≈ 1 per cycle (still never two in a cycle, never in
   a KIRU or hush, the recent ring kept), and weight reels WITH a picture
   about 3× over audio-only reels in the lottery. The synthetic gagaku
   broadcast stays the fallback only. (Later, the owner intends to split
   audio signals and video signals into two kinds of visitation; for now
   one track, video-heavy.)
2. **The dial becomes a button.** Replace the §7 tuning dial with a push
   BUTTON on the CRT-9's chin (same footprint, unlabeled, diegetic — a
   worn square push-switch with a lens): PRESS → a real reel with a
   picture locks in at once (tune-in / hold / loss); then the button is
   COLD for a cooldown (45–60 s, seeded jitter) during which presses do
   nothing but a click and a flicker of snow; when it is ready again its
   lens glows faintly. Works while playing (except inside a signal or a
   hush) and while stopped (a full-window audition). The 選局 knob is
   unchanged.
3. Attribution and the log lines unchanged.

## 9. Ruling: the far target is pinned (2026-09-06)

The base's own tail compresses as the owner asks the receiver for more
broadcasts, so a target re-derived as "3× the current home p95" gets easier
every phase. The far target is therefore PINNED at the original numbers:
far p95 17.4 (3× the 2.1.0-rc.1 home p95) and the W4 1-in-50 at 29.0 (5×).
Identity re-bases and home-only calibration continue; only the target is
fixed.

## 10. Owner ruling: a little pain is allowed (2026-09-07)

The owner, having heard far nights from the crew's captures: "I'm okay with a
little bit of pain … some noise is good … let's not go overboard." So the
harshness gate is TIERED by distance, and the loudness ceiling stays hard
everywhere (nothing gets louder to sound stranger):

- d < 0.15 (home): unchanged — byte-identical, the tripwire as it stands.
- 0.15 ≤ d < 0.7: the roughness tripwire as ruled (≤ 0.25 absolute, ≤ home
  + 0.07).
- 0.7 ≤ d < 0.85 (far): the tripwire loosens to ≤ 0.35 absolute, ≤ home
  + 0.15. 騒 noise-leads and 金 metal are expressly allowed to be abrasive
  here; the centroid gate stays (darker, not brighter).
- d ≥ 0.85 (interstellar): no roughness gate at all — only the master
  loudness ceiling, the peak cap and the owner's ear at the W4 listen.
  This is where the noise is meant to live.

Nothing above changes how OFTEN far nights occur.

## 11. Owner addition: tuned signals (deliver with W3's 室, before W4)

Reels that carry a sustained pitch — chant, drones, horns, tones, hums —
should sound IN TUNE with the station when they are picked up.

1. **Measure at cut time.** `make-reel.sh` gains a pitch pass: for each
   window, the dominant sustained pitch (a simple autocorrelation or
   ffmpeg-side estimate is enough; only windows with a stable pitch get a
   value) is written to the manifest window as `pitchHz`, and the reel gains
   `tuned: true|false`. The librarian back-fills the existing pool.
2. **Bend the reel to the station** (the default). When a tuned signal is
   seated, the receiver chooses the window whose pitch is nearest the
   current field's tonic or fifth, then sets the media element's
   playbackRate so that pitch lands exactly on that degree — capped at
   ±4 semitones (a rate of 0.79–1.26); beyond the cap the window plays
   unbent. Tape-style: pitch and time move together, which is the
   receiver's own idiom. Log 「同調 · tuned +2.1 st → D」.
3. **Bend the station to the reel** (far nights only, d ≥ 0.5): for reels
   tagged `tone: drone` or `sung`, the engine may instead schedule a sea
   change toward the reel's pitch as the signal tunes in, so the
   shakuhachi and the shō answer the chant in its key; the reel then plays
   unbent. Never during a KIRU hush; never on home nights.
4. Untuned reels (speech, noise, static) are untouched.

## 12. Known open defect, accepted on the record (2026-09-07)

On ~8 % of seeds (2 of 25 measured), 2–6 melodic notes sound over a
broadcast the air hold exists to protect. Mechanism: long-note bodies
(hichiriki, biwa) commit notes 33–46 s ahead, while the receiver writes its
hold only ~15.5 s before t0 (HOLD_LEAD_S 6 + the fire lead); the claim was
valid when made. Pre-existing, bounded, live since the receiver shipped.
Any fix changes the byte-identical home stream, so it is deferred to the
next DELIBERATE re-base, which is declared here: **the first commit of W4**
(W4's per-cycle meta-tide lift already touches home nights, so W4 opens
with a re-base by construction). Fix at that point: the hold written far
enough ahead to cover the longest lookahead (≥ 50 s) or the claim path
checking planned holds, whichever the coder judges cleaner; the critic
re-derives the base at that commit. Seeds and signatures are in the coder's
W3 handoff.

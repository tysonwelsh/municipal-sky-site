# ZANKYŌ — roadmap

*The living list of what comes next, in the owner's priority order. Each
item becomes its own PLAN-*.md and its own crew when it starts; nothing here
launches without the owner seeing the plan first. Updated 2026-09-07.*

## Shipped (for orientation)

- ZANKYŌ 2 (PLAN-ZANKYO-2.md): substrate, the air, cycle plans, real rooms,
  sea changes, born seeds, aitake, new bodies, visitations, the mix pass.
- The second set and the receiver (PLAN-SIGNAL-INTEGRATION.md,
  PLAN-BROADCAST-SIGNAL.md): reels in the hull, the picture on the CRT-9,
  the tune knob and the push button.
- The pool: 207 reels from 81 countries (PLAN-REELS-3.md), raw sources kept
  at ~/Media/zankyo-broadcast-src.
- The far tail (PLAN-ZANKYO-FAR.md): W0–W3 live; W4 closing.

## Next: instrument diversity and melodic DNA (after W4 and the owner's listen)

The owner's read after living with ZANKYŌ 2: the additions are good, the
far tail is good, but the *instruments still sound like the same
instruments every night*, and the two freshest sounds on the panel are
ambient one-shots. In priority order:

1. **More melodic DNA.** The seed-phrase vocabulary is twelve authentic
   gestures plus born ones — small for a station that plays forever. Grow
   it substantially: more authentic gestures per tradition (honkyoku,
   sōkyoku/danmono, jiuta, Tsugaru, gagaku tōgaku/komagaku contours,
   min'yō, kagura, Buddhist shōmyō), per-mode vocabularies (an in-sen
   phrase is not a hirajoshi phrase), a richer improviser (longer-range
   contour plans, tendency tones per mode, phrase-final formulas), and
   rhythm DNA (ma patterns, breath lengths, taiko-derived cells) so the
   melodies differ in time as well as pitch. Measure it: distinct-phrase
   counts per hour, and a listener-facing "have I heard this before" gate.
   *Shipped 2026-09-13 (rc.64, PLAN-MELODIC-DNA.md): forty gestures across
   eight traditions, mode-aware lottery and improviser with contour plans
   and cadences, rhythm cells (taiko-derived ones included), `rerhythm`,
   ma patterns; the harness measures shapes/h and heard-before; a
   deliberate re-base (`_harness-bank.js`). Breath-length DNA per night
   is the part left open.*
2. **A family of bodies per instrument.** Each voice gets several
   incarnations drawn per night from the seed — pluck material, string age,
   register, decay, breath, reed — so the koto is a different koto on
   different nights and the shakuhachi a different flute. Not new
   instruments; the existing ones with more than one body. Audition bench
   per family. *Plan written 2026-09-14: PLAN-BODIES.md (synthesis only, so
   no re-base; strings first, then winds, shō and kit, then the intercom).*
3. **The fūrin (wind chime) promoted to a voice.** A small set of tuned
   tubes in the current mode, driven by the weather field (a wind parameter
   for density), a landscape voice with its own console row, no air claim.
   *Shipped 2026-09-13 (rc.63): the weather gained a `wind` channel, the
   chime its own stream and row; the ambient one-shot left the pool with
   it. No re-base — nothing already seeded moved.*
4. **The comms vox promoted to a voice — the broken intercom.** A second
   speaker beside the PA: stuttered formant syllables that follow the motif
   engine's contours, seated in the air and the ledger like a melodic voice,
   as sophisticated in what it plays as the others; knobs for band, stutter,
   how much of a word survives; a natural carrier for 相 phasing and 騒
   noise-leads on far nights. *Shipped 2026-09-14 (rc.66 the body, rc.67
   the voice; PLAN-COMMS-VOX.md): 内線 Intercom — sung formant syllables
   on the motif engine's contours, band / stutter / survive, the newborn's
   name for its vowels, seated in broadcast cycles, the 回線 line's second
   speaker, a 相 comb on far nights; the one-shot left the pool; a declared
   re-base.*
5. **The ambient pool grown** with the station sounds Phase 3 promised and
   never built: hull groans, airlock hiss, a numbers-station murmur, distant
   thunder, more of the derelict's own noises; phase- and kind-gated, rarer
   ones rarer. *Done 2026-09-13/14: six candidates went to the Bodies Lab;
   the owner seated distant thunder and relay chatter (rc.62) and dropped
   hull groan, airlock, numbers station and pipe knock (removed).*

## Shipped since: the shapes of a reception (2026-09-14)

PLAN-SIGNAL-SHAPES.md. The owner's observation — every signal the same
length, one with no relation to the next — answered in four phases:

- **R0** a reception became one plan object, proved by changing nothing
  (32/32 home nights byte-identical).
- **R1 (rc.69)** the on-air budget, the frequency (1.7×: ~25 signals an hour
  against rc.68's ~15), the drawn 15–90 s quiet, per-reception air holds, a
  receiver queue and a pair of media elements. A declared re-base.
- **R2 + R3 (rc.70)** the shapes — 常 戻 断 走, 即 探 浮, 切 残 絶, the 同
  callback — and the air that opens between the pieces and over three
  receptions in ten. A declared re-base.
- **R4** the tooling: `make-reel.sh --add-windows`, `tools/pool-shapes.py`,
  the §5 recipe in `broadcast/CURATE.md`, and one reel re-cut as a proof.

**What is left, and it is the owner's ear that decides it:**

1. ~~**The long windows.**~~ **Done 2026-09-14 (rc.73):** 183 of 208 reels
   re-cut with one long window each (18–40 s, Tier B capped at 30). The owner
   waived the audition — "an element of chance and randomness is to be
   expected (and desired)". Two reels refused by name, both densely encoded
   enough that the 2 MB cap would have cost them more material than the long
   window gained; 23 had no cached analysis to propose from. The pool went
   1 349 → 1 392 windows and 144 → 166 MB. What it did to the sound: the
   median reception went from 9.0–9.6 s on air to 16.6–20.6 s, the degrade
   ladder stopped running (`degraded {}` on five of six seeds), and the
   achieved spread now tracks §2's table instead of collapsing into its first
   bucket. The 32–40 s bucket is the one still thin — 14 reels against a 15 %
   ask — because Tier B is capped at 30 s and is three quarters of the pool.
   That is the owner's own ruling, so it is a ceiling rather than a defect.
2. **R5, the listen.** Seeds 3042 / 7 / 17 through the console and the reel
   lab; the weights in §3.6 and the table in §2 moved to taste. They are all
   in one block at the top of `zk-broadcast.js`, beside `BC_PER_S` and
   `BC_SIL_*` in `zankyo-audio.js`.
3. **Peak concurrent sources.** Home nights peak at 102 across twelve seeds,
   against a bound of 110 (rc.68 was 100). Eight of headroom on the tightest
   budget the station has — the price of 1.7× the receptions. The next change
   to the receiver's graph should read that number first.
4. **A PRE-EXISTING FAULT, still open: seed 3042 at d 0.9 peaks at 112
   concurrent sources, over the hard bound of 110.** rc.68 reads 113 on the
   same seed, so this predates the reception work and is marginally improved
   by it, not caused by it. One seed of fourteen far nights; every other far
   seed is under 100. It belongs to the far tail's node budget rather than to
   the receiver, which is why it was not fixed here — but it is a failing
   invariant and the harness says so on every run of that seed.

## Shipped since: reels round 5 (2026-09-25, rc.104)

102 reels from the round-4 bench (REELS-R5.md): Taiwan, Korea, the Netherlands,
Estonia, Japan (science films, NHK, and prewar silent prints), China, NO-DO,
France and Galicia, Türkiye, Czechoslovakia, Arctic Canada. Silent prints are
allowed and release the air (默). Every test card in the pool and in the new
sources is registered in `broadcast/testcards/` for a separate use still to be
designed. Open: Norway (a fetch the owner has to rule on), Aparat (by hand).

## Later

- **Audio signals and video signals as two kinds of visitation** (the
  owner's stated intent; today one lottery, video-weighted 1.5×).
- **Letters to five archives whose newsreel answers correspondence, not
  fetches** (found by the reels-4 source scouts, 2026-09-14; the owner said
  yes to writing): the Thai Film Archive (fapot.or.th — tens of thousands of
  newsreels, ads, home movies, educational films, reachable only at Salaya or
  by letter); Indonesia's *Gelora Indonesia* 1951–1976 weekly newsreel at
  ANRI (anri.go.id — catalogued item by item, no player); Zimbabwe's
  National Archives (archives.gov.zw — 250 digitised hours of Central African
  Film Unit newsreel, 1948–63); the Uganda National Media Archive at UBC
  (ubc.go.ug — UNESCO-listed, 1947–86); and Angola's Tchiweka archive
  (tchiweka.org — liberation-era film on its own portal, in Portuguese,
  small enough that a polite email would probably open it). Draft the
  letters in the archive's language, state what ZANKYŌ is and how a reel
  is used (4–40 s, 192×144, degraded, credited, takedown on request), and
  ask for viewing copies of the newsreel runs. Register rows and the
  scouts' notes: `broadcast/sources/sea.md`, `sources/africa.md`.
- **Reels round 4:** the ~200 unused African shortwave airchecks; Italy
  deeper; the beats' banked candidates in the reels-3 queues; Kaesong TV if
  a recording ever surfaces; the Voice of Kenya 1982 broadcast if the pool
  ever takes on heavier material as a class.
- **Console rocker, second look** (the owner: "fine for now").
- **The listener-facing constants**, once the owner has listened: the
  1-in-12 home lift, its Poisson mean λ = 5, the jo share P(jo) = 0.20, the
  video weight 1.5×, the ambient and hichiriki defaults.
- **A mobile listen** of the second set and the button on a real iPhone
  (media-element priming inside the PLAY gesture is unverified on a device).
- **2.2.0 release**: drop the -rc, semver from there.
- **390 px overflow:** the panel overflows a 390 px viewport by 116 px
  (predates the far tail; unchanged by rc.47). Fix if a phone width is a
  real target — it is, since the second set is "the event" on a phone.

# KOLOB 2 — THE ENGRAVING

*A plan for the staff visualization. Draft 2, 2026-09-26.*

*Owner decisions so far:*

- *keep the telegraph in the middle, drawn as punched paper tape;*
- *mockups of A, B and C are commissioned (`mockups/engraving-a-tunebook.html`, `engraving-b-reformed.html`, `engraving-c-spectrum.html`), all engraving one shared passage (`mockups/engraving-passage.js`);*
- *red ink, words between the staves and the band in round notes will be judged from the mockups (each has toggles for them).*
*The companion plan is [`PLAN-COMPOSITION.md`](PLAN-COMPOSITION.md).*

**Scope.** The scrolling grand staff (`#kolob-viz`, `kolob-viz.js` `printNote`,
`stampMark`, `buildStaffLayer`). The wheel and the organ facade stay exactly
as they are.

**Process.** This plan proposes three directions. **No build starts until
the owner has seen mockups and chosen one.**

## Owner's decision (2026-09-26): Direction A, "The Colony Tunebook"

The build reproduces `mockups/engraving-a-tunebook.html` (in the main
checkout; copied to this branch when the ENGRAVE crew starts) with these
settings:

- **Scroll speed: 60 px/s** (today's is 11).
- **No rubrics.** No vermilion ink anywhere. Directions, the Question's
  cartouche and captions use green and gilt only.
- **No words.** No Deseret underlay between the staves. §4.3's words and
  PLAN-COMPOSITION §6.5's underlay are shelved for the page (the choir may
  still sing phonemes later). Without words, the gap between the staves
  can shrink back toward a normal grand-staff gap, with the telegraph tape
  centred on the middle line.
- **Telegraph: punched tape in the middle, with no decoded word.** The
  Deseret word printed on the tape's tail is struck.
- **Kept from A:** the four shapes, stems, flags, beams and dots; SATB closed
  score; barlines; fermatas; the breath comma; Johnston "−" and "7"; the
  gilt strike cooling to green; the ringed bell with 8va; the hymn running
  head.
- **No drone on the page.** The drone's longa and bar in the lowest bass
  space are struck; the drone is heard, not engraved. §4.6's drone and
  Kolob-cantus rows are withdrawn.
- **The band** in round notes on its own layer (it fires in a minority of
  meetings). The Question's cartouche and empty measure are drawn in
  green and gilt.
- **Directions B and C are not pursued.** Their mockups stay in `mockups/`
  for reference.

---

## 1. What's wrong today

From the code and headless screenshots of v0.30 at 860 px (seed 1847):

1. **Hairline, uneven ink.**
   - Heads are stroked at 1.2 px, stems at 0.8 alpha, ledgers at 1 px.
   - Each layer has its own size factor (0.6–0.92) and alpha (0.45–0.95).
   - The result reads as sketched, not engraved.
2. **Stems don't belong to their heads.**
   - They start from the head's bounding-box edge, not from anchor points.
   - On the hollow triangle (fa) and the diamond (mi), the stem floats off
     the corner or runs through the outline.
3. **Nothing about time is visible.**
   - A note is printed only at its onset; the only duration cue is
     hollow (≥ 1.6 s) or filled.
   - There are no beams, flags, dots, ties, rests, barlines, fermatas or
     phrase ends.
   - You see *where* pitches are, not *what melody* was sung.
4. **Parts are indistinguishable.**
   - S, A, T and B, the clarinet, harmonium and bells all print the same
     shapes in the same ink.
   - The only differences are small size and alpha changes.
   - Chords are scattered heads at nearly the same x, not stacked on one
     stem.
5. **The grand staff reads as one tall ladder.**
   - The gap between the staves is two staff spaces; engraved hymnals use
     about 4–6, and put the *words* there.
6. **Ink escapes the plate.** High ledger notes print into the horizon rule
   and under the organ facade.
7. **The telegraph collides with the music.**
   - Its dits and dahs ride the middle-C line, right through the melody's
     register.
   - They are plain dots and bars, with no sense of tape, wire or message.
8. **Guests are nearly invisible.**
   - The fuging entry is a lone "⁂".
   - The two bands are deliberately never engraved ("not one of ours").
   - The question, the steeples and the old tune print as ordinary notes.
9. **No depth.** Flat single-alpha fills with no impression, no light and no
   difference between a note being sung now and a note drying.

Items 3 and 4 **cannot be fixed in the visualization alone.** The engine
emits pitches, not a score. `PLAN-COMPOSITION §2.3`, **the Score**, is the
prerequisite: once the engraving reads the Score, it knows durations, parts,
phrases, cadences, syllables and tuning, and can print them accurately.

---

## 2. The premise: notation after three thousand years

Shape notes were themselves a **notation reform**:

- Little and Smith's *The Easy Instructor* (1801) gave the pitch syllables
  shapes so that ordinary people could sing at sight.
- The **Deseret Alphabet** (1854) was a *spelling* reform by the same people
  whose hymns Kolob sings.
- Tonic sol-fa, Aikin's seven shapes (1846) and Ben Johnston's
  just-intonation accidentals (1960s) are all American or American-adjacent
  attempts to make notation tell the truth about the music.

So the colony's notation, three thousand years on, would be **the
continuation of that reforming impulse**:

- still a staff and still shapes, because tradition keeps what works;
- shapes that have kept evolving;
- durations drawn the way they sound;
- the tuning written down *exactly*, because the colony sings in pure
  intervals;
- words sung between the staves in their own alphabet.

The tension the owner wants — novel but rooted — is the tension of every
notation reform: **legible to the singer who learned the old way, truer
than it.**

Three rules:

1. **Accurate.** Pitch is vertical on a real grand staff; time is horizontal
   at the scroll rate; duration, part and phrase are always legible. A
   musician could sing from it.
2. **Finished.** Engraved proportions, consistent weights, deliberate
   spacing. No hairlines, no loose stems.
3. **Clear light.** The palette is hymnbook green on cream, with **gilt**
   for what is sounding and what is sacred, and **vermilion rubrics** (the
   red of liturgical books) for directions and foreign ink. Never darkness,
   never grunge. Light, not wear, is how depth is shown.

---

## 3. Three directions, for mockups

Every direction shares the foundation in §4. They differ in how far the
glyphs themselves have travelled.

### A. The Colony Tunebook: traditional, perfected
The Sacred Harp plate done perfectly, with the future only in the details:

- 4-shape heads (7-shape in the Tabernacle dialect, historically accurate:
  later gospel books used Aikin's seven);
- proper stems, flags and beams;
- SATB closed score, Deseret words between the staves;
- barlines per mode of time, fermatas, double bars at line ends;
- tuning written with Johnston accidentals.

The safest choice and the most instantly *professional*.

### B. Deseret Reformed Notation: the notation evolved
The staff and the pitch positions stay; the glyph system has moved on:

- **Heads.** A family of seven shapes whose outlines are drawn from the
  geometry of the Deseret letterforms (the angular, hooked 1854 strokes).
  The four 1801 shapes are still recognisable inside them, the way the
  modern "a" still holds the Phoenician ox.
- **Duration tails replace stems and flags.** A tapered stroke from each
  head, its *length* exactly proportional to how long the note is held,
  thinning as the sound decays. You can read the rhythm with your eye.
- **Phrases are ligatures, as in medieval neumes.** One continuous
  broad-nib line links a phrase's heads, thick on the stressed syllables,
  hairline between. The melody's *shape* becomes a drawn gesture.
- **Parts are told apart by how the head is drawn**, not by colour:
  - solid for the melody part;
  - open for inner parts;
  - ringed for bells;
  - a double outline for the clarinet;
  - cue-size for the harmonium.

The most novel, and readable once you've seen the key. **This is my
recommendation, built on A's craftsmanship with a touch of C's light.**

### C. The Spectrum: light engraving
The staff lines are drawn as the **spectral lines of Kolob's light**: faint,
very fine, with the colour temperature shifting subtly by calendar and hour.

- **Notes as light.** A note is struck with a gilt core that cools to green
  ink as it dries.
- **Ringing shown as harmonics.** A note that rings in just intonation shows
  its first few partials as faint concentric arcs, and when a chord *locks*
  (5-limit, or the 7-limit barbershop ring) the arcs align and brighten.
- The tuning is made visible as light.

The most atmospheric. It risks being less "finished" as a score.

**The mockups.** Each is a static page rendering *the same* 30-second
passage:

- a CM hymn line, SATB, with words;
- the question (asking, answer, asking);
- a telegraph message;
- the band crossing;
- a bell;

at 860 px and 390 px. The owner picks one, or a blend, before any build.

---

## 4. The shared foundation (all directions)

### 4.1 Engraving craft
- **Proportions** follow SMuFL / Bravura engraving defaults, in staff spaces
  (sp):

  | element | size |
  |---|---|
  | staff line | 0.13 sp |
  | stem | 0.12 sp |
  | ledger | 0.16 sp, extending 0.4 sp either side of the head |
  | beam | 0.5 sp thick |
  | head width | ~1.18 sp |
  | stem length | 3.5 sp |

  Weights are consistent everywhere; alpha is used for drying, not to tell
  parts apart.
- **A glyph atlas.** Every head, flag, clef, accidental and ornament is a
  vector path with **anchor points** (stem-up and stem-down attach points,
  the optical centre). The atlas is pre-rendered once per resize into
  sprites at device-pixel ratio, so the page stays crisp and cheap.
- **Broad-nib contrast** on open heads (thick–thin, like an engraved oval),
  not a uniform stroke.
- **Depth without grunge:**
  - a faint letterpress *impression* (a 0.5 px inner highlight on the
    lower-right of every filled glyph, as if pressed into the cream);
  - a hair of ink spread;
  - the ink-drying fade that exists today.
  Light gives the depth, not dirt.
- **The plate is clipped.** Nothing prints outside the staff plate's
  margins. Notes above the top ledger limit fold an octave down with an
  *8va* bracket, as engravers do.

### 4.2 The grand staff, rebuilt
- **Gap and words.** The gap between the staves widens to about 5 sp to
  hold the **words**, as in every hymnal. Middle C keeps its ledger in the
  gap.
- **Header line.** The upper margin gains a line for **running heads**.
  The telegraph stays in the middle (§4.8).
- **Clefs** stay (they're good), re-weighted to the new line thickness.
- **Printed marks.** Barlines per the hymn's mode of time are printed
  (engine clock → bar positions), with double bars at line ends and final
  bars at hymn ends.

### 4.3 Hymns print like hymns
- **SATB in closed score**, the standard hymnal layout:
  - S and A share the treble staff, S stems up, A down;
  - T and B share the bass staff, T up, B down;
  - chords stack on shared stems where the rhythm agrees;
  - unison parts share a head.
- **In the Sacred Harp dialect the tune is in the tenor**, so the engraving
  marks the melody part in every dialect: solid gilt edge in B, heavier
  head in A.
- **Words.** Deseret syllables are underlaid between the staves, with the
  verse number, hyphens between syllables and extender lines on melismas.
  They come from the Score (`PLAN-COMPOSITION §6.5`); until the choir sings
  words, it shows the shape syllables (fa sol la mi) in Deseret.
- **The hymn header** scrolls in with the first note: a small-caps running
  head with the number, the tune's Deseret name, the meter ("C.M."), the
  dialect and the leader.

### 4.4 Duration and rhythm, truthfully
- **Direction A:**
  - flags and beams grouped by the mode of time's beat;
  - augmentation dots and ties;
  - rests;
  - fermatas.
- **Direction B:** duration tails (§3B), plus fermata arcs and rests as
  gaps with small breath commas.
- **Both:**
  - a note is placed at its onset time;
  - spacing is exact, because x is time;
  - there is no fake proportional spacing.

### 4.5 Tuning made visible: Johnston accidentals
Kolob sings in just intonation, so the engraving writes it down:

- Ben Johnston's signs, the American just-intonation notation, appear only
  where the lattice departs from the key's default spelling:
  - **+ / −** for a syntonic comma (81/80): the adaptive re is a "re−";
  - **7** for the 7-limit septimal comma, which is the barbershop ring.
- They are small and tucked before the head. They are true, and no other
  score anyone has seen shows them live.
- **Drift** (`PLAN-COMPOSITION §4.6`) shows as a tiny cents figure at the
  line end when the unaccompanied ward has floated off the organ's pitch.

### 4.6 Each voice its own ink
| voice | treatment |
|---|---|
| congregation / choir SATB | full-size heads, closed score, words |
| clarinet (obbligato, the question) | cue-size (0.75), slurred phrases, a double-outline head (B) |
| harmonium (answers, shadow) | grace-size, slashed stems |
| organ (interludes, variations) | full-size chords on the grand staff with a small "𐐄𐑉𐑀" label at entry; the organ *under* the singing is not printed, as in hymnals |
| bells | ringed heads whose rings expand and fade: the sound decaying, drawn |
| strings (open fifths) | breves (double whole notes), two heads a fifth apart |
| drone | a long bar in the lowest bass space, running under everything |
| the Kolob cantus | a **longa** (the square medieval long note) per meeting on the bass staff, labelled with the meeting number; one note per meeting, so across a session the page records the slowest melody |
| telegraph | punched tape along the middle line (§4.8) |

### 4.7 Sounding versus dried
- **The moment of sounding is lit.** The head is struck *gilt* at the
  engraving point, with a brief soft glow, then cools to hymnbook green over
  about 1.5 s. The currently sounding notes are always the brightest thing on
  the page. This is the clear light.
- **Drying.** Ink dries and fades as now: the sacrament blanks the page,
  and the postlude dries faster.

### 4.8 The telegraph: in the middle, as punched tape (owner decision)
- **Where.** The Morse stays in the middle of the grand staff, along the
  middle-C line in the gap between the staves, where it is today.
- **How it looks.** It is drawn as a narrow ribbon of **punched paper tape**:
  - a faint tape edge and shadow;
  - dits and dahs as **punched perforations** with a tiny inner shadow where
    the tape was pierced (the Wheatstone perforator, 1858, the same decade as
    the Deseret alphabet).
- **Decoded.** When a message completes, its word is set in small Deseret
  capitals beside the tape.
- **Sharing the gap with the words.** The gap also carries the words
  (§4.3). Each mockup solves the layout (for example, words just under the
  treble staff and the tape beneath them, or the tape shown only while a
  message is keyed), and there must be no collisions.
- **The wire** runs on as a hairline between messages.

### 4.9 Guests on the page
**The two bands: round notes, "not one of ours".**
- The visiting band is engraved in **round notes**, standard Earth
  notation: the "better music" reformers' round heads that the shape-note
  singers resisted in the 19th century.
- They print in **brass ink** (a warm vermilion-brass), on a separate
  **transparent layer that scrolls at the band's own tempo.** You *see* the
  two tempos collide as the band's notes slide through the ward's page at a
  different speed.
- It enters faint from the right, darkens as it crosses, and fades. It gets
  its own time signature (2/4, a march) and an italic *"Band"* rubric.

**The Question.**
- Each asking is printed in a slender vermilion **cartouche** with a small
  "?" at its head.
- The answers print as scattered grace notes that grow smaller and
  denser.
- After the last asking, there is **no answer**: a measure of empty staff
  bounded by a dotted barline, with the drone's longa running under it.

**The old tune.**
- The Earth form is printed in round notes on a narrow staff above the
  treble, in **sepia**, with slightly broken type (a worn Earth plate).
- The ward's colony form answers below in shape notes.
- The three thousand years become visible as the gap between the two.

**Fuging entries.** Each entering part is marked with its letter in Deseret
(T, B, A, S) and a small bracket at the entry, replacing the lone ⁂. The
convergence is marked with a bracket joining all four.

**The steeples, and change ringing.**
- Bells print as ringed heads.
- A change-ringing peal is drawn as its **"blue line"**, the ringers' own
  method notation: a zig-zag path through the bell numbers, a real
  centuries-old notation and a beautiful one.

**Other guests:**
- **the Primary:** smaller, rounder heads;
- **the gift of tongues:** heads with no staff position, floating, with the
  Deseret syllables freely set beside them;
- **the far ward:** printed faint and offset by its delay;
- **variations on a hymn:** each variation headed with its character in
  italic ("Polonaise", "Interlude — in two keys") and, in the bitonal
  interlude, **two key signatures at once**.

**Visions (the far tail) change the engraving itself:**
- *Apartment House:* the removed notes stay as ghosts.
- *Tempo canon:* each staff is skewed to its own rate.
- *the Comma Pump:* the staff lines slowly tilt upward as the ward drifts
  sharp.
- *Light-delay:* each part is offset, with faint light-cone lines joining
  them.
- *Well-Tuned:* the page empties to the drone's longa and the partial arcs
  of C.

### 4.10 Phones (390 px)
- Same content.
- The staff height scales by staff spaces.
- The telegraph tape stays in the middle, narrower.
- Words drop to one verse line.
- Cue notes stay; decorative partial arcs are dropped.

### 4.11 Performance
- Sprites from the atlas, with at most one draw call per glyph.
- The scroll stays whole-pixel, as today.
- The band layer is a second offscreen canvas.
- Budget: 60 fps on desktop, and 30 fps or better at 4× CPU throttling (the
  headless Chrome check in `PLAN-COMPOSITION §2.6`).
- Checked with headless screenshots, since headless animation is slow; the
  screenshot tool polls the clock.

---

## 5. Build order

1. **Mockups (A, B, C)** of the same passage at 860 px and 390 px, animated
   with a scrubber, in `mockups/`, **for the owner's choice.** (Commissioned.)
2. **`engraving-lab.php`:** a fixed Score looping through the real engraving
   code, for iteration without running the whole engine.
3. **Foundation** (§4.1–4.2): atlas, rebuilt staff, plate clipping, glyph
   anchors. This can land before the Score, using today's note events, and
   already fixes the sloppy heads and stems.
4. **Score-driven engraving** (§4.3–4.7), once `PLAN-COMPOSITION` Phase 0's
   Score exists.
5. **Telegraph tape** (§4.8), in the middle; independent, so it can land early.
6. **Guests** (§4.9), each landing with its composition phase.

Each visible step bumps Kolob's VERSION.

## 6. Decisions for the owner, from the mockups

1. **Direction:** A (perfected tradition), B (reformed notation, the plan's
   recommendation), C (light), or a blend.
2. **Words between the staves:** each mockup has a toggle.
3. **Vermilion rubrics:** each mockup has a toggle.
4. **The band in round notes on its own scrolling layer:** shown in all
   three.
5. **Scroll speed:** today's 11 px/s is too cramped to show durations. Each
   mockup proposes a faster page.

# PLAN-UNDERVOICES — a second body under each drone

Owner ask (2026-08-23): add ONE new instrument to each of the three
tracks whose job is to deepen and enrich the existing drone — "an added
richness, depth and texture." Explicitly NOT a second continuous drone:
the new voice should come and go, and its comings should be smart — tied
to the way each piece already moves (chord changes, cadences, scene
turns, the sea change / the poses / the release), so it reads as the
drone gaining a body now and then, not as a new layer switched on.

Owner chose the Library's instrument: **cello**. The other two are
proposed here to match each track's world and are subject to the
listen-first gate below:

- **Library — cello.** Warm bowed low string; the reader's room gains a
  chest voice. Sits with the triangle-dyad drone bed.
- **Sycorax — the low horn** (an aurochs horn / bronze lur: dark,
  breathy, ceremonial brass). Nothing in the rite is brass; a far horn
  is exactly the instrument a treeline rite would have, and its slow
  blossom is the gurdy cluster's missing fundament.
- **Ariel — the singing saw.** A near-sine voice with deep slow vibrato
  that GLIDES between tones. Ariel is the one track whose character can
  carry portamento (the sky bending; the ascent made audible). It gives
  the breeze pad a lit upper surface the way the cello gives the
  Library bed a floor.

STATUS (2026-08-23, owner listened): **cello APPROVED** (integrated in
rc.22), **low horn APPROVED** (integrated in rc.23), **singing saw
DECLINED** — too high-pitched for the owner's ear; Ariel keeps NO
under-voice for now. The saw's mockup page stays in the tree as a
reference (unlinked, dev-only) in case the idea returns in a lower
register; §2c below is retained as documentation of what was auditioned,
not as a plan of record.

---

## 1. The shared design — the under-voice contract

All three integrations follow one pattern (the Library's singing hum and
Ariel's aeolian harp are the architectural precedents):

1. **Landscape voice.** It never claims THE AIR — it is part of the room
   the speeches happen in. It also never emits melodic phrases: held
   tones, dyads, and (saw only) glides between held tones.
2. **Era-aware pitch.** Every note reads `harmony.current()` +
   `field.degFreq` AT SCHEDULE TIME. No cached Hz. Sounding notes never
   retune (straddle lesson) — with the saw's designed glide as the one
   deliberate, documented exception (a glide is a scheduled gesture from
   tone A to tone B, both read from the live field at schedule time;
   a modulation mid-glide keeps the glide's target — old world — like
   any other sounding note).
3. **Movement-following entries, not a metronome.** The voice keeps a
   lane whose ticks are cheap "opportunity" polls, but it only ENTERS on
   musical movement:
   - a harmony step (chord/pose name changed since last look),
   - a cadence window (the library plans one — the under-voice may join
     the approach like a second consort body),
   - a scene entry / joint boundary,
   - the track's one big event (sea change bloom / the organum arrival
     and pose darkening / the release ascent).
   Each opportunity draws against a per-scene chance × intensity
   scaling × a presence governor (a duty-cycle target ~20–40% of a
   scene mid-evening, less at the quiet edges) so the voice breathes
   with the evening instead of ticking.
4. **Stream purity.** Every draw lives on NEW forks (`"cello"`,
   `"horn"`, `"saw"` + sub-forks as needed). Forks are label-hashed off
   the birth seed, so adding them re-rolls nothing: the existing
   note/event streams stay byte-identical by construction. The harness
   gains a gate asserting exactly that.
5. **Mixer citizenship.** One new MIX_LAYERS row per track (kind
   "landscape"), per-layer LAYER_PARAMS knobs, a rate lane, and design
   values chosen so the default desk is bit-identical when the layer is
   at volume 1 / rate 1. Weather is read at schedule time for timbre
   (brightness → filter/bow; breath → vibrato/air).
6. **Gain ledger.** Worst-case scheduled peak budget ≤ ~0.05 per track
   (quieter than each track's drone bed). When in doubt, quieter.
7. **VERSION bump** in the landing commit (owner rule — user-facing
   sound change). The mockup pages themselves are dev-only: no bump.

## 2. Per-track instrument spec

### 2a. Library — cello (`instrument-mockup-cello.html`)

- **Register:** C2–C3 territory — one octave AROUND the drone dyad
  (field tonic 262 dorian; drone voices root+5th at oct −1 ≈ 131–196 Hz,
  sub at oct −2). The cello takes the chord's root, fifth, or third at
  oct −1, occasionally a double-stop (root+5th or root+3rd, p ≈ 0.3).
- **Patch:** two detuned sawtooths (±4 cents) → body stack (peaking EQs
  ≈ 230 Hz +6 dB Q 2, 400 Hz +4 dB, 1 kHz wood formant +3 dB Q 1.5) →
  lowpass 1.8–2.6 kHz (weather brightness). Bow noise: 2–3 kHz bandpass
  noise, very low, riding the attack (rosin). Vibrato delayed ~1.5 s,
  4.5–5.5 Hz. Envelope: 1.5–3 s attack, plateau with slow ±2 dB bow
  swells (slow-noise), 2.5–4 s release; whole notes 10–25 s.
- **Behavior:** enters on harmony steps (the cello voice-leads the
  ground the drone only restates), joins cadence approaches (a second
  body under the consort — high chance), doubles the sea-change bloom
  an octave up, allowed one long tonic bow early in candle-out then
  silent (the halo's guttering law, borrowed). Silent in settling until
  intensity clears ~0.15.
- **Level:** peak ≈ 0.045 per bowed tone (vs drone pads 2×0.07).

### 2b. Sycorax — the low horn (`instrument-mockup-horn.html`)

- **Register:** Eb2–Eb3 (field tonic 311 "sycorax"; gurdy cluster at
  oct −2 ≈ 78 Hz + body course oct −1). Horn voices the POSE's root or
  fifth at oct −1, single tones only — a horn does not chord.
- **Patch:** one sawtooth → lowpass with a slow BLOSSOM (cutoff swells
  ~300 → ~900 Hz and back across the note — the brass crescendo that is
  the instrument's identity), Q ≤ 0.7; attack pitch scoop (−35 cents
  settling over ~0.4 s — breath finding the partial); breath noise
  (≈800 Hz bandpass) riding the envelope; a whisper of 3rd partial when
  the blossom is open. Envelope: 3–6 s swell, hold, 4–8 s die; notes
  12–30 s. Send a share to the grit bus at integration (the trompette
  precedent) — mockup approximates with a soft waveshaper.
- **Behavior:** ceremonial. Enters on pose changes (weighted toward
  "sting" and "hollow"), joins the ORGANUM arrival at boundaries (the
  darkening gains a fundament), processional and invocation weighted,
  NEVER inside the cut's hush (it respects the noticing), and one far
  final call allowed in the afterimage. Rarely (p ≈ 0.15) a two-note
  call: fifth falling to root — never rising fanfares.
- **Level:** peak ≈ 0.04; darker is always the answer to "louder?".

### 2c. Ariel — the singing saw (`instrument-mockup-saw.html`)

- **Register:** F4–F6, above the breeze pad (field tonic 349 lydian);
  climbs with the release like everything else that loves the sky.
- **Patch:** sine + 2nd harmonic ≈ 0.15 + 3rd ≈ 0.05; deep slow vibrato
  (5–6 Hz) delayed ~1 s; the faintest airy noise thread. PORTAMENTO is
  the voice: entries land with a small settling glide (a third or less),
  and — the signature move — when the harmony steps WHILE the saw is
  holding, it glides (0.8–2 s, exponential-ish) to the nearest tone of
  the new chord: the I↔II float made audible as bending light.
- **Behavior:** enters after cadence LIFTS and sea changes (it carries
  the arrival's lift upward), on song → hover/swirl entries; holds the
  3rd or 5th of the current chord, rarely (p ≈ 0.1) the #4 against I —
  the tritone as light, the aeolian precedent. Through the release each
  new entry sits an octave higher and the vibrato widens; it is the
  last pitched thing to let go before the seam.
- **Level:** peak ≈ 0.03 — a surface sheen, never a soloist.

## 3. The mockup pages (this phase)

Three standalone dev pages at the track folder root (room-mockup.html
pattern: plain .html, dark monospace chrome, error bar, no PHP, engine
files UNMODIFIED):

- `instrument-mockup-cello.html` — Library + prototype cello
- `instrument-mockup-horn.html`  — Sycorax + prototype horn
- `instrument-mockup-saw.html`   — Ariel + prototype saw

Approach (the room-mockup interception trick, applied to plumbing):
wrap `PJ2.Voice.buildBus` / `PJ2.Pitch.field` / `PJ2.Harmony.create`
before `create()` to capture the live ctx, bus, field and harmony; run
the REAL engine unmodified; drive the prototype voice from live
telemetry (harmony.current(), getInfo() intensity/scene, engine events)
on its own clock lane; feed it into `bus.input` through its own small
generated-IR reverb so it sits in a room. Page controls: Play/Stop,
seed, master volume; prototype enable + level; the instrument's
character knobs; a presence knob (entry-chance multiplier); an
"audition one note now" button (instant listening — no waiting for an
entry); a "hush the melody" toggle (engine toggleLayer on the melodic
layers, so drone + prototype can be judged alone); a log line per entry
decision (what moved, what was drawn, what sounded).

## 4. Integration steps (after the owner's listen, per approved track)

1. Voice function + forked streams + lane in the track engine file,
   per the contract above (§1) and the approved mockup patch.
2. Mixer wiring: MIX_LAYERS row, LAYER_PARAMS knobs, MIX_RATE_LANES,
   roomBlend registration with a baseBias that seats it (cello slightly
   close, horn toward the treeline/wide, saw toward the sky).
3. Dramaturgy hooks: the entry opportunities wired to the existing
   event stream (no conductor changes needed — all three engines
   already narrate everything the under-voice listens for).
4. Harness: per-track section (entries happen, register bounds hold,
   never during the cut, stream-purity gate: existing streams
   byte-identical with the new forks present).
5. Gain ledger update in the engine header + VERSION bump
   (`2.0.0-rc.N — <track> gains its under-voice: …`).

One track per commit, Library first (the owner has heard its instrument
in the mockup and chose it by name).

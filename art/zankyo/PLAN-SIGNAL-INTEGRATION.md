# ZANKYŌ — 受信 THE SECOND SET: integrating the broadcast into the station

*Build plan, 2026-09-05. The owner chose mockup 1 (隣 THE SECOND SET) as the
look, to be refined as it is built. This plan turns PLAN-BROADCAST-SIGNAL.md
(sound + picture pipeline) and the mockup's as-built decisions into phases
on the finished ZANKYŌ 2 engine. Branch `zankyo-signal`, cut from `zankyo-2`
after the mix pass, with `zankyo-broadcast` (reels, tool, manifest, mockups)
merged in.*

## 0. What is fixed by the owner's choice

- **Layout:** a second, older, receive-only tube to the RIGHT of the scope +
  bargraph stack. `3fr 2fr` (scope stack 457 px / second set 305 px at
  860 px), the CRT-9 housing stretched to the stack's height so the two read
  as bolted to one panel. Under 700 px: single column, the second set full
  width under the bargraph (on a phone the visitation is the event).
- **Hardware:** 映像管 · MSHI CRT-9 · 受信専用 on a rusted steel strap with four
  hex bolts through the faceplate; a cracked glass (SVG fracture, the picture
  sliced and refracted along it, a chip missing from one corner), yellowed
  tape on the bezel; a chin with the brand plate, the 受信 SIGNAL lamp (NE-2
  neon: flicker on tuning, amber on hold), and a 選局 TUNE control.
- **Phosphor:** P39 long-persistence yellow-green (black → #041409 → #0c481e →
  #289848 → #78e292 → #deffe2, gamma 1.3); persistence is real (the frame
  canvas decays under the new frame: ~62 % in signal, 50 % idle, 11 % dead);
  bloom as a blurred copy under the sharp pixels; scanlines; multipath ghost.
- **Idle is a first-class mode** (99 % of the night): faint raster glow, a
  test-card ghost surfacing for a second every ~20 s, Paik's single line of
  light now and then; its own seeded stream.
- **The gesture** (mockup timings, kept): tuning 0.4 s of per-pixel snow
  resolving; hold 8–12 s with strength breathing 0.7–1.0, dropouts
  0.12–0.37 s with frame-holds 100–300 ms, nine-band tearing, ghost 5–8 px;
  loss 1.6–2.8 s (strength falls as k², vertical-hold roll with a blanking
  bar, tear grows) → collapse 0.42 s (the picture squashes into the line)
  → burst 0.32 s (pure snow) → dead 1.6 s (afterglow). VFD lines 「受信 ·
  title · year」 on hold and 「消失 · signal lost · N s」 on loss.
- **The crack is seeded per night** (3–4 fracture patterns drawn from the
  seed), per the designer's note.

## 1. Phases

### S0 — the branch and the chair (dev-visible, then owner-visible)

- Cut `zankyo-signal` from `zankyo-2` at the mix-pass PASS commit; merge
  `zankyo-broadcast` (reels, manifest, tools, mockups). Serve on :8013.
- Port the mockup's markup and CSS into `index.php` / `zankyo.css` as real
  faceplate hardware: the bank grid, the CRT-9 housing, strap, bolts, tape,
  chin, lamp, tune control, the crack SVG (seeded variants), both
  breakpoints. The scope, bargraph, control rail, console, VFD unchanged.
- A new viz module `zk-set.js` (loaded after zankyo-viz.js) owns the second
  set's canvas: the phosphor pipeline (persistence, bloom, scanlines, ghost,
  snow, tear, roll, collapse) and the **idle mode** as a seeded stream
  (`PJ2.Rand` fork "set:idle"). No broadcast yet — the set is alive and
  dark. VERSION bump ("a second set on the panel; it shows nothing yet").
- Gate: harness PASS + REPRO identical (the idle stream draws from its own
  fork, so the music is bit-identical); page smoke at 860 and 390 px.

### S1 — the receiver (sound)

- Layer `broadcast` (放送) in LAYERS with volume/mute and knobs **band**,
  **flutter**, **grit** (LAYER_META / PARAM_META rows; console row appears
  automatically).
- `zk-broadcast.js` (engine side): fetch `broadcast/manifest.json` at play;
  the **visitation** "signal" seated by the Conductor's plan (the plan §4.6
  machinery already has the lost-broadcast guest — the real signal REPLACES
  it when the pool has loaded, and the synthetic gagaku broadcast remains
  the fallback); choice by weight × tone × tide with the recent ring (last 3
  cycles excluded), seeded in-point inside a window (`visit` stream, no new
  draws in other streams); prefetch at t0 − 20 s (`<video preload=none>`
  seek → `canplay`), degrade to the fallback if not ready by t0 − 1 s.
- Audio path: `createMediaElementSource(video)` → HPF/LPF band (opens with
  strength) → pre-attenuated tanh (grit) → AM flutter → dropout gate (the
  same seeded dropouts the picture will show) → bit-crush → signalGain
  (tuning envelope) → hull reverb send + far-wall delay send. One writer
  per param, anchored ramps, nodes released after loss.
- The AIR: the signal claims a landscape-level hold (limit 0 for melodic
  voices, drones/shō/noise continue) from t0 − 1 s to loss + 2 s; the
  shakuhachi is first back.
- Gate: harness with mocked fetch/media (timing, AIR, fallback, never in a
  KIRU, never two per cycle, ≈ 1 per 3 cycles over 4 h); browser: a real
  reel audibly *inside* the hull; master ceiling unchanged; iOS caveat
  documented (media-element source needs the play gesture — the PLAY button
  is one).

### S2 — the picture (the set lights up)

- `zk-set.js` gains broadcast mode driven by engine events
  `{phase: tuning|hold|loss|collapse|dead, strength, id}`; the muted
  `<video>` from S1 is the frame source (96×72 offscreen → P39 → up-scaled,
  smoothing off). Tuning/hold/loss exactly as §0; the crack refracts the
  live picture; 受信 lamp states; VFD lines; `document.hidden` → audio only;
  low-power devices half frame rate.
- 選局 TUNE: while playing, a "scan now" that asks the conductor to seat a
  signal at the next legal moment (never in a KIRU/hush; rate-limited to
  one per cycle); while stopped, the ♪ sample for the layer (2 s tune-in on
  a random window). Attribution ▶ in the VFD opens the manifest `src`.
- Gate: 60 fps on a laptop, ≥ 24 on a phone (measured), no dropped audio
  frames, REPRO identical; the whole gesture matches the mockup side by side.

### S3 — polish and the owner's refinements

- The owner's fine-tuning list (collected while S0–S2 run): crack patterns,
  idle cadence, phosphor curve, lamp colors, chin labels, mobile order.
- Harness: mocks committed; `_probe.js` gains signal counts per cycle/kind.
- VERSION 2.1.0-rc.1 ("the station receives"), CLAUDE.md rule unchanged.

## 2. Rules carried over

The character contract (PLAN-ZANKYO-2 §5); the reel format and legal posture
(PLAN-BROADCAST-SIGNAL §5); never louder than the kyū wall; nothing in the
hush; graceful thinning (skip, never stall); pj2-*.js frozen; no publish.

## 3. Gates summary

| phase | owner hears/sees | gate |
|---|---|---|
| S0 | the second set, dark and alive | harness PASS + REPRO; 860/390 smoke |
| S1 | a real signal in the hull, the crew falls silent | mocked-timing gates; ceiling; audible in browser |
| S2 | the picture on the CRT-9, the full gesture | fps, REPRO, side-by-side with mockup 1 |
| S3 | the owner's tweaks | UI smoke; VERSION 2.1.0-rc.1 |

## 4. Owner refinements (running list; the crew folds each into the phase in flight)

1. **Tape:** one piece only, the one on the right side of the bezel. Remove
   the other two. (2026-09-05, after the mockup.)
2. **Vertical padding:** too much empty housing above and below the tube.
   Do NOT stretch the CRT-9 housing to the scope stack's height; the housing
   hugs the tube (same bezel proportions as the scope's), with the chin
   directly beneath. The tube keeps its 4:3 — never taller than wide.
3. **Controls under the set:** the vertical room this frees in the right
   column is for controls that will move under the monitor. S0 leaves a
   receiver sub-panel there (a plate the size of one console knob row,
   bolted, labeled 受信機 · RECEIVER); S1 fills it with the broadcast layer's
   knobs (band / flutter / grit) and the 選局 TUNE control; which other
   controls migrate there is the owner's later call.
4. **The tune knob keeps, its label goes:** the small knob on the CRT-9's
   chin stays (the owner likes it) but the label beneath it is removed — it
   was costing a whole row. Tighten the housing again by that row.
5. **Transport moves under the set — now, not later:** PLAY, STOP and the
   master volume knob + readout leave the control rail and live on the
   receiver plate under the monitor (the plate becomes the transport plate,
   label 操作 · TRANSPORT, or keep 受信機 if the tune knob joins them). The
   control rail keeps the pitch module (旋法 / 音階), which may widen to the
   rail's full width.
6. **The broadcast layer's knobs** (band / flutter / grit) therefore go in
   the console as an ordinary layer row (like every other layer), not on
   the plate. (2026-09-05, during S1.)

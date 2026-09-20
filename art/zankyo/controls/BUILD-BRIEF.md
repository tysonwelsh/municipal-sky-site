# BUILD BRIEF — for the agents building controls

*Read this, then `SPEC.md`, then open the two reference builds
(`controls/knob-chicken-head-bakelite.html`, `controls/meter-weston-panel.html`)
and their screenshots in `shots/`. Then look up your assigned entries in
`PLAN-3-STYLES.md` and build them.*

## Your job

You are assigned two to four controls, each identified by a **slug**, a
taxonomy code, and a source style from `PLAN-3-STYLES.md`. For each one,
write exactly one file, `controls/<slug>.html`, that follows `SPEC.md` to the
letter, and verify it with `tools/snap.js`. You are one of many agents
building in parallel; do not touch any file that is not yours.

## The order of work, per control

1. **Read the style entry** in `PLAN-3-STYLES.md`. It names the machine, the
   material, the colours, the typeface, and the *tells*. The tells are the
   contract with the owner: if the entry says "a red lume pip at 12", there is a
   red lume pip at 12.
2. **Decide the geometry** on paper first: natural size in CSS px, the sweep
   angle, the number of positions, the pivot point, what moves and what is
   printed on the panel. Write the meta block.
3. **Build the element** in the shadow root. Prefer inline SVG with a
   `viewBox` for anything with curves, arcs, numerals on arcs, needles, or
   knurls; CSS boxes for square things (keys, rockers, lamps, bezels); canvas
   only for phosphor traces and dot matrices. Gradients, filters and clip
   paths are your paint. No images.
4. **Wire the behaviour** exactly as SPEC §3 says: attributes reflect,
   property `value`, `input`/`change` events for inputs, pointer + wheel +
   keyboard + click, focus ring, ARIA. Outputs get ballistics and cancel
   their RAF on disconnect.
5. **Mount two or three instances** on the stage in different states or
   sizes so the thumbnail shows range (a knob at 3 and at 8; a lamp on and
   off; a meter with and without a redline).
6. **Run the tool**: `node art/zankyo/controls/tools/snap.js <slug> --no-bench`
   from the repo root. Fix every error it prints. Then **open
   `shots/<slug>.png` with the Read tool and look at it.** Compare with what
   the real thing looks like in your memory. Fix what is wrong: light
   direction, flat materials, wrong proportions, text too small to read,
   a shadow that floats. Run it again. Do this at least twice; the first
   render is never the best one.
7. **Write the notes section** (three short paragraphs: the source, the
   tells kept, what was left out) and finish.

## The craft, in one page

- **One light source, above-left**, unless the source is lit from behind
  (a scale lamp, a VFD). Every highlight and shadow agrees with it.
- **Recessed vs proud.** Things let into the panel: an inner shadow at the
  top-left of the hole and a lit lip at the bottom-right. Things standing
  on the panel: a tight contact shadow plus a soft ambient shadow, both
  offset down-right.
- **Round things** have a highlight, a mid-tone, a core shadow, and a band
  of reflected light on the far underside. A knob without the reflected
  light looks like a flat disc.
- **Cylinders project.** Ribs, knurls, numerals on a drum: position by
  angle, `x = R·sin θ`, width `∝ cos θ`, brightness ∝ `cos θ`. They crowd
  at the edges. See the note at the top of `../mockups/volume-2-options.html`.
- **Materials.** Bakelite: deep, slightly translucent, a soft swirl, one
  crisp highlight. Anodised aluminium: fine directional grain
  (`repeating-linear-gradient` at 1–2 px), a broad soft highlight across
  the grain, a hairline dark edge. Chrome: a hard horizon (sky above, ground
  below), high contrast, tiny. Painted steel: near-matte, a chip at a
  corner exposing primer or bare metal, a scuff. Glass: one wide reflection
  shaped by the room, not by the dial; a faint edge; things behind it
  slightly desaturated. Phosphor/neon/VFD: a bloom (`filter: blur` copy
  behind, additive-looking), a hot core, a colour cast on nearby surfaces.
  Rubber: dead matte, a rounded edge with a grey rim light. Plastic (80s):
  slight sheen, a sink mark, a parting line; beige yellows toward the edges.
- **Typography.** Pick the face from SPEC §3's list (Google Fonts) closest
  to the source, size it as printed (small: 7–9 px legends are correct at
  natural size; the `scale` attribute is how a host makes it bigger),
  letter-space capitals slightly. Silk-screen is crisp; engraved fill has
  a 0.5 px shadow edge; hot-stamp is a metallic gradient; a decal has a
  visible rectangle of slightly different sheen.
- **Wear** only where a hand or a decade would put it: around the knob,
  on the tip of a bat handle, on the most-used key, on the corner that hits
  the rack. One or two touches; never a texture over everything.
- **Motion.** A toggle snaps (`cubic-bezier(.2,.9,.3,1.15)` over ~90 ms). A
  needle is a damped spring. A drum counter scrolls the digit and carries
  the next. A split-flap falls (a two-step flip with a half-card). A Nixie
  cross-fades with a ghost of the previous digit. A lamp: incandescent warms
  up over ~120 ms and cools over ~250 ms; neon and LED are instant; a VFD
  fades in ~40 ms.
- **Readability at thumbnail.** The gallery card is about 360 × 240 px. If
  the silhouette and material don't read there, simplify.

## Things that will get a build rejected

- The console is not clean, the element is not defined, or the keyboard
  does not move an input.
- Anything external beyond Google Fonts; `<img>`; `zoom`; global styles
  leaking out of the shadow root; a second file.
- A generic control wearing a famous name. If the entry says Tektronix, the
  collet knob's fine flutes, the coloured cap, and the panel's grey are
  there.
- A control that only works with a mouse.
- `value` set from outside emitting `input`/`change` (it must not).
- A meta block whose `id` is not the slug, or whose `element` tag is reused
  by another control.
- Edits to any file you did not create.

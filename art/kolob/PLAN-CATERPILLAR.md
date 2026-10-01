# Plan: the band's caterpillar (a volume control that crawls in with the band)

> **Status 2026-10-01:** built (handoff/caterpillar-1.md, caterpillar-2.md). §7, the owner's first look, is binding and overrides §1–§6 where they differ (a line, not segments; a disc, not a hexagon). The owner asked for "a few more passes" — see `OPEN-WORK.md`.

*Owner request, 2026-09-29, in their words:*

> Would be kind of fun to have as a separate volume control just when the two bands come in,
> like a volume control like almost creeps onto the interface like a caterpillar, and then you
> can use that to control the band. And then as the band leaves, the volume control for the band
> sort of crawls back off the viewport off the screen. … There's space to the left of the current
> volume control for it, so that's good.

## 1. What the listener sees

- **Most of the time it isn't there.** Nothing changes in the console row (PLAY, PAUSE, STOP, the
  spacer, VOL and the master slider) until a band comes.
- **The band arrives, and so does the caterpillar.** When the Nauvoo band strikes up (and it now
  comes only in the prelude or the postlude: v0.36.1), a small slider **inches in from the left
  edge of the page** into the empty space between STOP and VOL. It moves the way an inchworm or
  caterpillar does:
  - its body is a row of small segments;
  - the rear segments bunch up behind the head, then the head reaches forward and the body
    stretches out after it;
  - it takes several of these pulses and about 2.5–4 s to arrive, then settles into a straight,
    usable slider.
- **It controls the band.** The settled caterpillar *is* the slider: its body is the track, its
  head is the thumb. Dragging the head (or using the keyboard) sets the band's loudness, from
  silent to a little above the band's normal level (0–150 %; 100 % by default). Both bands, when
  two come, answer the same caterpillar.
- **The band leaves, and so does the caterpillar.** When the band has gone out of hearing (after
  its last drum), the caterpillar lets go of its setting and **crawls back off the left edge of
  the page** the same way it came, and the row is as it was.
- **It remembers, for the visit.** If the listener turned the band down, the next band in the same
  visit arrives at that level (the caterpillar arrives already set). A new visit starts at 100 %.

## 2. Look (binding)

- **The page's own ink, not a cartoon.** It must look like it belongs to the console: hymnbook-green
  ink line and fill on the cream paper, the same weights as the console's rings and the master
  slider. No eyes, no face, no legs drawn as a cartoon, no bright colours, no drop shadows. The
  owner is wary of skeuomorphic UI: the caterpillar is suggested by **segments and motion**, not
  by illustration. (Tiny paired feet dots under the segments are acceptable only if they read as
  ink marks, not a drawing; show both in the screenshots and say which you chose.)
- **No new text**, except an accessible name (see §4). No label is printed beside it; the
  segmented body is recognisable as a slider because it sits in the row beside VOL.
- The thumb (the head) may echo the master slider's beehive-hexagon thumb, smaller, so the two
  controls read as siblings.
- **Width:** it uses the free space between STOP and VOL. At 860 px it can be generous; at 390 px
  it must still fit without pushing VOL or the master slider, and without sideways scroll.
  Measure the free space and size the caterpillar to it.

## 3. Behaviour details

- **When it comes:** on the band's `guest-start` event (guest `bands`, logged). **When it goes:**
  once the band is out of hearing: its last note or drum has ended (the band plays on its drums
  for 16–21 s after its stinger and fades out). Use what the engine reports, not a timer guess.
  If two bands come, it stays until the last one has gone.
- **Transport:**
  - PAUSE: the caterpillar freezes where it is (mid-crawl or settled) and resumes with the
    meeting.
  - STOP, a new seed or the dev jump: it leaves at once (a quick crawl-off, or simply gone if
    the page is resetting).
- **The page clock:** base "is the band here" on the audio clock (the same smoothed page clock
  the staff uses), so it arrives when the band is heard, not when it is scheduled seconds ahead.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, it fades in and out in place instead
  of crawling.
- **Hidden tab:** timers are clamped in background tabs. When the tab returns, the caterpillar
  must be in the right state (present or gone), not replaying a queued crawl.
- **The Hosanna and every other guest** never bring it. Only the band.
- **Testing seed:** `?guest=bands` forces a band into the prelude, so it arrives within about the
  first 10–30 s.

## 4. The sound side (engine)

- Add one gain stage on the **band's own bus** (`kolob-voices-band.js`, where the band feeds the
  hall and the wide send; both bands and their drums pass through it), and a facade method on
  `window.KolobAudio`: `setBandVolume(v)` (v in 0…1.5, linear gain; ramp over about 50 ms so
  dragging never clicks or zippers) and `getBandVolume()`.
- It must be independent of the instruments panel's "band" layer slider, if there is one. Multiply;
  don't overwrite that slider. Say in the handoff how the two relate.
- At 0 the band is silent but still plays its part in the meeting: timing, the staff (the band's
  notes still print) and the minutes are unchanged. The control changes loudness only.
- Accessibility: a real `<input type="range">` (or an element with role="slider" and full
  keyboard support) with an aria-label such as "band volume". It is focusable while present,
  and removed from the tab order when it leaves.

## 5. Constraints

- **Don't break the owner's staff rules** (the staff is untouched by this work).
- **Silent testing:** every browser run uses `--mute-audio`; offline renders for level checks.
- **Headless timing:** rAF runs at about 1 fps headless. Verify the crawl by stepping animation
  time (CSS/Web Animations can be paused and seeked, e.g. `document.getAnimations()` with
  `currentTime`) or by polling on the page clock, and capture frames of the crawl that way.
- **Performance:** the crawl costs nothing measurable against the staff's frame budget. Prefer CSS
  transforms or the Web Animations API on a few elements over per-frame canvas work.
- **Phones:** check 390 px (touch-sized thumb, at least 32 px hit area), no sideways scroll, and
  no overlap with VOL.

## 6. Verification and handoff

- Muted headless screenshots at 860 and 390 px:
  - the row before the band;
  - four or five frames of the crawl in;
  - settled;
  - dragged to about 40 %;
  - four or five frames of the crawl off;
  - the row after.
  Make a contact sheet.
- An offline or muted-capture measurement showing the band's level follows the control
  (100 % → 40 % → 0 %) with no clicks, and that nothing else in the mix changes.
- The harness passes (`node art/kolob/_harness.js 300 7`, plus a forced-band run such as
  `1250 22 force=bands`), and the page shows zero console errors at 860 and 390.
- Handoff `art/kolob/handoff/caterpillar-1.md`, with:
  - a plain-language section for the owner;
  - how to see it (for example `index.php?seed=22&guest=bands`, and when);
  - the contact sheet paths;
  - the choices made (the feet or none, the thumb shape, the crawl timing) and the knobs to change
    them.

## 7. The owner's first look (2026-09-30), binding for pass 2

> That's the right idea in terms of how the crawling works, so I'd like it to be a little bit
> slower and maybe just a little more scrunched up in the arc to look more like a normal
> distribution curve when it is scrunched up, if that makes sense. However, I don't like the body
> of them. I don't like there's just a bunch of connected ovals. It should just be a line with the
> thumb. And the thumb in this case should just be a circle. Should just be like a green circle
> with the white circle inside of it and not the hexagram. But it shouldn't have like a body other
> than the line. I do like that his body gets scrunched up when you change the volume though,
> that's fun. … it should just be a line and then like a track. So like a dark line and then the
> track and the thumb for a head. And then if you scrunch him a lot the dark line curves up. …
> But pretty good animation though. So let's give it a few more passes.

What this means:
- **The body is a line, not rings.** Drop the ring segments entirely, and the feet variant with
  them. The caterpillar is:
  - a **dark ink line**: the filled part of the slider, from its tail to the head;
  - the **pale track** ahead of the head: the "room to turn up", as the master slider has;
  - **the head:** the thumb.
- **The thumb is a circle:** a green ink disc with a white (paper-coloured) circle inside it, a
  ring-in-disc. No hexagon.
- **The crawl keeps its gait, slower.** Keep the inchworm rhythm the owner liked, but slow it down
  noticeably: roughly 1.5× the current durations, both in and off. The dark line itself arches up
  as the body bunches.
- **The arch is a bell curve.** When the body bunches (mid-crawl, and when the volume is turned
  down), the line arches up like a normal-distribution curve: smooth, symmetric, and higher. Make
  the arch a little more pronounced than now: a gaussian hump rising from flat ends, not a
  circular arc or a sharp tent.
- **Keep:** the volume scrunch (turning the band down bunches the body into that bell-shaped
  arch; turning it up stretches it flat) and the turn-and-crawl-off.
- **Everything else in §1–§6 still holds:**
  - the audio, the timing from the band's last drum;
  - pause, stop, reduced motion, the hidden tab;
  - the phone placement on the rule;
  - accessibility and silent testing.

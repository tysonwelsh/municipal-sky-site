# The band's caterpillar, pass 2 (the owner's first look, PLAN-CATERPILLAR.md §7)

*Finished by the coordinating session on 2026-09-30: the pass-2 crew saved the new look
(`8d4336ba`) and then stalled six times; the playback and the checks below were done here.*

## For the owner

- **The body is just a line now.** A dark ink line (the band's level), with the pale track ahead
  of it, as on the main volume slider. The head is a green disc with a white circle inside. There
  are no rings, no feet and no hexagon.
- **It's slower.** The crawl in takes about 5 s on a computer (it was about 3.4 s) and 3.75 s on a
  phone. The crawl off is slowed by the same amount. STOP still sends it off briskly (about 1.3 s).
- **The arch is a bell curve.** When the body bunches up, both mid-crawl and when you turn the band
  down, the line rises in a smooth, symmetric bell from flat ends. It's taller than pass 1's
  (13 px on a computer, 9 px on a phone). At 40 % it's a gentle hump; at 10 % a tall, narrow bell.
  At 100 % and above it lies flat.
- **Everything else is as in pass 1:** the sound side, the timing from the band's last drum,
  pause and stop, reduced motion, the hidden tab, the phone placement on the rule, and the keys.

To see it: `index.php?seed=22&guest=bands` and press PLAY. The band and the caterpillar come
within about half a minute.

## Checks (all muted, headless Chrome)

- Frames seeked on the crawl's own clock at 860 and 390 px:
  `caterpillar-2-sheet-860.png`, `caterpillar-2-sheet-390.png`. The sheets show crawl-in at
  10–90 %, settled, 40 % and 10 %, and crawl-off frames.
- 0 console errors at both widths.
- Harness: `300 7` and `1250 22 force=bands` pass.

## How it's drawn

One SVG path through 48 points, plus the head, set each frame from one clock: an animation with
no keyframes on the element, so pause, seek, a hidden tab and the end are all read from its
`currentTime`.

Knobs, at the top of `wireCaterpillar()` in `kolob-ui.js`:
- `PACE` (slowness, 1.5);
- `HUMP` (the bell's height);
- `SIGMA` (the bell's width, 0.15 of the span);
- `BUNCH` (the gait).

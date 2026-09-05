# KOLOB — a cohesive page (layout plan, v0.12)

## Diagnosis

The page grew by accretion. Each element is good on its own and none was
placed with the others in mind:

- the running head (meeting · section · activity · mode · pitch · flag) is a
  loose line of text parked in a "console" grid, and on phones becomes two
  columns of words with a reserved min-height — a layout trick, not a design;
- the wheel, the newest plate, sits *below* the console, so the three
  engravings (organ, staff, wheel) are split by controls;
- the Liahona dial floats beside the text with nothing to anchor it;
- vertical spacing differs block to block (0.9 / 1.4 / 2 / 2.2 rem).

## The organizing idea: a hymnal page

A hymnbook page has a fixed anatomy, and every part of KOLOB maps onto it:

| hymnal | KOLOB |
|---|---|
| running head: hymn number · tune name · meter · key | the meeting number, the day, the meter dots, the mode and pitch |
| the engraving: the music | the organ facade, the wheel, the staff — three plates, one column |
| performance directions in the margin of the staff (*rit.*, *a tempo*) | the event flags: stillness, fuging, the question, two bands, the steeples, the whole tune |
| the imprint and index | the hymn board, the broadside, the instruments, the minutes |

## The page, top to bottom

1. **The head.** Masthead toggles (unchanged). The title with its double rule.
   Then the **running head**: one line of letterspaced small caps in two fixed
   slots — left `MEETING 001 · ORDINARY`, right `IONIAN · 65.4 HERTZ`, with
   the meter dots (`8.6.8.6`) joining the right slot during a hymn. Idle:
   `THE VALLEY IS STILL` alone on the left. The section name leaves the
   running head: the wheel names it. Fixed slots, so the line never reflows
   as values change. Phones: the two slots stack as two short lines.

2. **The plates.** Three engravings stacked at one rhythm, edge-aligned, the
   same gap between each (1.2rem): the organ facade, the wheel, the staff.
   The wheel band trimmed from 262px to about 230px (phones: 190px) so the
   three read as one column of engraving; its horizon rule is the divider
   between the wheel and the staff, so no extra rule is added there. One
   hairline weight (`--rule`) for every rule on the page; the double rule
   stays unique to the title.

3. **The direction line.** Directly under the staff, right-aligned, italic
   EB Garamond (Deseret in Deseret mode), gilt: the event flag printed as a
   performance direction — *stillness*, *fuging*, *the question*, *two
   bands*, *the steeples answer*, *the whole tune*. One reserved line
   (fixed height) so nothing below shifts when it comes and goes.

4. **The console.** One ruled band, like the masthead: PLAY and STOP at the
   left, the VOL slider after a spacer, the Liahona dial at the right end
   (64px), all vertically centred on one line, hairlines above and below.
   Phones: buttons and dial on one line, the slider beneath, still inside
   the band.

5. **The boards.** Hymn board and broadside side by side (as now), then the
   instruments, then the minutes. Identical section heads; one block margin
   (2rem) between them.

## Measures

- Spacing scale: 0.6 / 1.2 / 2 / 2.8 rem. Nothing else.
- Type: section heads 0.8rem / 0.22em (as now); running head 0.78rem /
  0.18em; direction line 0.95rem italic; controls unchanged.
- Colour: ink for the current, ink-soft for furniture, gilt only for what
  moves or fires (the arc's fill, the direction line, the dial's needle).

## Files

- `index.php` — reorder: head → running head → organ → wheel → staff →
  direction line → console band → boards. Remove the telemetry from the
  console.
- `kolob.css` — running head (two slots, stacked on phones); the plates'
  rhythm; the direction line; the console as a band; delete the
  column-count telemetry rules and the reserved min-height.
- `kolob-ui.js` — `updateTelemetry` becomes `updateRunningHead` (left and
  right slot strings) plus `updateDirection` (the flag). Idle text on the
  left slot. `applyScript` covers the new elements.
- `kolob-viz.js` — no drawing change; only if the trimmed band wants the
  crown a little higher (`crownY`), one proportion.
- A dev aid, `?kolobPreview=1`: with the engine idle, the running head and
  direction line render sample values so the dressed page can be seen (and
  screenshotted) without audio. Mirrors the existing `?latin=1` switch.
- `VERSION` → v0.12.

## Acceptance

At 1000px and 400px, idle and previewed: the three plates read as one
column; the running head sits under the title like a hymnal's; the console
is one band; the direction line appears without shifting anything; no
text reflows between states; every rule is one weight.

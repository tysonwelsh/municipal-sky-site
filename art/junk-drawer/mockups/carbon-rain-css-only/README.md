# The Carbon Rain — the CSS-only build

A falling-glyph rain over ~6,000 characters from 78 writing systems, in which
**no column ever repeats**, implemented with **no JavaScript at all**. Pure
CSS animations, static generated markup.

It exists because of a mistake: the original brief said "pure CSS, no script,"
a constraint invented for self-contained review mockups that was never true of
the app it was being designed for (`junk-drawer.js` builds every loader at
runtime). Working under a false constraint produced something more interesting
than the correct approach did, so it is kept here.

## How it avoids repeating without being able to change a character

CSS cannot re-roll a glyph. So the trick is arithmetic instead.

1. A stream is a stack of `<i>` squares translated from above the sheet to
   below it on an infinite `linear` loop of period `d`.
2. **At the instant the stream wraps, every square in it is off the sheet** —
   the one below the bottom edge jumps to just above the top edge. Nothing is
   visible at that moment.
3. So each square holds a *stack* of `n` characters clipped to a 9px window,
   walked by `steps(n)` with period `n × d` and **the same negative delay as
   the stream**. The step therefore lands exactly on the wrap. The character
   changes where nobody can see it, and the column arrives new next pass.
4. `n` is drawn from `{2, 3, 5, 7}`, so a whole column only recurs after
   `lcm(2,3,5,7) = 210` passes — better than half an hour of falling, against
   a longest plausible wait of about ninety seconds.

The brute-force alternative — a ribbon long enough to outlast the wait —
needs ~620 glyphs per column, about 64,000 elements per card. This needs ~3.

## Measured cost (four sheets at true card size, this machine)

| | value |
|---|---|
| frame rate | 56 fps |
| worst frame | 113 ms (initial layout) |
| animations | 806 |
| elements | 4,079 |

`STACK_SHARE` trades cost against freshness: at 1.0 every square is new each
pass (1,398 animations); at 0.6 rather more than half of it is (806).

## The character pipeline

`sieved.py` is generated, not typed. Each script is enumerated from its full
Unicode block, then filtered:

1. font-size **measured** per script so its advance matches Latin's
2. ink-density sieve — blobs and specks out
3. shape test — hollow-rectangle tofu and bare single strokes out
4. `unicodedata` — unassigned code points and non-letters out
5. de-duplicated — overlapping ranges had doubled some scripts
6. bitmap-identity — 3+ characters rendering identically is a missing-glyph
   box, not an alphabet

## Files

- `gen_rain4.py` — the generator (`python3 gen_rain4.py` → the mockup)
- `sieved.py` — the character inventory
- `mockup-F-carbon-rain.html` — the specimen sheet
- `loadtest.html` — four sheets at true card size, with a frame counter
- `probe3/4.html`, `tofu.html` — the sieve stages

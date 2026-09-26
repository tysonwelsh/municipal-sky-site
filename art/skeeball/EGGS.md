# HOLLER ROLLER — the eggs (2026-09-26)

Secret things the machine does. None is announced anywhere on the page.
Each is canon-safe (see `../arcade/WORLD.md`: the house number is 13, the
coal & land company's name is never legible, the possum's name is undecided,
the 1924 Mercury dime is a once-ever silent collectible), each is harmless
to the game (never costs a ball, never changes a score except where it
says), and each is a single switch to remove.

| # | Egg | How you find it | What happens | Flag / save |
|---|---|---|---|---|
| 1 | **The thirteen** | Finish a game whose score is a multiple of 13 (130, 260, 390 …) | The drums freeze on the number, the marquee neon blinks 13 times, the bell rings 13 times, and 13 extra tickets print (“13” marks on every one). | `skeeball.thirteen`; scrip +13 |
| 2 | **What's its name** | In ATTRACT, tap the possum's nose three times | It sneezes (eyes shut, head jolts, a small sneeze), and the marquee shows a name it is trying on: PAWPAW, then BURL, then ZEKE, then back to HOLLER ROLLER. The machine cannot decide either. | `skeeball.sneezed` |
| 3 | **The plaque** | Press and hold the water-stained plinth for three seconds | A scratched brass plaque rises out of the tide-mark for a moment: a company name with its letters scratched illegible, and “EST. 19▮▮”. It sinks back. | `skeeball.saw-the-plaque` |
| 4 | **The coin return** | Press and hold the coin door (about a second): you jiggle it | The plate presses in and rattles; usually nothing falls out. The first time on a save there is a token in it (+1). Once ever, on a moon night, it holds a silver 1924 Mercury dime: it drops out of the slit, silent, and goes into the inventory. (A quick tap on the door still drops a nickel in.) | `skeeball.checked-the-return`; inventory `mercury-dime` (unique) |
| 5 | **The perfect game** | All nine balls in the 50 | The possum's eyes glow pink neon for the rest of the visit, PERFECT is chalked on the lane, and, for once, the attract waltz plays in tune. | `skeeball.perfect` |
| 6 | **The sigh** | Three gutters in a row | The possum rolls its eyes and the machine sighs. Nothing else. | — |
| 7 | **The pity ticket** | Score 0 in a whole game | The machine prints exactly one ticket anyway, stamped 13. | `skeeball.pity-ticket`; scrip +1 |
| 8 | **Moon nights** | Play on a night of a real full moon (local time) | The moon event comes every game instead of one in four. The harness never sees this. | — |
| 9 | **The moths** | Leave the machine in ATTRACT, untouched, for three minutes | Two moths find the marquee tube. The possum watches them. Any touch scatters them. | — |

Rules for all of them: no `Math.random`, no `Date` inside the sim or the
mischief module (egg 8 reads the clock in main at mount and passes a flag);
every trigger has a misfire test in the harness (normal play for 20 games
must fire none of 1–7 by accident except by their real condition); every
egg is behind one named constant in `EGGS` at the top of main.js so it can
be switched off.

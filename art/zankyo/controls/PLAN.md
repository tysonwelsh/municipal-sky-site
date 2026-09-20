# CONTROLS — a skeuomorphic library of inputs and readouts

*A dev-only sub-page of ZANKYŌ (`/art/zankyo/controls/`). Nothing here is
wired into the station; the live app is untouched and `VERSION` does not
bump for work in this folder. The library exists to be pulled from: by
ZANKYŌ, by the Jukebox, and by every engine that comes after them.*

Started 2026-09-20 on the owner's brief: *a rich library of dials, knobs,
switches, gauges, buttons, sliders, wheels — inputs and outputs — drawn from
the whole history of machines, each one a specific, recognisable style.*

## The workflow

| phase | what | where |
|---|---|---|
| 1 | **Taxonomy.** Every kind of control and readout a panel can carry. | this file |
| 2 | **Machines.** For each kind, the machines across history that carried a memorable one. | `PLAN-2-MACHINES.md` |
| 3 | **Styles.** For the promising sources, two or three *specific* styles each: the exact device, the material, the typeface on the legend, the thing that makes it recognisable from across a room. | `PLAN-3-STYLES.md` |
| 4 | **Build.** Agents build each style as a self-contained web component mock-up. | `controls/*.html`, contract in `SPEC.md` |
| 5 | **Library.** A gallery to browse, filter, try, and copy from. | `index.php` |

## What a control is, for our purposes

Two families, and a control can be both:

- **INPUT** — the person changes a value. Continuous (a knob, a fader), discrete
  (a selector, a switch), momentary (a button), or gestural (a crank, a wheel).
- **OUTPUT** — the machine shows a value. A needle, a lamp, a digit, a flag, a
  column of fluid, a trace on a tube.

Every entry below records: the *value model* it implies (range / steps /
boolean / momentary / text / waveform), whether it is naturally *input*,
*output*, or *both*, and the *tell* — the physical detail that has to be there
for it to read as the real thing. Phases 2 and 3 hang off the codes.

Interaction vocabulary the builds must honour: pointer drag (mouse and touch),
wheel, keyboard (arrows, Home/End, PageUp/PageDown, Space/Enter for buttons),
focus ring, `aria` role and value. A control that cannot be used from a
keyboard is not finished.

---

## A · ROTARY INPUTS

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| A1 | **Potentiometer knob**, continuous, ~270° or 300° sweep, end stops | range | in | the pointer line or dot; the skirt's printed scale; end stops you can feel |
| A2 | **Chicken-head / pointer knob** — the bakelite wedge pointer | range or steps | in | the wedge shape; the flat top; the set-screw on the boss |
| A3 | **Skirted knob** with numbered skirt (0–10, 0–11, 1–12) | range | in | the skirt's numerals turning under a fixed index mark |
| A4 | **Collet / instrument knob** (Elma, Sifam, Rean, the Braun and Tektronix ones) | range | in | the fine-fluted or plain aluminium cap, the coloured cap insert, the hairline |
| A5 | **Rotary selector switch**, detented, N positions (band switch, V/div, wafer switch) | steps | in | the snap between positions; positions labelled on the panel, not the knob |
| A6 | **Vernier / reduction-drive tuning knob** (6:1, multi-turn) | range, fine | in | the big slow knob with the small fast dial inside it; the vernier scale |
| A7 | **Slide-rule tuning dial** — knob turns a string drive, a pointer crosses a wide printed scale | range | both | the long lit scale with city names or kc; the red pointer line; the slack in the drive |
| A8 | **Airplane / drum dial** — a rotating drum with the scale printed on it read through a window | range | both | numerals curving away at the window's edges |
| A9 | **Thumbwheel**, edge-on cylinder (volume rollers, Walkman, transistor radios) | range | in | ribs crowding toward the edges by projection; a fixed index |
| A10 | **Thumbwheel decade switch** — click-stopped numeral wheel with +/− pushers | steps (digits) | in | the numeral in the window; two small buttons; ganged in banks |
| A11 | **Rotary encoder / jog wheel / shuttle ring** — endless, detented or free-spinning | delta, velocity | in | no end stop; the shuttle ring's spring return |
| A12 | **Crank / handwheel / valve wheel** — multi-turn gestural | delta, velocity | in | the spoke count; the handle offset from the axis; a cast rim |
| A13 | **Combination dial** (safe) | sequence of steps | in | the numbered ring, the index at 12, the counter-rotating spin |
| A14 | **Telephone rotary dial** | digit, with a spring return timed by the governor | in | the finger stop; the finger holes over the numerals; the return speed |
| A15 | **Timer / spring dial** (kitchen timer, darkroom timer, egg timer) | duration | both | winds one way, unwinds slowly the other; the bell |
| A16 | **Rotating bezel** (dive watch, slide-rule bezel) | steps (60 clicks) or range | in | the one-way ratchet; the lume pip at 12 |
| A17 | **Crown** (watch crown, radio fine-tune) | delta | in | the small knurled cylinder on the side of a case; pull to a second position |
| A18 | **Trimmer / screwdriver adjust** — a slot in a recessed shaft, a locking collar | range | in | the slot; the recess; "CAL" printed beside it |
| A19 | **Stepped attenuator / rotary with lit position** | steps | both | lamp or LED ring instead of a printed scale |
| A20 | **Bezel-mounted rotary with pull-to-turn or push-to-set** | range + boolean | in | the two-mode gesture; used on radios (pull for loudness), cars (pull for lights) |

## B · LINEAR INPUTS

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| B1 | **Fader** (mixing desk linear pot, 60 / 100 mm) | range | in | the knob's finger cup; the slot with a felt or brush; the dB scale printed in the slot rail |
| B2 | **Slider with detent at centre** (pitch, balance, EQ) | range, centre-zero | in | the click at 0; the mirror-image scale |
| B3 | **Slide switch** (2 or 3 position) | steps | in | the short travel, the flush thumb, the printed ON/OFF beside it |
| B4 | **Lever / throttle in a quadrant** (aircraft throttle, ship telegraph handle, train brake) | range or steps | in | the quadrant with a gate; the ball or handle at the end |
| B5 | **Draw bar** (Hammond organ, church console) | steps (0–8) | in | the numbered stems; the coloured caps; pulled *toward* you |
| B6 | **Pull knob / choke / T-handle** | boolean or range | in | the shaft that appears when it's out; the stamped legend on its face |
| B7 | **Drawer / cassette door / tray** | boolean (open/closed) | in | the eject spring; the damped glide |
| B8 | **Ribbon controller / touch strip** | range, momentary | in | no moving part; the resistive strip's felt surface |
| B9 | **Gate / shift lever** (car shifter, gear selector, feed-rate lever) | steps in 2-D | in | the H-pattern gate; the boot |
| B10 | **Zipper / rack** — geared linear track (microscope focus, lab jack) | range | in | the visible rack teeth |
| B11 | **Vernier caliper / slide rule cursor** | range, fine | both | the hairline cursor; the vernier scale |
| B12 | **Trolley on a rail / potentiometer wiper** | range | in | the exposed track |

## C · SWITCHES (discrete state)

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| C1 | **Toggle switch, bat handle** (2 or 3 position, with or without centre-off) | steps | in | the chrome or black bat; the hex nut and lock washer; the snap |
| C2 | **Toggle with safety cover** (missile switch, red flip guard) | boolean, two-stage | in | the sprung red cover; the guard's hinge |
| C3 | **Locking toggle** (pull-to-move) | steps | in | the lever lifts before it moves |
| C4 | **Rocker switch** (I/O, lit rocker, the German ones with a lamp behind) | boolean or 3-step | in | the see-saw; the pilot lamp behind the rocker's window |
| C5 | **Paddle switch** (lab supply, Eurorack, guitar amp) | steps | in | the flat blade rather than a bat |
| C6 | **Key switch** (ignition, elevator, arcade service key) | steps | in | the barrel; the key stays in only in some positions |
| C7 | **Knife / blade switch** (open-frame, the Frankenstein one) | boolean | in | copper jaws; a porcelain or slate base; the insulating handle |
| C8 | **Circuit breaker** (push-to-reset, the aircraft pull-out ones with the white collar) | boolean, trips itself | both | the white band exposed when tripped |
| C9 | **DIP switch** | bits | in | tiny; ON printed on the body; needs a pen |
| C10 | **Pull chain / cord** | boolean or cycle | in | the beaded chain; the fob |
| C11 | **Latching push-on/push-off** | boolean | in | it sits lower when it's in |
| C12 | **Interlocking pushbutton bank** (car radio presets, radio band buttons, cassette transport keys) | one-of-N with mechanical release | in | pressing one pops the others; the piano-key travel |
| C13 | **Organ stop tab / rocker tab** (Hammond, Vox Continental, church consoles) | boolean | in | the long flat tilt tab with the name printed on it, in a row of twenty |
| C14 | **Lever switch / selector with a handle** (railway signal lever, elevator car switch) | steps | in | the long stroke; the catch at each notch |
| C15 | **Foot switch** (amp channel, sewing machine, Dictaphone) | momentary or latch | in | the rubber cap; the cast base; the rubber feet |
| C16 | **Rotary cam switch with a handle** (industrial, the red-and-yellow isolator) | steps | in | the moulded handle; the lockable off |
| C17 | **Magnetic reed / proximity / tilt** (no visible actuator) | boolean | in | rare; skip unless a source demands |
| C18 | **Mercury tilt switch in a thermostat** | boolean | both | the glass vial; the bimetal coil |

## D · BUTTONS

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| D1 | **Momentary pushbutton, domed** (doorbell, Bakelite, chrome) | momentary | in | the dome's highlight; the escutcheon |
| D2 | **Momentary, flat-capped, in a bezel** (test equipment, telephone) | momentary | in | the square bezel; the cap's legend |
| D3 | **Illuminated pushbutton / annunciator switch** (Korry, aircraft, the NASA consoles, elevator car buttons) | momentary + lamp | both | the split legend lit from behind; the square lens |
| D4 | **Mushroom / E-STOP** | latching momentary | in | the red mushroom, the yellow collar, twist-to-release |
| D5 | **Big button under a guard** (launch, arm/fire) | momentary, two-stage | in | the hinged clear guard |
| D6 | **Arcade button** (concave, convex, leaf or microswitch, the Sanwa and the Happ) | momentary | in | the bezel ring; the concave cap |
| D7 | **Typewriter key** (glass-topped, round, chrome ring; later the sculpted plastic) | momentary | in | the concave cap; the ring; the legend under glass |
| D8 | **Terminal / computer key** (Selectric, VT100, Model M, Space Cadet, Cherry) | momentary | in | the cylindrical top; the legend's font; the row profile |
| D9 | **Calculator key** (HP, Casio, TI — the double-shot legends, the shifted legends printed above) | momentary | in | the shift legend printed on the panel above the key |
| D10 | **Chiclet / rubber dome / membrane keypad** (ZX Spectrum, microwave, remote) | momentary | in | the flat rubber; the printed overlay; no travel |
| D11 | **Telephone keypad** (Western Electric, the Trimline, the British 746) | digit | in | the 3×4 grid; the letters above the numerals; the # and * |
| D12 | **Cash register / adding-machine key** (tall stems, colour-coded) | momentary | in | the tall stem; the round cap with the numeral |
| D13 | **Elevator / lift button** (brass, the round lit ones, braille) | momentary + lamp | both | the halo; the braille plate |
| D14 | **Radio / hi-fi piano key** (tape transport PLAY REC FF REW, the long latching keys) | latch, one-of-N | in | the long key with the icon; the release when STOP is pressed |
| D15 | **Sewing machine / appliance button** (the 1960s two-tone) | momentary or latch | in | the two-tone moulding |
| D16 | **Touch plate / capacitive** (the 70s "touch" hi-fi, lamps) | momentary | in | no travel; a lamp responds |
| D17 | **Bell push / door buzzer** (porcelain, brass) | momentary | in | the ceramic plate; the brass nipple |
| D18 | **Detonator plunger / T-handle push** | momentary, gestural | in | the plunger; the box |

## E · COMPOUND, GESTURAL, AND OTHER INPUTS

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| E1 | **Joystick / control stick** (aircraft, Atari, arcade, the ball-top) | 2-D range or 4/8-way | in | the boot or the gate; the trigger on a flight stick |
| E2 | **Trackball** (Missile Command, radar console, the Kensington) | 2-D delta | in | the ball in its cup; the ring |
| E3 | **D-pad / cross key** | 4/8-way | in | the cross shape; the pivot dot |
| E4 | **Steering wheel / yoke** | range | in | spokes; the horn button |
| E5 | **Pedal** (sustain, wah, sewing, car) | range or momentary | in | the hinge; the rubber tread |
| E6 | **Patch bay / patch point** (Moog, EMS pin matrix, telephone switchboard) | connection | in | the jacks in rows; the cables; the EMS pin matrix's grid |
| E7 | **Card / cartridge / cassette insert** (punch card, 8-track, Famicom) | object presence | in | the slot; the label on the object |
| E8 | **Coin slot / token / ticket** | event | in | the slot; the return button; the coin-return cup |
| E9 | **Slot-machine handle** (one-armed bandit) | momentary gestural | in | the ball on the arm; the pull and return |
| E10 | **Magneto crank** (field telephone) | momentary gestural | in | the folding handle |
| E11 | **Pin matrix / diode matrix** (EMS VCS3, IBM control panels) | grid of booleans | in | the grid; the pins |
| E12 | **Numeric keypad with entry display** (microwave, safe, alarm) | text | both | keypad plus its readout |
| E13 | **Punched-tape reader / paper tape** | stream | both | the sprocket holes |
| E14 | **Sensor plate / touch pad / theremin antenna** (no contact) | range | in | the antenna; the field |
| E15 | **Dial-and-window preset** (thermostat, oven dial, washing-machine program dial) | steps with names | both | the dial with named programs; the pointer or window |

## F · OUTPUTS — NEEDLE AND POINTER

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| F1 | **Moving-coil panel meter** (round, square, the Weston, the Simpson) | range | out | the mirror strip under the scale; the needle's knife edge; the zero-adjust screw |
| F2 | **VU meter** (the Weston 862, the Sifam, the Neve and the Ampex ones) | range, ballistic | out | the black-then-red scale; the −20…+3 and 0…100%; the warm backlight |
| F3 | **Edgewise / strip meter** (Nakamichi, Braun, the aircraft ones) | range | out | the needle seen through a narrow slot |
| F4 | **Centre-zero meter** (galvanometer, balance, tuning) | signed range | out | the 0 in the middle; needle at rest centred |
| F5 | **Gauge, Bourdon-tube style** (pressure, boiler, the steam gauge, the diving gauge) | range | out | the brass bezel; the red line; the big fat pointer |
| F6 | **Automotive gauge** (speedometer, tach, fuel, temp; the 50s chrome, the 70s black) | range | out | the redline; the warning lamps in the face |
| F7 | **Aircraft instrument** (altimeter with three hands, airspeed, artificial horizon, VSI) | range, multi-hand | out | the black face, the white markings, the Kollsman window, the striped flag |
| F8 | **Compass / gyro / heading card** | angle | out | the card turns, not the needle; the lubber line |
| F9 | **Tuning eye / magic eye tube** (6E5, EM84) | range | out | the green phosphor shadow closing |
| F10 | **Spirit level / bubble** | signed range | out | the vial; the bubble between two lines |
| F11 | **Balance scale / spring scale dial** | range | out | the dial turns as the pan drops |
| F12 | **Clock face / stopwatch / chronograph** | time | out | the sub-dials; the sweep hand's steps |
| F13 | **Watt-hour / disc meter** | cumulative | out | the spinning disc with the black mark; the dials in series |
| F14 | **Radio "tuning meter" / S-meter** | range | out | the S1–S9 and +dB scale; the lit face |
| F15 | **Galvanometer with mirror and lamp** (spot galvanometer) | signed range | out | the light spot on a long ground-glass scale |

## G · OUTPUTS — NUMERALS AND CHARACTERS

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| G1 | **Drum counter / odometer** (mechanical, the flip carrying the next digit) | integer | out | the digit rolling with the next one half-in; the ratchet |
| G2 | **Tape counter with reset** (3-digit, the reset button) | integer | out | the small white drums; the reset button |
| G3 | **Split-flap** (Solari, the airport board, the Fremont clock) | text/digits | out | the flip; the split line across every character; the sound |
| G4 | **Nixie tube** (IN-14, B-7971) | digit | out | orange neon; the stacked cathodes ghosting behind; the anode mesh |
| G5 | **Numitron / incandescent filament segment** | digit | out | filament glow; the warm-up |
| G6 | **Panaplex / neon 7-seg** | digit | out | orange neon segments in a flat glass panel |
| G7 | **VFD** (the blue-green Vacuum Fluorescent, hi-fi and VCR displays) | text/segments | out | cyan-green; the grid shadow; the diffuse glow |
| G8 | **LED 7-segment** (red, the 1970s calculators; the bubble lens HP; later green and amber) | digit | out | the dot after the digit; the bubble magnifier on HP |
| G9 | **LCD segment** (Casio, calculators, the grey-on-grey, the reflective) | digit/segments | out | the ghost of unlit segments; the polariser's tint |
| G10 | **Dot matrix LED** (5×7, the Roland and the Akai, the ticker) | text | out | the pixel grid; the scrolling |
| G11 | **Flip-dot / flip-disc** (bus destination, Ferranti-Packard) | pixels | out | the yellow disc turning; the flick |
| G12 | **Dekatron / counting tube** | count, rotating | out | the ring of neon dots |
| G13 | **Mechanical flag / annunciator drop** (railway, "dead man", the register's "NO SALE") | text/state | out | the drop tag; the window |
| G14 | **Character wheel / date wheel** (watch date, the price on a petrol pump) | text | out | the numerals turning past a window |
| G15 | **Plasma / gas discharge panel** (the orange Toshiba/IBM plasma) | pixels | out | orange on black |
| G16 | **Teletype / dot-matrix print / thermal print** | stream of text | out | the paper; the ribbon fading |
| G17 | **Ticker-tape / punched tape** | stream | out | the paper strip |

## H · OUTPUTS — LAMPS, LEGENDS, AND LIGHT

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| H1 | **Pilot lamp with jewel lens** (the faceted red jewel, the green, the amber) | boolean | out | the faceted dome; the ring |
| H2 | **Neon indicator** (NE-2 in a holder, the orange glow) | boolean | out | the orange; the flicker; the little glass |
| H3 | **Annunciator panel** (a grid of legends lit from behind: MASTER CAUTION, FUEL LOW) | bits | out | the black-on-lit legend; the split-legend two-colour tiles |
| H4 | **LED indicator** (3 mm, 5 mm, the flat rectangular ones on 80s gear) | boolean | out | the lens; the dome's hot spot |
| H5 | **LED bargraph / peak meter** (LM3915, the 80s hi-fi, the 20-segment green-amber-red) | range | out | segments; the peak-hold dot |
| H6 | **Plasma / lit bar meter** | range | out | rare; the Pioneer "fluoroscan" |
| H7 | **Lit legend / lit tag** (a translucent block that says "ON AIR", "RECORD") | boolean | out | the glowing letters and the dark edge |
| H8 | **Signal lamp stack / tower light / traffic light** | steps | out | the hoods; the lens ribs |
| H9 | **Pinball / arcade lamp insert** (the printed plastic, the hot spot) | boolean, animated | out | the printed art; the lamp behind |
| H10 | **Warning strobe / beacon** (rotating, the Xenon flash) | boolean, animated | out | the sweep |
| H11 | **Dial lamp / scale backlight** (the yellow-warm bulb behind a radio scale) | boolean | out | the uneven pool of light |
| H12 | **CRT phosphor / oscilloscope trace** | waveform | out | the graticule; the bloom; the persistence |
| H13 | **Radar PPI** (the sweep with fading echoes) | 2-D map | out | the sweep line; the decaying afterglow |
| H14 | **Magic eye** — see F9 | | | |

## I · OUTPUTS — MECHANICAL, FLUID, AND OTHER

| code | kind | value model | I/O | the tell |
|---|---|---|---|---|
| I1 | **Thermometer / column** (mercury, alcohol; the big outdoor one) | range | out | the bulb; the column; the meniscus |
| I2 | **Sight glass / liquid level** (boiler gauge glass, the coffee-machine tube, oil level) | range | out | the meniscus; the tube in its brass fittings |
| I3 | **Float gauge / fuel-tank flag** | range | out | the float on an arm; the number rising past a window |
| I4 | **Semaphore / signal arm** | steps | out | the arm; the spectacle lenses |
| I5 | **Reel / spool** (tape reels turning, film reels, the Ampex hubs) | rate, direction | out | the spokes; the tape pack growing |
| I6 | **Pendulum / metronome / balance wheel** | rate | out | the swing; the weight on the rod |
| I7 | **Spinning disc / turntable / platter** (strobe dots on the rim, the Technics) | rate | out | the strobe dots freezing |
| I8 | **Chart recorder / strip chart / seismograph** | time series | out | the pen; the graph paper; the ink trail |
| I9 | **Bell / gong / buzzer** (with a visible striker) | event | out | the striker; the dome |
| I10 | **Sandglass / egg timer** | duration | out | the falling sand |
| I11 | **Mechanical wave / bar indicator** (the barber pole, the Selectric's "under the hood") | rate | out | the stripes |
| I12 | **Flag / bat indicator on a valve, the "OPEN — SHUT" plate** | boolean | out | the plate turning with the stem |

## J · PANELS, FURNITURE, AND HOUSINGS (the things the controls sit in)

Not controls, but the library needs a few of each so that every control can be
shown *set into* something. Builders may make a control's demo panel from
these; a few will be built as standalone swatches.

| code | kind | the tell |
|---|---|---|
| J1 | **Brushed aluminium** (anodised, clear or black or gold) | the directional grain; the silk-screen legend |
| J2 | **Painted steel** — hammertone, wrinkle/crackle, grey enamel | the texture; chips at the corners |
| J3 | **Bakelite / phenolic** (brown, black, the marbled) | the depth; the moulding seams; the swirl |
| J4 | **Chrome / nickel** | the reflections; the pitting |
| J5 | **Brass / bronze** (lacquered, tarnished) | the patina; engraved fill |
| J6 | **Wood** (walnut cabinet, cheek panels, the Moog's) | the grain; the oil finish |
| J7 | **Injection-moulded plastic** (beige, the 80s greys, the "putty", the two-tone) | the sink marks; the yellowing |
| J8 | **Glass / Lucite / acrylic** (dial glass, the lit edge-lit acrylic) | the edge glow; the reflections |
| J9 | **Rubber / leather / vinyl** (the grips, the tolex) | the grain |
| J10 | **Legends** — engraved lamacoid, silk-screen, Dymo tape, decal, hot-stamp, etched brass | the typeface; the wear |
| J11 | **Fasteners and furniture** — screws, bolts, rivets, grommets, hinges, handles, feet, grilles, vents, cable glands | the correct head type for the era |

---

## What "good" looks like (carried into SPEC.md)

1. **Recognisable at a glance.** A person who has held the real thing should
   know it from the thumbnail: the proportions, the material, the typeface.
2. **Physically consistent.** One light source, from above-left unless the
   source says otherwise. Things that are *let into* a panel have inner
   shadow; things that *stand proud* have a drop shadow. Curved surfaces
   have a highlight *and* a reflected-light band. Cylinders project: marks
   crowd toward the edges.
3. **Wear where hands go.** Grime around a knob, polish on a bat handle,
   a scuff on the most-used key. Not everywhere — where a hand would land.
4. **Legends in the right face.** Engraved, silk-screened, printed, or
   hot-stamped; the typeface of the era (Futura on a 30s radio, DIN on
   German gear, Helvetica on 70s hi-fi, Eurostile on 80s Japanese, a stencil
   on a military box, a Cyrillic grotesk on Soviet).
5. **Works.** Drag, wheel, keyboard, touch. Emits values. Has a focus ring.
   Does not fight the page's scroll.
6. **Portable.** One file per control, a custom element inside it, no
   dependency on anything but a Google Font.

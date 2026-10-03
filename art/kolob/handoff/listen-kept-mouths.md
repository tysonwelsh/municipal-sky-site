# Listening packet: the ward's mouths

*For the owner. Two switches wait on your ear, both off: nobody hears them
until you say so, and VERSION is unchanged. They came out of the refactor's
§4.6 (PLAN-REFACTOR.md), which asked whether the ward could stop building
new filters for every line it sings. It can; but that changes what each
voice is heard through, so it is yours to hear first. On the way to it we
found that today's ward cuts some of its own sound short, and that is the
second switch. Written 2026-10-03 at v0.36.3.*

## What the two switches do

Each singer's voice reaches the room through **mouths**: for every vowel or
consonant a line sings, a gate and three fixed filters shaped like that
mouth. Today every line builds its mouths new and throws them away when it
ends: about 360 filters a line for the full ward.

1. **`rungOut`: a mouth leaves the room only once it has rung out.** A
   mouth closes in a short crossfade into the next one. Today the ward lets
   go of a mouth by the clock that hands it its lines, and that clock runs
   ahead of what you hear. So many mouths are disconnected while they are
   still sounding, part-way through the crossfade that should have faded
   them. That is a cut, not a fade.
   - With the page in view this cuts about 1 % of the ward's sound (0.9 % on
     seed 22's first ten minutes, 1.6 % on seed 37, where the Hosanna's
     shouts are short and lose the most). Each cut is tiny, but there are
     thousands: on seed 22, of the 6,811 times a mouth was let go, 2,699
     came while sound was still passing through it.
   - **With the page hidden** (another tab in front, or a phone's locked
     screen) that clock runs 1.6 s ahead, and the ward loses **about half
     its sound**: on seed 22, 3,108 of 3,969 mouths lose more than half of
     theirs, many parted before they open. This was measured in the test
     harness, not yet heard in a browser. If you have played the app in a
     background tab, it would be why the singing sounded thin there.
   - Switched on, a mouth waits until it has really rung out: nothing is cut,
     in view or hidden.
2. **`keptMouths`: each singer keeps their mouths from line to line.** The
   filters are built once and opened again by the singer's next lines,
   instead of new ones each line. It always parts its mouths as `rungOut`
   does, because a filter cut off while it sounds holds that sound until it
   is next connected, and the next line would hear it.
   - Seed 22's ward builds **about 60 filters a line instead of 361** (1,855
     against 11,182 over its 31 sung lines). The whole meeting's graph is
     46 % smaller across four seeds (172,438 nodes → 93,134); the Hosanna's
     is 55 % smaller.
   - Every singer keeps mouths of their own; nothing is shared between
     singers, so the full ward of thirty-two, each with a throat of their
     own (your ruling of 2026-09-26), stands as it is.
   - Every note, every filter setting, every gate movement and every die is
     the same. The one difference: the filter a line opens has sounded
     before, on an earlier line, and has rung out to silence behind a closed
     gate for at least half a second, where today's is brand new. In theory
     that is inaudible. This packet is for checking it by ear.

So you are listening for two things:

- **today → `rungOut`**: is the cut audible, and is the fix better? This is
  the bigger difference.
- **`rungOut` → `keptMouths`**: can you hear any difference at all? If you
  cannot, the kept mouths are a free saving.

## How to listen

Open a seed three ways (the local server as for the earlier packets):

> http://127.0.0.1:8141/art/kolob/index.php?seed=7
> http://127.0.0.1:8141/art/kolob/index.php?seed=7&exp=+rungOut
> http://127.0.0.1:8141/art/kolob/index.php?seed=7&exp=+keptMouths

- The switch in the address lasts that visit. In the console,
  `KOLOB.Experimental.on("keptMouths")` (or `"rungOut"`) keeps it on in this
  browser until `KOLOB.Experimental.reset()`; `KOLOB.Experimental.list()`
  says what is on.
- The times are the page's clock, from PLAY, read from the harness. The
  three addresses play the same meeting, note for note.
- Headphones help: a cut is a small click or a hard edge at a vowel change.

## Where to listen

*(mm:ss from PLAY, read from the harness; the browser keeps them)*

**Seed 7: the first hymn, 2:56–5:55.** Four verses with the organist, an
amen at 5:18.6.
- The first two lines: 3:07.8 and 3:16.0. On the first line every mouth is
  new on every build. A line hands its mouths on only to a line that starts
  after they have closed, so from the second or third line on most of the
  mouths `keptMouths` opens are kept ones: the starts of those lines are
  where a difference would show.
- Any line's start, verses 2–4. Lines begin about every 8 s from 3:07.8.
- The amen, 5:18.6 to its close at about 5:27, under the organ's last
  chord.

**Seed 22: the first hymn, 3:07.7–5:41.1.** The ward alone, unaccompanied
and in unison, so nothing covers the voices. Lines at 3:14.1, 3:19.6,
3:25.1 and 3:33.6; the last line at 4:58.9.

**Seed 37: the first hymn, 3:15.3–5:35.0.** Four verses, no organ. Lines at
3:22.8, 3:26.4, 3:30.0 and 3:33.5. Then **the Hosanna, 17:55–19:51**: its
shouts are short, and today they lose the most to the cut (on this seed
1,540 of 16,530 mouth spans, the Hosanna's and the ward's together, lose more
than half their sound). The doxology's amen is at 17:47.4, just before it.

**A hidden tab** (`rungOut` only). Start seed 22, wait for the hymn
(3:14), then bring another tab to the front and listen for half a minute.
Today the ward should thin to about half. With `&exp=+rungOut` it should
not.

## What to listen for

1. **Today against `rungOut`** (the cut):
   - **At a vowel change inside a line**, e.g. "oh" to "ee", one mouth
     fades into the next. Today the old one is often cut part-way through
     that fade. Listen for a tiny click, a roughness or a "flick" at the
     joins. Each cut is one singer of thirty-two, so it is small and
     easiest to hear in seed 22's unison hymn. If you hear nothing, say so:
     that is an answer.
   - **The Hosanna's shouts** (seed 37, 17:55): does a shout sound clipped
     today and whole with `rungOut`?
   - **A hidden tab**: is the ward thin today and whole with the switch?
2. **`rungOut` against `keptMouths`** (the kept filters). These should
   sound the same. Listen for:
   - the **attack of a line**: does a line start the same way, or does one
     sound "fresher" and one "warmer" or softer at the onset?
   - any **click or thump at a line's start**, or in the breath just
     before it (a kept mouth joins the room up to a second before it opens);
   - the **blend** of the full ward: the same body and the same air?
   - the **amen** and the **last line**: the same decay?

## What the measurements say

**Recorded** in muted headless Chrome (`tools/capture.js`), each seed's first
hymn whole (jumped to with `--section hymn`, 0–185 s from the jump), each
build once, seed 7 twice to show how far two runs of one build differ (the
hiss is drawn fresh at every page load). The pages ran without the site's
lock-screen route (`art/background-audio.js` was not in the tree served),
all three builds alike.

|  | build | LUFS | LRA | short-term max | sample peak | true peak | 31.5 Hz | 63 | 125 | 250 | 500 | 1 k | 2 k | 4 k | 8 k | 16 k | tap holes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| seed 7 | today | -16.73 | 3.4 | -13.8 | -4.80 | -4.76 | -50.6 | -19.8 | -26.0 | -26.5 | -29.4 | -36.4 | -39.7 | -51.4 | -57.5 | -82.4 | 5 |
| seed 7 | today (again) | -16.89 | 3.5 | -13.9 | -4.89 | -4.85 | -50.5 | -20.0 | -25.9 | -26.7 | -29.3 | -36.4 | -39.7 | -51.4 | -57.4 | -82.6 | 3 |
| seed 7 | rungOut | -16.65 | 3.5 | -13.8 | -4.91 | -4.88 | -50.5 | -19.8 | -25.7 | -26.4 | -29.3 | -36.4 | -39.5 | -51.4 | -57.4 | -82.5 | 3 |
| seed 7 | rungOut (again) | -16.91 | 3.2 | -13.9 | -4.99 | -4.95 | -50.5 | -20.2 | -25.7 | -26.8 | -29.1 | -36.4 | -39.5 | -51.3 | -57.4 | -80.7 | 3 |
| seed 7 | keptMouths | -16.82 | 3.4 | -13.8 | -4.87 | -4.84 | -50.6 | -19.9 | -25.8 | -26.8 | -29.4 | -36.4 | -39.6 | -51.4 | -57.1 | -81.8 | 1 |
| seed 7 | keptMouths (again) | -16.79 | 3.4 | -13.9 | -4.86 | -4.83 | -50.7 | -19.9 | -25.8 | -26.6 | -29.3 | -36.5 | -39.5 | -51.4 | -57.4 | -82.0 | 6 |
| seed 22 | today | -15.17 | 2.7 | -12.8 | -3.85 | -3.85 | -54.7 | -18.2 | -24.0 | -26.9 | -33.7 | -30.2 | -36.3 | -50.0 | -55.7 | -57.9 | 8 |
| seed 22 | rungOut | -15.06 | 2.7 | -12.6 | -4.06 | -4.01 | -55.3 | -17.9 | -24.2 | -27.1 | -33.6 | -30.3 | -36.3 | -50.0 | -56.3 | -60.9 | 3 |
| seed 22 | keptMouths | -14.98 | 2.7 | -12.6 | -4.73 | -4.73 | -55.0 | -17.8 | -24.1 | -27.0 | -33.7 | -30.1 | -36.4 | -50.0 | -56.0 | -59.3 | 6 |
| seed 37 | today | -16.72 | 11.2 | -12.8 | -3.75 | -3.74 | -58.5 | -20.5 | -25.0 | -30.1 | -30.9 | -33.5 | -38.1 | -49.7 | -55.4 | -71.8 | 5 |
| seed 37 | rungOut | -16.61 | 11.2 | -12.7 | -4.22 | -4.13 | -58.5 | -20.4 | -24.7 | -30.0 | -30.8 | -33.6 | -38.1 | -49.6 | -55.4 | -71.5 | 5 |
| seed 37 | keptMouths | -16.70 | 11.3 | -12.8 | -4.11 | -4.10 | -58.6 | -20.5 | -24.9 | -30.2 | -30.9 | -33.4 | -38.2 | -49.7 | -54.8 | -67.2 | 5 |

- **Loudness, peaks and the spectrum show no difference between the three
  builds beyond the noise's own.** Two runs of one build (seed 7) differ by
  up to 0.26 LU, 0.1 dB of peak and about 0.4 dB in any octave band below
  8 kHz (2 dB at 16 kHz, where there is almost nothing); the three builds
  differ by no more. `rungOut` came out 0.08–0.11 LU louder than today on
  all three seeds, which is about what restoring 1 % of the ward's sound
  would do, and inside the noise.
- **The cut doesn't show in a picture of the mix.** A count of
  transients (2 ms frames standing over 10 dB above the 0.2 s around them,
  the tap's own holes left out) gives 53–69 a run on seed 7 for every
  build, about 35 on seed 22, and about 480 on seed 37, whose hymn is
  rhythmic. Each cut is one singer of thirty-two, part-way through a
  crossfade. Whether you can hear it is the question.
- **What the test harness measured** (where every mouth can be followed;
  seed 22's first ten minutes; seed 37 at 20 minutes):
  - share of the mouths' sound that reached the room: today 99.1 % in view
    (seed 37 98.4 %) and 45 % hidden; `rungOut` and `keptMouths` 100 %,
    in view and hidden;
  - mouths let go while sound still passed: today 2,699 of 6,811 (seed 37
    9,276 of 21,983); with either switch, none;
  - **every note, event and die is the same** with either switch: twenty
    seeds of twenty minutes each, byte for byte;
  - what the ward builds (four seeds, 20 minutes each): today 172,438 nodes,
    81,795 of them filters; `keptMouths` 93,134 and 22,317. Seed 22's ward:
    about 361 filters a sung line today, 60 with `keptMouths`; 941 nodes a
    minute, 319.
- Nothing here has played on a phone, and the audio thread's share of a
  browser's time was not measured with the switches. What is built is
  smaller with `keptMouths`; what sounds at once is about the same, since a
  mouth only joins the room while it may sound, on every build.

## What there is to decide

- **`rungOut` for everyone?** One word in `kolob-experimental.js`
  (`DEFAULTS`, `rungOut: true`) and a VERSION bump. It changes what you hear
  (no cuts) and, in a background tab, keeps the ward whole.
- **`keptMouths` for everyone?** The same, `keptMouths: true`. Only if you
  hear nothing against `rungOut`, or prefer what you hear.
- Or leave both off. Nothing else depends on them.

## For whoever comes next

- To record the A/B again: `node tools/capture.js --seed 7 --section hymn
  --from 0 --to 185 [--query exp=+rungOut | --query exp=+keptMouths]`; the
  numbers sit in each capture's `…-numbers.json`.
- The switches: `kolob-experimental.js` (`rungOut`, `keptMouths`, both
  `false`), and the code in `kolob-voices-vocal.js` (MOUTHS RUNG OUT, KEPT
  MOUTHS). The cut and the measurements: `PLAN-REFACTOR.md` §4.6 and
  `OPEN-WORK.md` (the refactor's §4.6 follow-ups, and Known issues).

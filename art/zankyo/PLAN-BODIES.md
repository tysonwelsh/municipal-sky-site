# ZANKYŌ — a family of bodies per instrument (road map §2)

*Plan written 2026-09-14 at the owner's ask, after the melodic DNA (rc.64)
and the intercom (rc.67). Nothing here is built yet; the owner sees the
plan first. The owner's read: "the instruments still sound like the same
instruments every night." The DNA answered what they say. This answers
what they are.*

## 1. What is there

Each voice has ONE body, tuned once: the plucked strings share `stringNote`
with a per-layer kit (plectrum, peak, decay, brightness law, sawari,
sparkle) and a pluck position; the shakuhachi has an otsu/kan split at
440 Hz, a bore lowpass at 6× or 10× the note, breath through two formants
(the bore's own at 2.4× the note, a vowel at 2.2–3.4 kHz), yuri at ±12
cents; the hichiriki has two reeds ±4 cents, a reed curve, formants at
1.9–2.6 and 3.1–3.9 kHz, the enbai from below; the shō's pipes are a square
reed with 5th and 7th partials; the kit is an ō-daiko at 95→45 Hz, a shime
at 240→180, the ka at 3.5 kHz; the intercom has its band, stutter and
survive. The console knobs move some of these, but the same knob settings
give the same body every night. So the koto is the same koto.

## 2. What ships

**An INCARNATION per voice per night.** Each voice gets a small table of
three or four named bodies — not new instruments, the same instrument
built differently — and one is drawn at PLAY on a new `bodies` stream
(forked by label, so nothing already seeded moves). A body is a set of
synthesis constants the note function reads where it now reads a literal.
The console's knobs stay what they are: offsets on top of the body, as the
weather is. The night's bodies are one log line at play, 身 bodies, and the
row's name plate carries the body's kana beside the instrument's.

The families, first draft — the names will move once they are heard:

| voice | what varies | the bodies |
|---|---|---|
| koto 箏 | plectrum hardness (brightness base), string age (loop damping → decay and roll-off), pluck position range, sparkle | 新 new strings · 古 old strings · 硬 hard tsume · 柔 soft |
| shamisen 三味線 | sawari amount and colour, bachi attack, body drive | 津軽 Tsugaru (hard, loud sawari) · 長唄 nagauta (lighter, cleaner) · 古 worn |
| biwa 琵琶 | sawari, tremolo rate and count, decay, register bias | 薩摩 satsuma (huge sawari) · 筑前 chikuzen (gentler, faster tremolo) · 平家 heike (slow, low) |
| shakuhachi 尺八 | bore length (lowpass multiple, kan threshold), breath vowel centre, yuri depth and onset, otsu body waveform | 一尺八寸 standard · 二尺三寸 long bore (dark, low kan) · 短 short (bright, airy) · 地無し jinashi (rough bore: more breath, less tone) |
| hichiriki 篳篥 | reed hardness (curve, formant shift), reed detune spread, enbai depth, lowpass | 硬 hard reed · 柔 soft reed · 古 old reed (more buzz, less tone) |
| shō 笙 | partial set (reed sub weight, 5th/7th), cutoff, te-utsuri entry spacing, shimmer | 明 bright · 暗 dark · 古 old (uneven pipes: per-pipe detune) |
| taiko 太鼓 | skin tension (pitch multipliers), damping (decay), shime pitch, ka brightness, kit balance | 締 tight · 緩 slack · 古 old skins · 大 big hall (longer ō-daiko) |
| intercom 内線 | band, staircase steps, formant Q, presence, base stutter and survive | 新 clean line · 古 bad line · 遠 distant (narrow, quiet, more static) |

The landscape (sub-drone, noise, PA, fūrin, ambient) keeps one body: the
road map names the voices, and the landscape is the room they are in.

**The invariant that makes this cheap.** A body touches synthesis only —
filter frequencies, partial weights, envelope shapes, decay lengths, the
sawari's colour — never a phrase's notes, its timing, or a draw on any
melodic stream. So the note stream of every seed is byte-identical to
rc.67 and the harness's density bank does not move: NO RE-BASE. The event
stream gains exactly one line per night (身 bodies), the precedent being
W0's 逸脱 line. `_far-identity.js` proves it: notes identical on every home
seed, events differing by one line at play.

**The bench.** `bodies-lab.php` gains a row per family: one button per
incarnation (`Z.sample("koto", "old")` — the audition takes the named body
for its duration and restores the night's). `?bodies=koto:old,shakuhachi:long`
pins bodies for a night the way `?reel=` pins a reel, so the owner can
listen to one body across a whole night.

## 3. Gates

- REPRO identical on every seed; note streams byte-identical to rc.67 over
  the identity tool's 20 home seeds (events differ by exactly one line).
- Node budget ≤ 1500/min and peak sources ≤ 110 on seeds 3042 / 7 — a body
  may add a partial or a filter, bounded at +10 % nodes.
- Every incarnation of every family drawn at least once across the 40-seed
  base (a histogram in the bank's report).
- Loudness: each incarnation within ±1.5 dB of its base body's peak on the
  bench (the console's meters), so a body is a colour and not a level.
- The owner's listen: the bench first, then two pinned nights with
  different bodies.

## 4. Sequence

1. **The frame and the strings** (VERSION bump): the body tables, the
   `bodies` stream and the draw at play, the 身 log line, the name-plate
   kana, the bench rows and `?bodies=`; koto, shamisen and biwa first
   (they share `stringNote`, so one seam covers three voices). The owner
   listens here.
2. **The winds**: shakuhachi and hichiriki.
3. **The shō and the kit.**
4. **The intercom**: its band / stutter / survive become an incarnation's
   base values; the knobs stay as offsets.

Four commits, each bumping VERSION, none re-basing. About 250 lines in the
engine for the frame and the strings, 60–100 per further family, 40 in the
lab, and the docs.

## 5. Questions for the owner

1. Three or four bodies per voice? (Four for the strings and the
   shakuhachi, three elsewhere, is the draft.)
2. Should the name plate show the body's kana, or only the log line?
3. One body per night (the draft), or may a body change at a sea change?

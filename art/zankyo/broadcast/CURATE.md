# Curating ZANKYŌ's broadcast pool

The station "picks up" 5–15 s of a real broadcast, degraded, then loses it.
This folder is the pool it draws from: one small MP4 **reel** per source
(6–10 non-contiguous ~12 s windows), one manifest JSON per reel, and
`manifest.json` built from those. Plan: `../PLAN-BROADCAST-SIGNAL.md` §5.

## Install once

```
brew install ffmpeg          # yt-dlp is already at ~/anaconda3/bin/yt-dlp
```

## Queue

Drop URLs into `QUEUE.md` with a slug, a tier and a one-line note. Prefer
Archive.org originals. Tier A = free to use (PD, CC, US government);
Tier B = copyrighted, fair-use posture, at most 6 windows, no whole scene,
music windows ≤ 10 s.

## Cut

```
tools/make-reel.sh <url-or-file> --id <slug> --title "…" --year 1951 --license PD \
    [--windows 0:25,1:26,2:32,…] [--tone voice|music|noise|sung|tone] [--weight 1-5] \
    [--tier A|B] [--notes "…"] [--audio-only --picture static|line|wave]
```

- Without `--windows` the tool proposes them (scene changes + a loudness
  gate; nothing black, silent, or in the first/last 3 s) and prints them.
  `--propose` prints the proposal and stops. Re-run with `--windows` to
  choose your own; `1:23` is a 12 s window starting there, `83-95` an
  explicit range, `--window-len 10` changes the default length.
- The source lands in `local-dev/broadcast-src/<slug>.<ext>` (gitignored,
  never committed) and is reused on re-runs.
- Output: `reels/<slug>.mp4` (≈ 1–1.5 MB) and `manifest/<slug>.json`.
- Audio-only sources (numbers stations, Apollo audio) get a generated
  picture: `--picture line` (one line of light, Paik's *Zen for TV*),
  `static` (a slow noise field) or `wave` (the line drawn by the audio).

## Long windows (PLAN-SIGNAL-SHAPES §5)

A reception's ON-AIR time is drawn from the owner's spread — 8–12 s 15 %,
12–18 s 25 %, 18–25 s 25 %, 25–32 s 20 %, 32–40 s 15 % — and a hold longer
than a window would run across a window boundary, which is a hard cut to
another moment of the source. So the receiver degrades every budget to what the
window can serve, and with 12 s windows that is about 8.8 s on air. Until the
reels carry long windows, **the owner's spread is unreachable and the harness's
"achieved" column says so**.

**The recipe.** Each reel keeps its 12 s windows and gains **one or two long
windows**, contiguous, chosen for a stretch that stays interesting that long —
a countdown, a sign-off, a chant, a lecture, a news package, a jingle package.
Spread the lengths across the reels so the whole table is servable: roughly a
third at 18–25 s, a third at 25–32 s, a third at 32–40 s.

- **Tier A** (free to use): up to **40 s**.
- **Tier B** (copyrighted): up to **30 s**, speech or picture material, never a
  whole song and never a whole scene. The owner's ruling, 2026-09-14:
  transformative, degraded, randomly surfaced, no substitute for the original.
  The six-window cap stays and a long window COUNTS toward it, so a Tier B reel
  with six 12 s windows drops one to gain a long one (`--add-windows` does this
  and says so).
- Cost: about +0.5 MB a reel, so the pool goes from 144 MB to roughly 250 MB.
  `scripts/publish.sh` already skips `reels/`; the Actions deploy ships them.

**Propose the whole pool at once** — `propose-long.py` reads each reel's
CACHED analysis log and picks one long window per reel: clear of the windows
the reel already plays (a long window beside them is a new moment of the
source; one on top of them is the same broadcast twice), and scored on its
WORST five seconds rather than its mean, because a 34 s stretch carried by its
loudest ten is the reception the owner said was too short, stretched. The
length is drawn across §5's bands from the reel's id, so the pool ends up able
to serve the whole of §2's table and a re-run proposes the same thing.

```
tools/propose-long.py --all                    # the proposals, best first
tools/propose-long.py --all --json > batch.json
tools/cut-long-batch.sh --plan 24              # the next 24 as commands
tools/cut-long-batch.sh --plan 24 --run        # …and cut them
tools/preview.sh <slug>                        # AUDITION, by ear
```

`--plan N` takes the best N spread across tiers, tones and length bands rather
than the top N of one list — §5's order, so no bucket is served by one kind of
material. A reel with no cached analysis is skipped and says so; re-run the
analysis by cutting it once with `--force-analyze`, or let `make-reel.sh` do it.

**Or one reel at a time:**

```
tools/make-reel.sh <src-or-url> --id <slug> --propose --window-len 30
tools/make-reel.sh <src-or-url> --id <slug> --add-windows 1320-1354
tools/preview.sh <slug>                 # and the reel lab, by ear
tools/build-manifest.sh
```

`--add-windows` reads the reel's own manifest for its current source windows
and its metadata, appends the ranges, re-cuts the whole reel from the cached
source and writes a new `rev` so browsers fetch it fresh. **The existing windows
are passed through verbatim** — a re-cut that re-proposed them would change what
every night that has already drawn this reel sounds like. Ranges are explicit
and in SOURCE seconds; read them off `srcWindows` or off `--propose`. A range
under 13 s is refused (that is just another ordinary window), as is one over
its tier's cap, and so is one that overlaps a window the reel already has.

**What the pool can serve, as a number:**

```
tools/pool-shapes.py                 # per bucket: how many reels reach it
tools/pool-shapes.py --by tone       # …or by tier / country
tools/pool-shapes.py --csv           # one row per reel, longest first
```

Read it against the harness's `on air:` line, which prints ACHIEVED against
ASKED for the same buckets. The gap between them is the work left.

**Order.** A first batch of 60–80 across tiers, tones and countries — so no
bucket is served by one kind of material — then the rest. The owner's ear is
the gate: audition every long window before it lands.

## Audition

```
tools/preview.sh <slug>            # prints the windows, opens the reel in QuickTime
tools/preview.sh <slug> --ffplay   # 4× ffplay window instead
```

Good windows feel *found*: a voice mid-sentence, a jingle, a countdown, a
tone, a face turning to the camera. Cut again if a window is dead air, black,
a whole joke, or a whole song. Set `tone` and `weight` by ear. Once the
bench page (`broadcast-lab.php`) exists, audition there through the receiver
and the phosphor shader.

## Field notes

Hard-won in rounds 2 and 3, by the agents who hit them.

- **Bilibili answers HTTP 412** to a bare yt-dlp. It is beaten by sending a
  full browser header set — User-Agent, Referer, Origin, Accept-Language and
  the `Sec-Fetch-*` trio — and, for an anthology, by fetching one part at a
  time with `?p=N` plus `--no-playlist`. Niconico, VK and Dailymotion have
  needed nothing special.
- **`--band low`** (highpass 60 Hz instead of 200) is the difference between
  hearing a chant or a dungchen and hearing the air above it: a drone
  fundamental sits at 55–160 Hz and the normal band throws all of it away.
  It is applied automatically for `--tone drone` and `--tone tone`, and is
  worth asking for by hand on anything sung.
- **Pre-crop an archivist's watermark before you cut.** At 192×144 a corner
  bug or a caption bar is not a blemish, it is a third of the picture, and it
  destroys the found-signal illusion. Crop the raw file into
  `local-dev/broadcast-src/_crop/<id>.mp4` with ffmpeg, keep the untouched
  download beside it, cut from the crop — and leave the entry's `src` at the
  TRUE source URL, never a local path. A `drawbox` mask was tried and
  rejected: it reads as a mask, not as damage.
- **CC BY-ND is Tier B, not Tier A.** ND forbids derivatives and a reel is
  nothing but a derivative. Likewise, an uploader's PD Mark on material that
  is plainly a broadcaster's presentation is the uploader's opinion, not a
  licence — cut it Tier B.
- **The pitch pass runs itself.** Every finished reel is measured for a
  stable dominant pitch per window; the entry gets `pitchHz` and `tuned`,
  and the receiver uses them to tune a chant or a test tone to the station
  (PLAN-ZANKYO-FAR §11). It reads the reel and never writes it, so nothing
  you cut is changed by it. A reel that is all speech reads `tuned: false`,
  which is correct and not a failure. To re-measure the whole pool:
  `tools/backfill-pitch.py` (`--check` to look without writing).
- **`--propose` exits 2 when nothing passed the gates.** What it printed is
  then an even spread across the source, not a proposal — look at it before
  you trust it. A silent or very quiet transfer is the usual cause, and a
  rendered waveform at boosted gain will tell you whether the source is dead
  or merely recorded 20 dB low; the second kind is worth keeping, because
  `loudnorm` recovers it.
- **`weight` is not read for now** (rc.114: `USE_REEL_WEIGHTS = false` in
  zk-broadcast.js — every reel counts 1; only the picture ×1.5 and the tide
  shape the draw). **Still record a sensible `--weight`** (3 default, 4 for the
  strongest, 2 for filler): the owner will curate the weights and switch them
  back on.
- **Silent prints are allowed** (the owner's ruling, 2026-09-24). A source
  with no audio stream is marked `"silent": true` automatically; a mute print
  whose file still carries hiss or a blank track takes `--silent`. Choose the
  windows by picture with `--windows` (the loudness gate rejects everything on
  a silent source) and cut them `--tone noise`. The receiver does NOT hold the
  crew for a silent reel — the station plays on under the picture, and the
  log line says 默.
- **Log every test card** you see in a source — PM5544, FuBK, Indian-head,
  bars, monoskop, clock cards, stand-by slates, static station cards — with
  SOURCE timecodes, whether or not it lands in a window. The owner will use
  test cards differently later; the register is `TESTCARDS.md` /
  `testcards.json`.
- **Four agents share this tool.** Do not edit `make-reel.sh` while another
  agent is mid-cut with it. The body is wrapped in one braced block so bash
  parses the whole file before running it — that is why — but the courtesy
  still applies to the other tools, which are not protected.

## Commit

```
tools/build-manifest.sh            # validates every entry + reel, writes manifest.json
git add art/zankyo/broadcast/reels/<slug>.mp4 art/zankyo/broadcast/manifest/<slug>.json \
        art/zankyo/broadcast/manifest.json
git commit
```

Only those paths — never `git add -A`. The GitHub Actions deploy ships reels
on the next push to main; the manual `scripts/publish.sh` skips `reels/` on
purpose (they never change after they are cut; a replaced reel gets a new
id). To pull a reel from the lottery without a redeploy of anything else,
set `"takedown": true` in its JSON, rebuild, commit the manifest.

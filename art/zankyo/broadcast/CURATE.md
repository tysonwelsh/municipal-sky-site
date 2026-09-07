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

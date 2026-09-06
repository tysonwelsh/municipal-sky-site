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

# ZANKYŌ — 受信 THE SIGNAL: picking up broadcasts from the distant past

*Roadmap plan, 2026-09-05. Sits AFTER ZANKYŌ 2 phases 0–4 (it needs the Air,
the Conductor's visitation seating and the two rooms). Not started.*

The idea, in the owner's words: the station occasionally picks up a signal at
random from the distant past — which, for a machine in 3042, is our time.
For five to ten seconds a piece of real audio, and a distorted green video,
come through; then it is lost again. The owner curates which videos are in
the pool; the machine chooses when and what.

---

## 1. The two ways to do it, and the recommendation

### Option A — curated clips, extracted once, self-hosted (RECOMMENDED)

The owner picks videos and in-points. A small script on the owner's Mac
extracts a 4–12 s clip of each (audio + tiny video), transcodes it small,
and commits it into `art/zankyo/broadcast/clips/`. The engine treats the
audio like any other sound source: it decodes the clip into an AudioBuffer
and plays it **through the station's own receiver chain** — radio band-pass,
grit, flutter, dropouts, then the reactor-hall room — so the clip is *heard
by the station*, not pasted over it. The video is drawn frame by frame onto
the CRT canvas that already exists, through a green-phosphor shader with
scanlines, tearing, snow and vertical-hold slip, replacing the scope for the
length of the signal.

Why this wins: everything is in our graph (seeded choice, seeded in-point,
sample-accurate entry on the Conductor's clock, audio processed like every
other voice, works through the lock-screen background-audio route, works
offline once loaded, deterministic per `?seed=`), and the video is a real
canvas we can distort per pixel. The only cost is a curation step and
~10 MB of tracked assets.

### Option B — live YouTube via the IFrame Player API

Embed the YouTube player, cue the curated video at an in-point, play it for
N seconds, then stop. What it cannot do, and why it is not recommended:

- **The audio cannot enter the Web Audio graph.** An iframe's audio is
  cross-origin; there is no way to route it through the grit bus, the band-
  pass or the rooms. It would play raw, at YouTube's level, on top of the
  station. The "tuning in" would have to be faked by ducking our music and
  layering our own static beside a clean YouTube feed.
- **The video cannot be processed per pixel** (no canvas access to a cross-
  origin iframe). Only CSS filters over the iframe (hue, contrast, blur) and
  overlays — and YouTube's API terms forbid obscuring or altering the
  player's display, which is exactly what a CRT-phosphor treatment does.
- Playback is not deterministic (ads, regional blocks, buffering, autoplay
  policy needs a gesture per video on iOS), it is a third-party network
  dependency inside an otherwise self-contained instrument, and it does not
  survive backgrounding the way our audio route does.

Option B is worth keeping in mind only as a "watch the full source" link in
the VFD log (a tiny ▶ next to the signal's title that opens the YouTube page
in a new tab) — attribution, not playback.

### The legal note (owner's call, stated plainly)

Extracting clips from YouTube is against YouTube's terms of service even
when the underlying work is public domain, and short clips of copyrighted
material are a gray area even at 5 s. The cleanest pool is public-domain and
Creative Commons material from sources that allow download: the Internet
Archive (Prelinger Archives, NASA, old newsreels, Japanese films now in the
public domain), NHK's open archives where licensed, Wikimedia Commons video.
The same script works on any URL yt-dlp or a direct file URL can read. The
site already follows this discipline for the Rain of Babel portraits. Where
the owner chooses a YouTube-sourced clip anyway, the manifest records the
source URL and the VFD shows attribution; that is the owner's decision.

---

## 2. Option A in detail

*§5 (added after the owner's questions) supersedes the asset format in §2.1
and the source-node choice in §2.2: reels of non-contiguous windows in one
MP4 per source, played through a media element. The gesture, the picture
and the integration points stand.*

### 2.1 Assets and the curation workflow

```
art/zankyo/broadcast/
  manifest.json            # the pool (tracked)
  clips/<id>.ogg           # audio: Opus, mono, 24 kbps, band-limited 200–6 kHz, ~30 KB per 10 s
  clips/<id>.webm          # video: VP9, 192×144, 12 fps, no audio track, ~120 KB per 10 s
  CURATE.md                # the owner's how-to
  tools/make-clip.sh       # yt-dlp + ffmpeg, runs on the owner's Mac only
```

`make-clip.sh <url-or-file> <in-point> <seconds> --id <slug> [--title …] [--year …]`:

1. `yt-dlp` (or a direct file) → temp download of the source.
2. `ffmpeg -ss <in> -t <secs>` → `clips/<slug>.ogg` (Opus mono 24 kbps, a
   200 Hz high-pass and 6 kHz low-pass baked in — the receiver narrows it
   further live) and `clips/<slug>.webm` (VP9, scaled to 192×144, 12 fps,
   desaturated at encode time so the shader has less to fight, no audio).
3. Appends a manifest entry; the owner edits the title/year/notes by hand.

Manifest entry:

```json
{ "id": "apollo-11-1969", "title": "Apollo 11 — go for landing", "year": 1969,
  "src": "https://archive.org/…", "license": "PD", "durS": 9.4,
  "gain": 0.8, "tone": "voice", "weight": 3 }
```

`tone` (voice / music / noise / sung) lets the engine choose by mood
(§2.4); `weight` is the lottery weight; `gain` is per-clip trim measured by
the script (ffmpeg loudnorm) so clips arrive at a common level.

Budget: 30 clips ≈ 5 MB tracked. Deploys like everything else (tracked
files only — the site's publish paths ignore untracked files). Nothing is
fetched at page load except the manifest (~5 KB); a clip is fetched only
when the Conductor has seated a signal in the coming scene.

### 2.2 The receiver — how the audio enters the station

A dedicated layer `broadcast` (放送) on the console with its own volume,
mute and three knobs: **band** (how narrow the radio band is), **flutter**
(signal fading), **grit** (receiver distortion). Chain:

```
AudioBufferSource(clip.ogg, seeded in-point)
  → HPF 300 Hz → LPF 3.4 kHz (band; opens to 200–6 k at band=0)   the radio band
  → gentle tanh waveshaper (grit; pre-attenuated, makeup after)   the receiver
  → AM flutter: gain × (1 − depth·(0.5+0.5·sin(0.4–3 Hz LFO)))    fading
  → dropout gate: seeded 40–120 ms holes, denser as the signal is lost
  → bit-crush stage (a staircase waveshaper, grit-dependent)      the 3042 codec
  → signalGain (the tuning envelope, §2.3)
  → reverbSend of the HULL room (it is heard in the reactor hall)
  → the far-wall delay at a low send (the corridor repeats a syllable)
```

All of it is `PJ2.Voice`-style: envelopes from true zero, one writer per
param, nodes stopped at the end. The clip's buffer is decoded once and
cached per id (the Jukebox's IR cache pattern in `pj2-voice.js`).

### 2.3 The gesture — tuning in, holding, losing it

Seated by the Conductor as a **visitation** (the plan's §4.6 machinery) at an
exact audio time `t0`, only in cycle kinds where it belongs (放送 broadcast
cycles always carry one; 漂流 drift and 沈黙 silence cycles rarely; never in
a 嵐 storm's kyū; never inside a KIRU hush). Rarity: about one in three
cycles, tide-tilted, never two in one cycle, and the synthetic gagaku
broadcast from the main plan becomes the fallback when the pool is empty
or the clip has not loaded (the graceful-thinning rule: skip, never stall).

```
t0−4 s   static rises (the existing ambGlitch/Geiger vocabulary, seeded),
         the noise layer's band-pass narrows and sweeps — the dial turning
t0−1 s   the AIR is claimed by the broadcast with limit 0 for melodic voices
         (the crew stops to listen); the drones, shō and noise keep going
t0       signalGain ramps 0 → 1 over 0.6–1.5 s while the band opens from
         very narrow (800 Hz–1.6 k) to the clip's band; the VFD logs
         「受信」 title · year; the CRT switches to the signal (§2.5)
hold     4–12 s (the clip's length or a seeded window inside it); flutter
         and dropouts breathe with weather.breath; one bonshō may ring
         under it in a rite cycle (the machine answering the past)
loss     over the last 1.5–3 s: dropouts thicken, the band narrows again,
         flutter deepens, then a hard cut with a static burst; signalGain
         to 0; the CRT snaps back to the scope through 0.4 s of snow
t0+dur+2 the AIR is released; the melodic voices return one at a time —
         the shakuhachi first, as if commenting
```

Everything above is seeded from a `visit` stream, so `?seed=` reproduces the
same signal at the same second.

### 2.4 Choosing the signal

The lottery reads the manifest weights, then tilts by context: dark tide →
voice and noise clips; light tide → music and sung; 放送 cycles may chain
two signals a minute apart (the station scanning); a clip that played in
the last three cycles is excluded (a "recent" ring in the visit state).
The in-point is seeded inside `[0, durS − windowS]` when the clip is longer
than the window drawn, so one 12 s clip yields several different 6 s
signals over the weeks.

### 2.5 The picture — the CRT shows the signal

`zk-screen` already holds the scope canvas. The viz gains a **broadcast
mode** driven by the engine's `broadcast` events (`{phase: tuning|hold|
loss, strength: 0..1, id}`):

- A muted `<video>` element (same-origin, so the canvas is never tainted)
  plays `clips/<id>.webm` in sync with the audio (started at the same
  audio-clock time; drift is irrelevant at 10 s).
- Each frame: draw the video to a 96×72 offscreen canvas (deliberately
  low), read pixels, map luminance to a **P39 green phosphor ramp** (black
  → deep green → pale green, with a slight bloom by drawing a blurred copy
  under the sharp one), then draw it up to the screen with `imageSmoothing`
  off so the pixels show.
- On top, driven by `strength`: scanlines (already a CSS overlay — keep),
  **horizontal tearing** (row-offset by a slow sine plus seeded glitch rows),
  **vertical-hold slip** (the picture rolls when strength dips), **snow**
  (noise pixels mixed in at 1 − strength), a **ghost** (the frame drawn a
  few px right at low alpha — multipath), **frame holds** (a frozen frame
  for 100–300 ms on a dropout), and the scope's existing glitch
  displacement at the edges.
- Tuning in: 0.4 s of pure snow resolving into the picture; loss: the
  picture tears, rolls, collapses to a horizontal line, snow, then the
  scope returns. The monitor chin gets a 受信 lamp that lights during a
  signal (one LED, like the power LED there now).
- `document.hidden` → no video (audio still plays); low-power devices
  (`navigator.hardwareConcurrency ≤ 2`) → half frame rate.

### 2.6 Engine integration points (against ZANKYŌ 2 as built)

- A `visit` Rand stream (already planned) draws clip, window, in-point,
  dropout pattern, bonshō yes/no.
- The Conductor's plan seats the signal as a scene-level visitation with a
  `prefetchAt = t0 − 20 s` hook: the engine fetches `clips/<id>.ogg` and
  `.webm` then; if either is not ready by `t0 − 1 s`, the visitation
  degrades to the synthetic gagaku broadcast and logs why.
- The AIR gains a `hold(untilS)` for landscape-level claims (the signal is
  neither a melodic voice nor landscape; it is weather that silences
  speech).
- The console row and PARAM_META entries for `broadcast`; ♪ sample plays a
  2 s tuning-in on a random clip (works while stopped, like other layers).
- The harness gains a mock for `fetch`/`decodeAudioData` so the visitation's
  timing and AIR behavior are gated headlessly; the picture is checked on
  the bench.

### 2.7 A bench for the receiver

`art/zankyo/broadcast-lab.php` in the manner of `art/kolob/bagpipe-lab.php`:
pick a clip, drag band / flutter / grit / dropout density, press "tune in",
watch the CRT shader on a second canvas with strength on a slider. This is
where the owner dials the sound of the receiver once, and where new clips
are auditioned before they enter the manifest.

---

## 3. Phasing and gates

| phase | delivers | gate |
|---|---|---|
| B0 tooling | `make-clip.sh`, `CURATE.md`, manifest schema, 5 PD clips from Archive.org as a starter pool | script produces a ≤ 200 KB clip pair from a URL in one command; manifest validates |
| B1 receiver + gesture | the `broadcast` layer, the tuning/hold/loss gesture, AIR hold, VFD line, seeded choice, prefetch/fallback | harness: one signal per ~3 cycles over 4 h, never in a KIRU, melodic voices silent during hold; bench: the clip audibly *inside* the hull |
| B2 picture | broadcast mode in the viz, phosphor shader, tearing/roll/snow, 受信 lamp | bench at 60 fps on a laptop, ≥ 24 fps on a phone; scope returns cleanly |
| B3 polish | console row, ♪ sample, `document.hidden` handling, attribution link in the VFD, VERSION bump | UI smoke; owner listen |

Owner inputs needed before B0: the first handful of source URLs and
in-points (or the go-ahead to seed the pool from Archive.org while the
owner curates), and the decision on YouTube-sourced material (§1, legal
note).

## 4. What stays the same

The signal is a *visitation* — rare, seeded, never louder than the kyū
wall, never in the hush. The scope, the faceplate and the log are the same
instruments they are now; the CRT simply shows something else for ten
seconds. When there is no network and no pool, ZANKYŌ 2 sounds exactly as
it did without this feature.


---

## 5. Build-out — the owner's questions (2026-09-05)

The owner's framing: 40–50 curated sources, each 1–4 minutes of material,
of which the app plays only 5–15 s per signal; low quality is right for a
signal crossing light-years; high diversity (a listener should not see the
same clip twice unless they play for hours); a mix of ephemera, infomercials,
public-service and industrial film, plus a recognizable show here and there;
and a plan for the copyright side.

### 5.1 The reel format (this changes one thing in §2)

Do **not** store the contiguous 1–4 minutes. Store a **reel**: 6–10
non-contiguous **windows** of ~12 s each, cut from the source, concatenated
into one small file, with the window boundaries in the manifest. The app
plays one window (or a seeded 5–12 s slice inside it) per signal.

Why a reel instead of the whole minutes:

- It is the same diversity: 8 windows × 50 reels = **400 distinct signals**,
  and seeded slicing inside a window multiplies that. At one signal every
  ~3 cycles (about 20 minutes), a listener would need on the order of
  **130 hours** before the machine is forced to repeat; the "recent ring"
  (§2.4) also keeps any one reel out for three cycles.
- It halves the storage and the upload.
- It is the strongest thing we can do for the copyright posture (§5.5): the
  stored file is a handful of ten-second fragments at radio quality, not a
  four-minute excerpt anyone could watch instead of the original.

One file per reel, MP4 (H.264 + AAC), because every browser including iOS
Safari decodes it natively and Bluehost's Apache serves byte ranges for it
(`-movflags +faststart`, keyframe every second so a seek to a window start
costs one keyframe). The app plays the reel through a `<video preload=none>`
element seeked to the window; its audio enters the receiver chain by
`createMediaElementSource` (same-origin, so this works — it is the iframe
case that cannot), and the same element feeds the CRT shader. One element,
audio and picture in sync for free, and only the window's bytes are fetched.

### 5.2 Quality targets — how low, exactly

The CRT shader downsamples to 96×72 before it draws, and the receiver
band-limits the audio again live, so the stored quality only needs to be a
little above what is shown:

| stream | setting | why |
|---|---|---|
| video | 192×144 (4:3, letterbox/crop 16:9 sources), 12 fps, H.264, CRF ~30, grayscale at encode | the shader colors it green anyway; grayscale halves the bitrate; 12 fps reads as a weak signal |
| audio | AAC-LC mono 32 kbps (or HE-AAC 24 kbps), 200 Hz–6 kHz band-pass baked in, loudness-normalized | the receiver narrows it to a radio band live; mono is what a receiver hears |
| keyframes | one per second (`-g 12`) | cheap seeks to any window |
| result | ≈ 13–15 KB per second of reel | |

For very clean sources (a 1080p Simpsons rip) a touch more degradation at
encode (a slight blur, `noise=`) makes the stored asset less of a copy and
does nothing to the look, which the shader owns.

### 5.3 Storage, in numbers

Per reel (8 windows × 12 s = 96 s at ~14 KB/s): **≈ 1.3 MB**.

| where | 50 reels | notes |
|---|---|---|
| the site (tracked assets) | **≈ 65 MB** | contiguous 1–4 min sources instead would be ≈ 100–150 MB |
| the git repo (`.git` is 206 MB today) | +≈ 65 MB once | binary, never rewritten; well under GitHub's limits |
| per signal, fetched by a listener | **≈ 150–200 KB** | one window by byte range, 20 s ahead |
| raw sources on the Mac | **≈ 1 GB** | 360p downloads at 5–8 MB per minute; keep or delete after the reel is cut — they live in gitignored `local-dev/`, the Rain of Babel pattern |
| the manifest at page load | ≈ 8 KB | the only thing fetched before a signal is seated |

Bluehost is not a concern: shared plans carry tens of gigabytes, and a
signal costs a listener less than one photo. The only operational cost is
the manual `scripts/publish.sh`, which uploads *every* tracked file each
run and is already throttled on large runs — so the clips directory must be
added to its exclude list (the GitHub Actions deploy uploads only changed
files and never deletes, so it ships the reels once on the push that adds
them and then leaves them alone). Reels never change after they are cut;
if one is replaced, it is a new file name.

### 5.4 Acquisition — where the signals come from

Tier A, free to use and download (the bulk of the pool, ~35 of 50):

- **Prelinger Archives** (archive.org/details/prelinger) — thousands of
  ephemeral films: industrial, educational, advertising, civil defense,
  home movies. The single richest source for this piece.
- **Internet Archive TV and commercial collections** — classic TV
  commercials, "Ephemeral Films", public-access television, *Computer
  Chronicles*, the AV Geeks collection, Universal Newsreels.
- **US government footage** (public domain): NASA (Apollo air-to-ground,
  mission control, Voyager launch — Apollo audio is the obvious "distant
  past" for a station in 3042), NARA's YouTube channel (National Archives),
  FEMA and Civil Defense films, EBS/EAS test broadcasts, NOAA weather radio.
- **Library of Congress National Screening Room**, **Wikimedia Commons**
  video, **Pond5's public-domain archive**.
- **Numbers stations**: the Conet Project recordings are on archive.org
  under a permissive non-commercial license — shortwave voices reciting
  digits are almost written for this machine.
- **Japanese material that fits the theme**: 1960s–90s Japanese TV
  commercials and station idents (many compilations exist; provenance is
  mixed), NHK sign-offs, JR platform jingles and announcements, sumo and
  weather broadcasts, Japanese films now in the public domain on
  archive.org, early anime openings (copyrighted — Tier B).

Tier B, copyrighted but recognizable (a seasoning, ~10–15 of 50, see §5.5):
a Simpsons couch gag, a Star Trek hail, Twin Peaks' Log Lady, a Ronco or
Jane Fonda infomercial, late-night QVC, a 1989 news bulletin, Y2K coverage,
a Nintendo or Sega commercial, an airline safety video, a corporate
training tape, MTV idents, a Japanese game show, a city-pop TV performance.

Where Archive.org and YouTube hold the same ephemera (they often do — most
YouTube ephemera channels re-upload Prelinger), take the Archive original:
no terms-of-service question and usually a better encode.

### 5.5 The copyright approach (a plan, not legal advice)

The honest framing first: there is no processing step that *makes* a
copyrighted clip free to use. Transformation is one of the four fair-use
factors, weighed case by case, never a safe harbor. What a plan can do is
make every factor point the right way and keep the exposure small enough
that the realistic worst case is a takedown notice we honor in a minute.

- **Purpose and character.** A non-commercial generative art piece in
  which the fragment is a ten-second hallucinated signal, heavily
  processed twice (at encode, then live through the receiver and the
  phosphor shader), recontextualized as a derelict machine's memory. This
  is the strongest factor and the reason the owner's instinct ("its own
  art project") is right — but only if the *stored* asset also reads that
  way, which is why reels replace contiguous minutes.
- **Amount.** Never store more than the windows the machine can play.
  Windows of ~12 s, non-contiguous, and for Tier B sources no more than
  ~6 windows (about a minute of fragments from a 22-minute episode). Never
  the whole of anything, never a complete song, never a scene's punchline
  in full.
- **Market effect.** A 96-second reel of 192×144 grayscale, band-limited
  mono fragments substitutes for nothing. Keep it that way: no "watch the
  full clip" playback in the app, only an attribution line in the VFD.
- **Nature of the work.** Favor factual and ephemeral material (news,
  PSAs, infomercials, industrial film) over highly creative works; that is
  also the aesthetic the owner asked for.
- **Hygiene.** The clips directory gets no index listing and a
  `noindex` header; file names are opaque ids; the manifest carries
  `src`, `license` and a per-entry `takedown: true` switch that removes a
  reel from the lottery without a deploy of anything but the manifest.
  Music is the most aggressively policed category (labels scan the open
  web; networks mostly do not), so music windows stay ≤ 10 s, mid-song,
  and band-limited.
- **YouTube's terms.** Ripping is a breach of YouTube's terms of service
  (a contract matter with Google, not a copyright act); the practical
  risk is to the account used, and it is the owner's call. Public-domain
  works fetched from YouTube are still public domain.
- **What we do not do.** No trademarks in the UI, no implication of
  endorsement, no full title cards, nothing from sources known to pursue
  personal sites (sports leagues, major-label music videos).

If the owner wants a firmer footing for the Tier B pieces, an hour with an
IP lawyer looking at the reel format and this section is the right spend;
the plan is built so that nothing would have to change if the answer is
"drop those ten".

### 5.6 The curation workflow (what the owner actually does)

1. **Install once:** `brew install ffmpeg` (yt-dlp is already on the Mac at
   `~/anaconda3/bin/yt-dlp`; ffmpeg is not installed yet).
2. **Collect** URLs in `art/zankyo/broadcast/QUEUE.md`, one per line, with
   optional timestamps and a one-line note ("Apollo 11 PDI, the 1202
   alarm"). Anything yt-dlp or a direct URL can read; Archive.org
   preferred.
3. **Cut:** `tools/make-reel.sh <url> --id apollo-11-pdi [--windows 1:23,2:10,…]`
   downloads the source into `local-dev/broadcast-src/`, proposes windows
   if none are given (scene-change detection plus a loudness gate so it
   avoids silence and black), encodes the reel to §5.2, measures loudness
   for the manifest's `gain`, and appends the manifest entry with `src`,
   `license` (the owner fills this in), `tone` and `weight`.
4. **Audition** in `broadcast-lab.php`: play each window through the
   receiver and the shader, untick weak windows (the tool re-cuts the reel
   without them), set `tone` and `weight`.
5. **Commit** the reel and the manifest (`git add` of those paths only).
   The Actions deploy ships them on the next push to main; the manual
   publish skips them by the exclude added in B0.

Time per source, after the first few: about five minutes. Fifty sources
is an afternoon or two spread over a couple of weekends, mostly spent
choosing.

### 5.7 Adjusted phase B0

B0 now also delivers: the reel encoder with window proposal, the manifest
`takedown`/`license` fields, the `publish.sh` exclude, the `noindex` and
no-listing rules for the clips directory, `QUEUE.md`, and a **starter pool
of eight Tier A reels** cut from Prelinger, NASA and the Conet Project so
B1 and B2 can be built and heard before the owner's own curation lands.

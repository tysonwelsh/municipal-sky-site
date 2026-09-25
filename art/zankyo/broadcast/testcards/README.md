# ZANKYŌ test-card library

This folder holds short clips of broadcast test cards, colour bars, stand-by slates and confirmed clock and station cards. They are cut from sources already on disk: the existing reel pool, audited in `local-dev/reels5/testcards/EXISTING.md`, plus the round-5 sources.

**Nothing reads this folder yet.** The clips are **not** in the reel lottery: they are not in `manifest.json` or `manifest/`, and `zk-broadcast.js` never loads them. They are ready for a future, separate use of test cards, which is not designed here.

## Files

- `<id>.mp4` is the **app clip**. It uses the reel chain from `tools/make-reel.sh`: 192×144 greyscale at 12 fps, H.264 (`-preset slow -tune stillimage -crf 30`, a keyframe every 4 s), and mono AAC at 32 kbps band-passed 200 Hz–6 kHz, with two-pass `loudnorm I=-18 TP=-2`. Unlike a reel, each clip is **one contiguous span** with no windows. A span that measures below −50 LUFS (tape hiss only), or one flagged `--silent`, gets a silent track and is **not** normalised. Every clip is under 2 MB, and a static card is usually well under.
- `testcards.json` is the index. Each entry has `id`, `title`, `kind`, `station`, `country`, `year`, `srcReel`, `srcUrl` (the source reel manifest's `src`), `srcStart`, `srcEnd`, `durS`, `audio`, `tier`, `license` (both from the source reel), `master`, and `notes`, plus `bytes`. A clip joined from several stretches also has a `spans` list; for those, `srcStart`/`srcEnd` are the first start and the last end.
- The **master clips** are **not published** and are not in Git. They live at `~/Media/zankyo-broadcast-src/_testcards/<id>.mp4` (`local-dev/broadcast-src/_testcards/`). Each covers the same span at the source's own resolution, in colour, as x264 crf 18 with the original audio in AAC 128k (stereo when the source is stereo). The `master` field points to them.

## Re-cutting

```sh
# one clip: source id (looked up in local-dev/broadcast-src/) or a file path
art/zankyo/broadcast/tools/cut-testcard.sh kctv-testcard-thaicom-2003 \
    --id tc-kctv-testcard-2003 --span 300-480

# up to three stretches of one source, joined with hard cuts (max 3:00 total)
art/zankyo/broadcast/tools/cut-testcard.sh pk-tvdx-ptv-1994 \
    --id tc-ptv-pst-clock-1994 --span 274-291,619.5-628.5,1155-1168

# the whole library, from testcards.json (entries whose audio starts "silent" get --silent)
art/zankyo/broadcast/tools/cut-testcard.sh --all
```

Other options are `--silent`, `--silent-below <LUFS>`, `--app-only`, `--master-only` and `--max-kb` (default 2048; the tool raises the crf until the clip fits). The tool never downloads. If a source is not on disk, it stops. `cut-testcard.sh` writes only the two clips. Keep `testcards.json` up to date by hand.

## Selection rules

- One clip per **distinct** card, meaning one pattern from one station or era. When a card appears more than once, the longest clean stretch was taken. A card with different audio from the same station is kept twice only if both stretches are substantial (KCTV 2003: music, and the tone before sign-on).
- Each clip is about 2–3 minutes and never over 3:00. A card that exists for less time is cut in full, never looped or padded. Many clocks and station cards are only a few seconds long.
- Clock and station cards are included only when the audit confirmed them. Near-identical designs are grouped (SABC clock 1977/1985, MBC sponsor clocks, the 1989/1990 ЦТ sign-off card). Borderline caption slides and interlude cards are left out.
- The pre-2000 rule of the reel pool does not apply here.

## Clips
| id | kind | station | year | dur | audio | source reel |
|---|---|---|---|---|---|---|
| `tc-bbc1-test-card-f-1979` | Test Card F | BBC1 (GB) | 1979 | 0:41.0 | music (Test Card F library music), announcer at the end | `bbc1-testcard-news-1979` |
| `tc-cst-monoskop-tv2-1985` | ČST monoskop | ČST (TV2) (CZ) | 1985 | 0:13.2 | 1 kHz tone | `cst-vysilani-znelky` |
| `tc-ct2-fubk-1994` | FuBK | ČT2 (HSR Praha) (CZ) | 1994 | 0:39.0 | 1 kHz tone | `ct2-testcard-1994` |
| `tc-tve-carta-de-ajuste-1984` | carta de ajuste | TVE-2 Barcelona (ES) | 1984 | 2:03.0 | music | `es-tvdx-tve2-catala-1984` |
| `tc-jrt-fubk-1985` | FuBK | JRT (SRJ V3) (RS) | 1985 | 0:09.2 | 1 kHz tone | `jrt-jugoslavija-spice` |
| `tc-kabc7-abc-circle-1989` | ABC circle | KABC-TV 7 Los Angeles (US) | 1989 | 0:26.7 | silent (tape hiss only) | `kabc7-signoff-1989` |
| `tc-kctv-testcard-1994` | KCTV | KCTV (조선중앙텔레비죤) (KP) | 1994 | 3:00.0 | announcer/programme audio, then a pulsed ~755 Hz tone from ~188 s | `kctv-signon-1994` |
| `tc-kctv-testcard-2003` | KCTV | KCTV (조선중앙텔레비죤) (KP) | 2003 | 3:00.0 | music | `kctv-testcard-thaicom-2003` |
| `tc-kctv-testcard-tone-2003` | KCTV | KCTV (조선중앙텔레비죤) (KP) | 2003 | 1:10.0 | pulsed ~755 Hz tone | `kctv-testcard-thaicom-2003` |
| `tc-rtm-tv1-pm5544-1991` | PM5544 | RTM TV1 Malaysia (MY) | 1991 | 2:56.5 | announcer | `my-rtm-tv1-dx-1991` |
| `tc-ptv-pm5544-1994` | PM5544 | PTV Islamabad (PK) | 1994 | 0:51.0 | 1 kHz tone | `pk-tvdx-ptv-1994` |
| `tc-rtbf1-pm5544-1994` | PM5544 | RTBF 1 (BE) | 1994 | 0:39.0 | announcer | `rtbf-testcard-1994` |
| `tc-rte-405-line-1970` | 405-line | RTÉ (405-line VHF) (IE) | 1970 | 3:00.0 | music | `rte-testcard-405-vhf` |
| `tc-sabc-pm5544-1977` | PM5544 | SABC/SAUK (ZA) | 1977 | 3:00.0 | music (organ) under the card | `sabc-closedown-1977` |
| `tc-sabc-tv1-pm5544-1985` | PM5544 | SABC TV1 (ZA) | 1985 | 0:59.0 | announcer | `sabc-tv1-opening-1985` |
| `tc-sbc5-pm5544-1991` | PM5544 | SBC 5 Singapore (SG) | 1991 | 1:39.0 | announcer | `sg-sbc5-dx-1991` |
| `tc-ct-ueit-1980` | UEIT | ЦТ СССР, Первая программа (RU) | 1980 | 0:10.0 | 1 kHz tone | `sovetskoe-tv-efir-1970s` |
| `tc-irib2-testcard-1994` | IRIB | IRIB-2 Tehran (IR) | 1994 | 0:52.2 | 1 kHz tone | `tvdx-irib2-tehran-1994` |
| `tc-irib2-bars-1994` | bars | IRIB-2 Tehran (IR) | 1994 | 0:29.9 | 1 kHz tone | `tvdx-irib2-tehran-1994` |
| `tc-ntv-joax-testcard-1992` | NTV | NTV (JOAX-TV) Tokyo (JP) | 1992 | 1:02.0 | music | `tvdx-joax-1992` |
| `tc-rik1-pm5544-1992` | PM5544 | RIK 1 Cyprus (CY) | 1992 | 0:41.2 | announcer | `tvdx-pik1-cyprus-1992` |
| `tc-qtv-pm5544-1993` | PM5544 | Qatar TV (QA) | 1993 | 0:58.5 | 988 Hz tone | `tvdx-qtv-qatar-1993` |
| `tc-ttv-pm5544-1991` | PM5544 | TTV Taiwan (TW) | 1991 | 1:44.0 | announcer | `tw-ttv-dx-1991` |
| `tc-etv-eesti-ueit-1979` | UEIT | ETV (Eesti Televisioon) (EE) | 1979 | 0:03.0 | speech (interview) | `ee-ak-teletorni-signaal-1979` |
| `tc-htv-wales-bars-1982` | bars | HTV Wales (GB) | 1982 | 0:09.0 | 949 Hz tone | `htv-wales-closedown-1982` |
| `tc-trt1-bars-1986` | bars | TRT 1 (TR) | 1986 | 0:09.3 | silent (tape hiss only) | `trt1-kapanis-1986` |
| `tc-srt-syria-bars-1984` | bars | Syrian Arab TV (SY) | 1984 | 0:12.0 | announcer | `tvdx-srt-syria-1984` |
| `tc-wfld32-bars-1983` | bars | WFLD 32 Chicago (US) | 1983 | 1:48.2 | 1070 Hz tone | `wfld32-limbo-signoff-1983` |
| `tc-wgn9-bars-1979` | bars | WGN 9 Chicago (US) | 1979 | 0:42.7 | 379 Hz tone | `wgn9-five-minutes-to-live-by-1979` |
| `tc-canal9-bars-1994` | bars | Canal 9 Bahía Blanca (AR) | 1994 | 0:15.8 | silent (tape hiss only) | `canal9-bahia-blanca-cierre-1994` |
| `tc-ct-technical-break-1988` | stand-by slate | ЦТ СССР, Первая программа (RU) | 1988 | 0:08.1 | silent (tape hiss only) | `cccp-zastavki-1952-1991` |
| `tc-fuji-jocx-standby-1988` | stand-by slate | Fuji TV (JOCX-TV) (JP) | 1988 | 0:39.3 | announcer | `fuji-jocx-signoff-1988` |
| `tc-bbc1-clock-1979` | clock | BBC1 (GB) | 1979 | 0:29.3 | announcer | `bbc1-testcard-news-1979` |
| `tc-ct-programme-clock-1989` | clock | ЦТ СССР, Первая программа (RU) | 1989 | 0:35.0 | music | `cccp-zastavki-1952-1991` |
| `tc-srg-drs-clock-1982` | clock | SRG DRS (CH) | 1982 | 0:17.0 | silent (tape hiss only) | `ch-srgdrs-sendeschluss-1982` |
| `tc-cst-clock-1985` | clock | ČST (CZ) | 1985 | 0:05.0 | announcer | `cst-vysilani-znelky` |
| `tc-ct2-sphere-clock-1994` | clock | ČT2 (CZ) | 1994 | 0:19.0 | silent (near-silent tape) | `ct2-testcard-1994` |
| `tc-ddr1-clock-1983` | clock | Fernsehen der DDR (1) (DE) | 1983 | 0:59.0 | announcer | `ddr-programmstart-1983` |
| `tc-ard-clock-1976` | clock | ARD (Deutsches Fernsehen) (DE) | 1976 | 0:11.5 | silent (only a ~100 Hz hum below the 200 Hz band edge; the master keeps it) | `de-ard-abend-1976` |
| `tc-ert-clock-1985` | clock | ERT (GR) | 1985 | 0:49.6 | silent (hum and hiss only, ~-42 LUFS) | `ert-roloi-1985` |
| `tc-etv-cairo-clock-1985` | clock | Egyptian TV, Channel 1 (EG) | 1985 | 0:18.8 | singing | `etv-cairo-clock-1980s` |
| `tc-yle-tv2-clock-1985` | clock | YLE TV2 (FI) | 1985 | 0:06.0 | announcer | `fi-yle-mtv-1985` |
| `tc-htv-wales-clock-1982` | clock | HTV Wales (GB) | 1982 | 0:16.2 | announcer | `htv-wales-closedown-1982` |
| `tc-tvri-clock-1989` | clock | TVRI (ID) | 1989 | 0:15.4 | announcer | `id-tvri-berita-1989` |
| `tc-tvri-clock-1980` | clock | TVRI (ID) | 1980 | 0:28.3 | announcer | `tvri-jakarta-1980` |
| `tc-mbc-clock-1980s` | clock | MBC Korea (KR) | 1985 | 3:00.0 | time-signal pips and sponsor jingles | `kr-mbc-siho-clock-1980s` |
| `tc-rtm-raymond-weil-clock-1991` | clock | RTM TV1 Malaysia (MY) | 1991 | 0:10.0 | announcer | `my-rtm-tv1-dx-1991` |
| `tc-sbc5-raymond-weil-clock-1991` | clock | SBC 5 Singapore (SG) | 1991 | 0:02.5 | announcer | `sg-sbc5-dx-1991` |
| `tc-nta2-clock-1985` | clock | NTA2 Channel 5 Lagos (NG) | 1985 | 0:13.0 | silent (tape hiss only) | `nta2-lagos-continuity-1985` |
| `tc-ptv-pst-clock-1994` | clock | PTV (PK) | 1994 | 0:39.1 | hiss and announcer (mixed across the three cuts) | `pk-tvdx-ptv-1994` |
| `tc-sabc-clock-1985` | clock | SABC TV1 (ZA) | 1985 | 1:00.0 | announcer | `sabc-tv1-opening-1985` |
| `tc-trt1-clock-1986` | clock | TRT 1 (TR) | 1986 | 0:12.0 | announcer | `trt1-kapanis-1986` |
| `tc-irib2-clock-1994` | clock | IRIB-2 Tehran (IR) | 1994 | 0:26.0 | announcer | `tvdx-irib2-tehran-1994` |
| `tc-rik1-clock-1992` | clock | RIK 1 Cyprus (CY) | 1992 | 1:33.1 | announcer | `tvdx-pik1-cyprus-1992` |
| `tc-cbc-joar-transmitter-card-1984` | station card | CBC TV Nagoya (JOAR-TV) (JP) | 1984 | 0:17.0 | announcer | `cbc-nagoya-closedown-1984` |
| `tc-ct-ne-zabudte-1989` | station card | ЦТ СССР, Первая программа (RU) | 1989 | 0:16.0 | music, then silent | `cccp-zastavki-1952-1991` |
| `tc-ct-ne-zabudte-1980` | station card | ЦТ СССР, Первая программа (RU) | 1980 | 0:14.5 | announcer | `sovetskoe-tv-efir-1970s` |
| `tc-ct-date-caption-1980` | station card | ЦТ СССР, Первая программа (RU) | 1980 | 0:08.7 | announcer | `sovetskoe-tv-efir-1970s` |
| `tc-dff1-transmitter-card-1990` | station card | DFF 1 (DE) | 1990 | 1:52.0 | silent (tape hiss only) | `dff1-sendeschluss-1990` |
| `tc-iraq-tv-signon-card-1982` | station card | Iraqi TV (IQ) | 1982 | 1:46.0 | music | `iraq-tv-iftitah-1982` |
| `tc-mtv1-goodnight-1989` | station card | Magyar Televízió TV1 (HU) | 1989 | 0:18.0 | silent (tape hiss only) | `mtv1-musorzaras-1989` |
| `tc-nhk-joak-signoff-1982` | station card | NHK General TV (JOAK-TV) (JP) | 1982 | 0:38.0 | announcer | `nhk-joak-closedown-1982` |
| `tc-wfld32-limbo-logo-1983` | station card | WFLD 32 Chicago (US) | 1983 | 3:00.0 | silent (tape hiss only) | `wfld32-limbo-signoff-1983` |
| `tc-rca-indian-head-1961` | RCA Indian-head | Matsushita (RCA pattern) (JP) | 1961 | 0:16.8 | narration (Japanese) over score | `jp-kagakueizo-denshi-television-1961` |
| `tc-matsushita-bars-1961` | bars | Matsushita (film) (JP) | 1961 | 0:02.4 | narration (Japanese) | `jp-kagakueizo-denshi-television-1961` |
| `tc-nasa-goddard-card-1964` | station card | NASA Goddard (satellite relay) (JP) | 1964 | 0:03.8 | narration (Japanese) | `jp-kagakueizo-eisei-tsushin-1964` |

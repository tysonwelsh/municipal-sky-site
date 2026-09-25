# ZANKYŌ broadcast pool: test cards in the existing 252 reels

This covers the 252 reels in `git HEAD:art/zankyo/broadcast/manifest.json`, before round 5. Round-5 ids are not covered: they are untracked, and `cn-bilibili.json` in this folder belongs to a round-5 cutter.

**Method.** (1) Text pass over title and notes for all 252 reels (test card, testcard, monoskop, Testbild, carta de ajuste, bars, sign-off/on, closedown, Sendeschluss, znělka, clock, PM5544, FuBK, stand by…). 71 reels were flagged, and every one got a 4×4 contact sheet in `sheets/`. (2) Frozen-picture pass on every reel: the earlier run's `still.json` (12-frame differencing) and `fd/` (ffmpeg freezedetect), merged into 546 still stretches of 2 s or more. Each was viewed as a thumbnail, and every window of every picture reel was also viewed (1,588 thumbnails). (3) Each hit was confirmed on a frame pulled from the full-resolution raw source (reel time mapped through windows/srcWindows), and its extent was measured by differencing against that frame. (4) For the flagged reels, the raw source was scanned at 1 fps outside the windows for held pictures and for stretches matching each confirmed card. Those hits are logged with `window: null` and `reelStart/End: null`.

**Audio** is measured on the reel (or on the source for out-of-window entries). "Steady test tone" means a single spectral peak holds more than 60 % of the energy in at least 95 % of frames.

## Counts by kind

| kind | entries | in a window | confirmed | likely | borderline |
|---|---|---|---|---|---|
| test card | 70 | 42 | 67 | 3 | 0 |
| station card | 58 | 44 | 21 | 22 | 15 |
| clock card | 45 | 21 | 43 | 2 | 0 |
| colour bars | 8 | 1 | 7 | 0 | 1 |
| stand-by slate | 8 | 6 | 3 | 5 | 0 |
| caption slide | 5 | 5 | 0 | 0 | 5 |
| interlude card | 4 | 4 | 0 | 2 | 2 |
| **total** | **198** | **123** | 141 | 34 | 23 |

Reels with a true test card or colour bars inside a window: **20**: bbc1-testcard-news-1979, canal9-bahia-blanca-cierre-1994, cst-vysilani-znelky, ct2-testcard-1994, es-tvdx-tve2-catala-1984, jrt-jugoslavija-spice, kctv-signon-1994, kctv-testcard-thaicom-2003, my-rtm-tv1-dx-1991, pk-tvdx-ptv-1994, rtbf-testcard-1994, rte-testcard-405-vhf, sabc-closedown-1977, sabc-tv1-opening-1985, sg-sbc5-dx-1991, sovetskoe-tv-efir-1970s, tvdx-irib2-tehran-1994, tvdx-joax-1992, tvdx-qtv-qatar-1993, tw-ttv-dx-1991.

Out-of-window material worth cutting: **colour bars** in `htv-wales-closedown-1982`, `trt1-kapanis-1986`, `tvdx-srt-syria-1984`, `wfld32-limbo-signoff-1983` and `wgn9-five-minutes-to-live-by-1979`; a **PM5544** in `tvdx-pik1-cyprus-1992` (0-58 s); the **ABC circle pattern** in `kabc7-signoff-1989`; the ЦТ **technical-break slate** in `cccp-zastavki-1952-1991`; and long test-card runs in `kctv-testcard-thaicom-2003` (about 25 min), `sabc-closedown-1977` and `rte-testcard-405-vhf`.

## Entries

| reel | win | reel s | src s | kind | conf | audio | frame |
|---|---|---|---|---|---|---|---|
| at-orf1-sendeschluss-1992 | 0 | 0.0–10.2 | 5–15 | station card (teletext service card) | borderline | voice | [png](frames/existing-at-orf1-sendeschluss-1992-5.1.png) |
| bbc1-ni-closedown-1973 | 1 | 12.0–24.0 | 44–56 | station card (ident held over news audio) | likely | voice | [png](frames/existing-bbc1-ni-closedown-1973-18.0.png) |
| bbc1-ni-closedown-1973 | 2 | 24.0–36.0 | 110–122 | station card (ident held over news audio) | likely | voice | [png](frames/existing-bbc1-ni-closedown-1973-30.0.png) |
| bbc1-ni-closedown-1973 | 5 | 60.0–86.2 | 277–303 | station card (closedown ident) | likely | voice | [png](frames/existing-bbc1-ni-closedown-1973-73.1.png) |
| bbc1-testcard-news-1979 | 0 | 0.0–12.0 | 12–24 | test card: BBC Test Card F | confirmed | Test Card F library music | [png](frames/existing-bbc1-testcard-news-1979-6.0.png) |
| bbc1-testcard-news-1979 | 1 | 12.0–24.0 | 30–42 | test card: BBC Test Card F | confirmed | Test Card F library music | [png](frames/existing-bbc1-testcard-news-1979-18.0.png) |
| bbc1-testcard-news-1979 | 2 | 30.2–36.0 | 84–90 | caption slide (continuity) | borderline | voice | [png](frames/existing-bbc1-testcard-news-1979-33.1.png) |
| bbc1-testcard-news-1979 | 3 | 36.0–48.0 | 110–122 | caption slide (continuity) | borderline | voice | [png](frames/existing-bbc1-testcard-news-1979-42.0.png) |
| bbc1-testcard-news-1979 | 4 | 48.0–77.2 | 135–164 | caption slide (continuity) | borderline | voice | [png](frames/existing-bbc1-testcard-news-1979-62.6.png) |
| bbc1-testcard-news-1979 | 5 | 77.8–89.2 | 169–180 | clock card | confirmed | voice | [png](frames/existing-bbc1-testcard-news-1979-83.5.png) |
| bbc1-testcard-news-1979 | – | – | 24–30 | test card: BBC Test Card F | confirmed | source audio: voice | [png](frames/existing-bbc1-testcard-news-1979-src27.png) |
| bbc1-testcard-news-1979 | – | – | 42–49 | test card: BBC Test Card F | confirmed | source audio: voice | [png](frames/existing-bbc1-testcard-news-1979-src46.png) |
| bbc1-testcard-news-1979 | – | – | 180–199 | clock card | confirmed | source audio: voice | [png](frames/existing-bbc1-testcard-news-1979-src190.png) |
| canal9-bahia-blanca-cierre-1994 | 0 | 2.2–7.6 | 10–16 | station card (reflection slide) | borderline | voice | [png](frames/existing-canal9-bahia-blanca-cierre-1994-4.9.png) |
| canal9-bahia-blanca-cierre-1994 | 5 | 72.1–84.1 | 210–222 | station card (sign-off) | likely | voice | [png](frames/existing-canal9-bahia-blanca-cierre-1994-78.1.png) |
| canal9-bahia-blanca-cierre-1994 | 6 | 84.1–88.0 | 228–232 | station card (sign-off) | likely | voice | [png](frames/existing-canal9-bahia-blanca-cierre-1994-86.0.png) |
| canal9-bahia-blanca-cierre-1994 | 6 | 88.1–96.1 | 232–240 | colour bars | confirmed | near-silent (tape hiss) | [png](frames/existing-canal9-bahia-blanca-cierre-1994-92.1.png) |
| canal9-bahia-blanca-cierre-1994 | – | – | 240–248 | colour bars | confirmed | near-silent (tape hiss) | [png](frames/existing-canal9-bahia-blanca-cierre-1994-src244.png) |
| cbc-nagoya-closedown-1984 | 4 | 68.8–73.2 | 904–908 | station card (sign-off, transmitter power) | confirmed | voice | [png](frames/existing-cbc-nagoya-closedown-1984-71.0.png) |
| cbc-nagoya-closedown-1984 | 5 | 73.2–77.8 | 908–913 | station card (sign-off, transmitter power) | confirmed | voice | [png](frames/existing-cbc-nagoya-closedown-1984-75.5.png) |
| cccp-zastavki-1952-1991 | 0 | 0.0–28.3 | 9–37 | station card (republic emblem cards) | borderline | music | [png](frames/existing-cccp-zastavki-1952-1991-14.2.png) |
| cccp-zastavki-1952-1991 | 1 | 28.3–30.3 | 41–43 | station card (republic emblem cards) | borderline | music | [png](frames/existing-cccp-zastavki-1952-1991-29.3.png) |
| cccp-zastavki-1952-1991 | 1 | 34.2–38.3 | 47–51 | station card (1952 Central Television card) | likely | music | [png](frames/existing-cccp-zastavki-1952-1991-36.3.png) |
| cccp-zastavki-1952-1991 | 4 | 58.3–65.8 | 259–266 | station card (sign-off: НЕ ЗАБУДЬТЕ ВЫКЛЮЧИТЬ ТЕЛЕВИЗОР) | confirmed | music | [png](frames/existing-cccp-zastavki-1952-1991-62.0.png) |
| cccp-zastavki-1952-1991 | 5 | 68.3–78.3 | 299–309 | clock card (programme ident with clock) | likely | music | [png](frames/existing-cccp-zastavki-1952-1991-73.3.png) |
| cccp-zastavki-1952-1991 | – | – | 280–289 | stand-by slate (technical break) | confirmed | near-silent (tape hiss) | [png](frames/existing-cccp-zastavki-1952-1991-src284.png) |
| cccp-zastavki-1952-1991 | – | – | 309–330 | clock card (programme ident with clock) | confirmed | source audio: music | [png](frames/existing-cccp-zastavki-1952-1991-src320.png) |
| cccp-zastavki-1952-1991 | – | – | 330–337 | station card (sign-off) | confirmed | source audio: music | [png](frames/existing-cccp-zastavki-1952-1991-src334.png) |
| cccp-zastavki-1952-1991 | – | – | 535–544 | station card (sign-off) | confirmed | near-silent (tape hiss) | [png](frames/existing-cccp-zastavki-1952-1991-src540.png) |
| ch-srgdrs-sendeschluss-1982 | – | – | 10–27 | clock card | confirmed | near-silent (tape hiss) | [png](frames/existing-ch-srgdrs-sendeschluss-1982-src18.png) |
| cst-vysilani-znelky | 0 | 0.2–12.0 | 0–12 | test card: ČST monoskop (TV2) | confirmed | steady test tone ~1012 Hz | [png](frames/existing-cst-vysilani-znelky-6.1.png) |
| cst-vysilani-znelky | 1 | 17.2–24.0 | 21–28 | station card (sign-on ident) | likely | voice | [png](frames/existing-cst-vysilani-znelky-20.6.png) |
| cst-vysilani-znelky | 2 | 24.0–35.5 | 32–44 | station card (sign-on ident) | likely | voice | [png](frames/existing-cst-vysilani-znelky-29.8.png) |
| cst-vysilani-znelky | – | – | 44–49 | clock card | confirmed | source audio: voice | [png](frames/existing-cst-vysilani-znelky-src46.png) |
| ct2-testcard-1994 | 0 | 0.0–12.0 | 10–22 | test card: FuBK (HSR PRAHA) | confirmed | steady test tone ~1023 Hz | [png](frames/existing-ct2-testcard-1994-6.0.png) |
| ct2-testcard-1994 | 1 | 12.0–22.2 | 62–72 | interlude card (ČT2 sphere animation) | borderline | music/tone | [png](frames/existing-ct2-testcard-1994-17.1.png) |
| ct2-testcard-1994 | – | – | 0–10 | test card: FuBK (HSR PRAHA) | confirmed | steady test tone ~1023 Hz | [png](frames/existing-ct2-testcard-1994-src5.png) |
| ct2-testcard-1994 | – | – | 22–39 | test card: FuBK (HSR PRAHA) | confirmed | steady test tone ~1023 Hz | [png](frames/existing-ct2-testcard-1994-src30.png) |
| ct2-testcard-1994 | – | – | 42–61 | clock card (sphere interval card with time) | confirmed | source audio: music/tone | [png](frames/existing-ct2-testcard-1994-src52.png) |
| ddr-programmstart-1983 | 1 | 12.0–24.0 | 175–187 | clock card | confirmed | voice | [png](frames/existing-ddr-programmstart-1983-18.0.png) |
| ddr-programmstart-1983 | 2 | 24.0–36.0 | 215–227 | station card (sign-on date card) | likely | voice | [png](frames/existing-ddr-programmstart-1983-30.0.png) |
| ddr-programmstart-1983 | 3 | 36.0–65.7 | 229–259 | station card (sign-on date card) | likely | voice | [png](frames/existing-ddr-programmstart-1983-50.8.png) |
| ddr-programmstart-1983 | – | – | 150–175 | clock card | confirmed | source audio: voice | [png](frames/existing-ddr-programmstart-1983-src162.png) |
| de-ard-abend-1976 | 2 | 25.1–36.0 | 397–408 | station ident card (ARD) | borderline | voice | [png](frames/existing-de-ard-abend-1976-30.5.png) |
| de-ard-abend-1976 | – | – | 845–857 | clock card | confirmed | steady test tone ~102 Hz | [png](frames/existing-de-ard-abend-1976-src851.png) |
| dff1-sendeschluss-1990 | – | – | 355–466 | station card (sign-off transmitter card) | confirmed | near-silent (tape hiss) | [png](frames/existing-dff1-sendeschluss-1990-src410.png) |
| ert-roloi-1985 | 0 | 0.0–12.0 | 5–17 | clock card | confirmed | near-silent (tape hiss) | [png](frames/existing-ert-roloi-1985-6.0.png) |
| ert-roloi-1985 | 1 | 12.0–24.0 | 30–42 | clock card | confirmed | near-silent (tape hiss) | [png](frames/existing-ert-roloi-1985-18.0.png) |
| ert-roloi-1985 | – | – | 17–30 | clock card | confirmed | near-silent (tape hiss) | [png](frames/existing-ert-roloi-1985-src24.png) |
| es-tvdx-tve2-catala-1984 | 0 | 1.3–12.0 | 6–16 | test card: TVE carta de ajuste with clock | confirmed | music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-6.7.png) |
| es-tvdx-tve2-catala-1984 | 1 | 12.0–39.4 | 23–50 | test card: TVE carta de ajuste with clock | confirmed | music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-25.7.png) |
| es-tvdx-tve2-catala-1984 | 2 | 39.4–51.5 | 60–72 | test card: TVE carta de ajuste with clock | confirmed | music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-45.5.png) |
| es-tvdx-tve2-catala-1984 | 3 | 51.5–63.6 | 95–107 | test card: TVE carta de ajuste with clock | confirmed | music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-57.5.png) |
| es-tvdx-tve2-catala-1984 | 5 | 80.2–86.9 | 173–179 | station ident (TVE Circuit Català) | borderline | music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-83.6.png) |
| es-tvdx-tve2-catala-1984 | – | – | 72–95 | test card: TVE carta de ajuste with clock | confirmed | source audio: music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-src84.png) |
| es-tvdx-tve2-catala-1984 | – | – | 107–129 | test card: TVE carta de ajuste with clock | confirmed | source audio: music over the carta de ajuste (DX reception) | [png](frames/existing-es-tvdx-tve2-catala-1984-src118.png) |
| etv-cairo-clock-1980s | 0 | 0.0–12.0 | 4–16 | clock card | confirmed | singing; sustained tone ~883 Hz in 77% of frames | [png](frames/existing-etv-cairo-clock-1980s-6.0.png) |
| etv-cairo-clock-1980s | 3 | 54.1–60.1 | 76–82 | interlude card (sunburst) | borderline | silent | [png](frames/existing-etv-cairo-clock-1980s-57.1.png) |
| etv-cairo-clock-1980s | – | – | 97–110 | clock card | confirmed | singing | [png](frames/existing-etv-cairo-clock-1980s-src104.png) |
| fi-yle-mtv-1985 | 1 | 17.3–22.8 | 25–31 | clock card | confirmed | voice | [png](frames/existing-fi-yle-mtv-1985-20.0.png) |
| fuji-jocx-signoff-1988 | 5 | 82.8–88.2 | 945–950 | stand-by slate (master control) | confirmed | near-silent (tape hiss) | [png](frames/existing-fuji-jocx-signoff-1988-85.5.png) |
| fuji-jocx-signoff-1988 | – | – | 952–985 | stand-by slate (master control) | confirmed | source audio: voice | [png](frames/existing-fuji-jocx-signoff-1988-src968.png) |
| fuji-jocx-signoff-1988 | – | – | 1045–1228 | station card (after-hours still) | borderline | silent | [png](frames/existing-fuji-jocx-signoff-1988-src1136.png) |
| htv-wales-closedown-1982 | 3 | 36.1–48.0 | 184–196 | clock card | confirmed | voice | [png](frames/existing-htv-wales-closedown-1982-42.0.png) |
| htv-wales-closedown-1982 | – | – | 349–355 | colour bars | confirmed | steady test tone ~949 Hz | [png](frames/existing-htv-wales-closedown-1982-src352.png) |
| id-tvri-berita-1989 | 0 | 2.0–12.0 | 4–14 | clock card | confirmed | voice | [png](frames/existing-id-tvri-berita-1989-7.0.png) |
| id-tvri-berita-1989 | – | – | 14–20 | clock card | confirmed | source audio: voice | [png](frames/existing-id-tvri-berita-1989-src17.png) |
| inravision-mensajes-1987 | 2 | 45.3–49.3 | 132–136 | station card (ministry card) | borderline | voice | [png](frames/existing-inravision-mensajes-1987-47.3.png) |
| inravision-mensajes-1987 | 3 | 49.3–61.4 | 150–162 | station card (ministry card) | borderline | voice | [png](frames/existing-inravision-mensajes-1987-55.4.png) |
| iraq-tv-iftitah-1982 | 0 | 0.0–10.0 | 5–15 | station card (sign-on) | confirmed | music | [png](frames/existing-iraq-tv-iftitah-1982-5.0.png) |
| iraq-tv-iftitah-1982 | 1 | 10.0–20.0 | 20–30 | station card (sign-on) | confirmed | music | [png](frames/existing-iraq-tv-iftitah-1982-15.0.png) |
| iraq-tv-iftitah-1982 | 2 | 20.0–30.0 | 35–45 | station card (sign-on) | confirmed | music | [png](frames/existing-iraq-tv-iftitah-1982-25.0.png) |
| iraq-tv-iftitah-1982 | 3 | 30.0–40.0 | 49–59 | station card (sign-on) | confirmed | music | [png](frames/existing-iraq-tv-iftitah-1982-35.0.png) |
| iraq-tv-iftitah-1982 | 4 | 40.0–50.0 | 63–73 | station card (sign-on) | confirmed | music | [png](frames/existing-iraq-tv-iftitah-1982-45.0.png) |
| iraq-tv-iftitah-1982 | 5 | 50.0–60.0 | 88–98 | station card (sign-on) | confirmed | music | [png](frames/existing-iraq-tv-iftitah-1982-55.0.png) |
| itv-schools-c4-1987 | 0 | 0.0–12.0 | 12–24 | stand-by slate (follows shortly caption) | likely | voice | [png](frames/existing-itv-schools-c4-1987-6.0.png) |
| itv-schools-c4-1987 | 1 | 12.0–33.6 | 39–61 | stand-by slate (follows shortly caption) | likely | voice | [png](frames/existing-itv-schools-c4-1987-22.8.png) |
| itv-schools-c4-1987 | 2 | 33.6–45.6 | 76–88 | caption slide (programme caption) | borderline | voice | [png](frames/existing-itv-schools-c4-1987-39.6.png) |
| itv-schools-c4-1987 | 4 | 57.6–69.6 | 200–212 | stand-by slate (follows shortly caption) | likely | voice | [png](frames/existing-itv-schools-c4-1987-63.6.png) |
| itv-schools-c4-1987 | 5 | 69.6–81.6 | 540–552 | caption slide (programme caption) | borderline | voice | [png](frames/existing-itv-schools-c4-1987-75.6.png) |
| jrt-jugoslavija-spice | 1 | 10.0–19.4 | 135–144 | test card: JRT (FuBK-type) | confirmed | steady test tone ~1012 Hz | [png](frames/existing-jrt-jugoslavija-spice-14.7.png) |
| kabc7-signoff-1989 | 2 | 24.0–36.0 | 96–108 | station card (sign-off) | likely | voice | [png](frames/existing-kabc7-signoff-1989-30.0.png) |
| kabc7-signoff-1989 | 3 | 36.0–48.0 | 127–139 | station card (sign-off) | likely | voice | [png](frames/existing-kabc7-signoff-1989-42.0.png) |
| kabc7-signoff-1989 | – | – | 366–393 | test card: ABC circle pattern | confirmed | near-silent (tape hiss) | [png](frames/existing-kabc7-signoff-1989-src380.png) |
| kctv-signon-1994 | 0 | 0.0–12.0 | 30–42 | test card: KCTV | confirmed | voice | [png](frames/existing-kctv-signon-1994-6.0.png) |
| kctv-signon-1994 | – | – | 0–30 | test card: KCTV | confirmed | source audio: voice | [png](frames/existing-kctv-signon-1994-src15.png) |
| kctv-signon-1994 | – | – | 42–124 | test card: KCTV | confirmed | source audio: voice | [png](frames/existing-kctv-signon-1994-src83.png) |
| kctv-testcard-thaicom-2003 | 0 | 0.0–12.0 | 120–132 | test card: KCTV with clock | confirmed | music/tone | [png](frames/existing-kctv-testcard-thaicom-2003-6.0.png) |
| kctv-testcard-thaicom-2003 | 1 | 12.0–34.2 | 1221–1243 | test card: KCTV with clock | confirmed | music/tone | [png](frames/existing-kctv-testcard-thaicom-2003-23.1.png) |
| kctv-testcard-thaicom-2003 | 2 | 34.2–46.2 | 1604–1616 | test card: KCTV with clock | confirmed | music; a sustained tone ~758 Hz in 72% of frames (probably music) | [png](frames/existing-kctv-testcard-thaicom-2003-40.2.png) |
| kctv-testcard-thaicom-2003 | – | – | 4–120 | test card: KCTV with clock | confirmed | source audio: music/tone | [png](frames/existing-kctv-testcard-thaicom-2003-src62.png) |
| kctv-testcard-thaicom-2003 | – | – | 132–1221 | test card: KCTV with clock | confirmed | source audio: music/tone | [png](frames/existing-kctv-testcard-thaicom-2003-src676.png) |
| kctv-testcard-thaicom-2003 | – | – | 1243–1604 | test card: KCTV with clock | confirmed | source audio: music/tone | [png](frames/existing-kctv-testcard-thaicom-2003-src1424.png) |
| kr-kbs1-closedown-1997 | 0 | 7.0–10.0 | 7–10 | station card (closedown thank-you, animated) | borderline | singing | [png](frames/existing-kr-kbs1-closedown-1997-8.5.png) |
| kr-kbs1-closedown-1997 | 1 | 10.0–17.0 | 34–41 | station card (closedown thank-you, animated) | borderline | singing | [png](frames/existing-kr-kbs1-closedown-1997-13.5.png) |
| kr-mbc-siho-clock-1980s | 0 | 0.0–10.0 | 44–54 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-5.0.png) |
| kr-mbc-siho-clock-1980s | 1 | 10.0–20.0 | 74–84 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-15.0.png) |
| kr-mbc-siho-clock-1980s | 2 | 20.0–30.0 | 96–106 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-25.0.png) |
| kr-mbc-siho-clock-1980s | 3 | 30.0–40.0 | 138–148 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-35.0.png) |
| kr-mbc-siho-clock-1980s | 4 | 40.0–50.0 | 208–218 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-45.0.png) |
| kr-mbc-siho-clock-1980s | 5 | 50.0–79.8 | 221–251 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-64.9.png) |
| kr-mbc-siho-clock-1980s | – | – | 0–44 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-src22.png) |
| kr-mbc-siho-clock-1980s | – | – | 256–293 | clock card | confirmed | time-signal pips and sponsor jingle | [png](frames/existing-kr-mbc-siho-clock-1980s-src274.png) |
| macau-tdm-02 | 0 | 0.0–12.0 | 37–49 | station ident (TDM) | borderline | voice | [png](frames/existing-macau-tdm-02-6.0.png) |
| mbs-osaka-1986-02 | – | – | 622–688 | colour bars (rainbow breakup) | borderline | source audio: voice | [png](frames/existing-mbs-osaka-1986-02-src655.png) |
| mtv1-musorzaras-1989 | 0 | 8.2–12.0 | 8–12 | station card (sign-off goodnight) | confirmed | near-silent (tape hiss) | [png](frames/existing-mtv1-musorzaras-1989-10.1.png) |
| mtv1-musorzaras-1989 | 1 | 12.0–20.4 | 18–26 | station card (sign-off goodnight) | confirmed | near-silent (tape hiss) | [png](frames/existing-mtv1-musorzaras-1989-16.2.png) |
| mtv1-musorzaras-1989 | 2 | 26.5–35.5 | 34–44 | station card (sign-off coat of arms) | likely | voice | [png](frames/existing-mtv1-musorzaras-1989-31.0.png) |
| my-rtm-tv1-dx-1991 | 0 | 0.0–12.0 | 7–19 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | voice | [png](frames/existing-my-rtm-tv1-dx-1991-6.0.png) |
| my-rtm-tv1-dx-1991 | 1 | 12.0–24.0 | 55–67 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | voice | [png](frames/existing-my-rtm-tv1-dx-1991-18.0.png) |
| my-rtm-tv1-dx-1991 | 2 | 24.0–44.5 | 91–112 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | voice | [png](frames/existing-my-rtm-tv1-dx-1991-34.2.png) |
| my-rtm-tv1-dx-1991 | 3 | 44.5–56.5 | 119–131 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | voice | [png](frames/existing-my-rtm-tv1-dx-1991-50.5.png) |
| my-rtm-tv1-dx-1991 | 4 | 56.5–59.5 | 179–182 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | voice | [png](frames/existing-my-rtm-tv1-dx-1991-58.0.png) |
| my-rtm-tv1-dx-1991 | – | – | 19–55 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | source audio: voice | [png](frames/existing-my-rtm-tv1-dx-1991-src37.png) |
| my-rtm-tv1-dx-1991 | – | – | 131–179 | test card: RTM TV1 (PM5544-type, clock + schedule crawl) | confirmed | source audio: voice | [png](frames/existing-my-rtm-tv1-dx-1991-src155.png) |
| my-rtm-tv1-dx-1991 | – | – | 195–206 | clock card (sponsored Raymond Weil clock) | confirmed | source audio: voice | [png](frames/existing-my-rtm-tv1-dx-1991-src200.png) |
| nhk-joak-closedown-1982 | 0 | 0.0–10.5 | 2–13 | station card (sign-off text) | confirmed | voice | [png](frames/existing-nhk-joak-closedown-1982-5.2.png) |
| nhk-joak-closedown-1982 | 1 | 10.6–20.5 | 15–25 | station card (sign-off text) | confirmed | voice | [png](frames/existing-nhk-joak-closedown-1982-15.5.png) |
| nhk-joak-closedown-1982 | 2 | 20.5–30.5 | 30–40 | station card (sign-off ident) | confirmed | voice | [png](frames/existing-nhk-joak-closedown-1982-25.5.png) |
| nirt-tehran-final-1979 | 0 | 0.0–29.2 | 15–44 | interlude card | likely | voice | [png](frames/existing-nirt-tehran-final-1979-14.6.png) |
| nirt-tehran-final-1979 | 1 | 29.2–37.8 | 50–59 | interlude card | likely | voice | [png](frames/existing-nirt-tehran-final-1979-33.5.png) |
| nta2-lagos-continuity-1985 | 0 | 0.0–12.0 | 3–15 | station card (caption slide) | likely | voice | [png](frames/existing-nta2-lagos-continuity-1985-6.0.png) |
| nta2-lagos-continuity-1985 | – | – | 61–75 | clock card | confirmed | near-silent (tape hiss) | [png](frames/existing-nta2-lagos-continuity-1985-src68.png) |
| pk-tvdx-ptv-1994 | 0 | 0.0–12.0 | 8–20 | test card: PTV Islamabad (PM5544-type) | confirmed | steady test tone ~1008 Hz | [png](frames/existing-pk-tvdx-ptv-1994-6.0.png) |
| pk-tvdx-ptv-1994 | 1 | 20.0–24.1 | 258–262 | clock card (Pakistan Standard Time) | likely | voice | [png](frames/existing-pk-tvdx-ptv-1994-22.0.png) |
| pk-tvdx-ptv-1994 | – | – | 20–51 | test card: PTV Islamabad (PM5544-type) | confirmed | steady test tone ~1008 Hz | [png](frames/existing-pk-tvdx-ptv-1994-src36.png) |
| pk-tvdx-ptv-1994 | – | – | 274–290 | clock card (Pakistan Standard Time) | confirmed | near-silent (tape hiss) | [png](frames/existing-pk-tvdx-ptv-1994-src282.png) |
| pk-tvdx-ptv-1994 | – | – | 619–629 | clock card (Pakistan Standard Time) | confirmed | near-silent (tape hiss) | [png](frames/existing-pk-tvdx-ptv-1994-src624.png) |
| pk-tvdx-ptv-1994 | – | – | 1155–1174 | clock card | confirmed | source audio: voice; sustained tone ~148 Hz in 78% of frames | [png](frames/existing-pk-tvdx-ptv-1994-src1164.png) |
| rtbf-testcard-1994 | 0 | 0.0–12.0 | 10–22 | test card: RTBF 1 (PM5544-type) | confirmed | voice | [png](frames/existing-rtbf-testcard-1994-6.0.png) |
| rtbf-testcard-1994 | – | – | 22–39 | test card: RTBF 1 (PM5544-type) | confirmed | source audio: voice | [png](frames/existing-rtbf-testcard-1994-src30.png) |
| rte-news-angelus-1983 | 5 | 81.1–87.2 | 666–672 | stand-by slate (follows caption) | likely | voice | [png](frames/existing-rte-news-angelus-1983-84.1.png) |
| rte-testcard-405-vhf | 0 | 0.0–10.0 | 10–20 | stand-by slate (follows shortly) | likely | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-5.0.png) |
| rte-testcard-405-vhf | 1 | 10.0–20.0 | 57–67 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-15.0.png) |
| rte-testcard-405-vhf | 2 | 20.0–30.0 | 160–170 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-25.0.png) |
| rte-testcard-405-vhf | 3 | 30.0–49.9 | 175–195 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-40.0.png) |
| rte-testcard-405-vhf | 4 | 49.9–59.9 | 280–290 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-54.9.png) |
| rte-testcard-405-vhf | 5 | 59.9–69.9 | 357–367 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-64.9.png) |
| rte-testcard-405-vhf | – | – | 0–10 | station card (RTÉ ident slate) | likely | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-src5.png) |
| rte-testcard-405-vhf | – | – | 67–160 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-src114.png) |
| rte-testcard-405-vhf | – | – | 367–565 | test card: RTÉ 405-line monochrome | confirmed | tape music and hiss under the card | [png](frames/existing-rte-testcard-405-vhf-src466.png) |
| sabc-closedown-1977 | 4 | 50.8–60.0 | 1373–1382 | clock card | confirmed | voice | [png](frames/existing-sabc-closedown-1977-55.4.png) |
| sabc-closedown-1977 | 5 | 60.0–85.2 | 1569–1594 | test card: SABC/SAUK (PM5544-type) | confirmed | music/organ under the card (the manifest says "tone"; measured, it is not a steady sine) | [png](frames/existing-sabc-closedown-1977-72.6.png) |
| sabc-closedown-1977 | – | – | 1386–1409 | clock card | confirmed | near-silent (tape hiss) | [png](frames/existing-sabc-closedown-1977-src1398.png) |
| sabc-closedown-1977 | – | – | 1410–1569 | test card: SABC/SAUK (PM5544-type) | confirmed | source audio: voice | [png](frames/existing-sabc-closedown-1977-src1490.png) |
| sabc-closedown-1977 | – | – | 1594–1914 | test card: SABC/SAUK (PM5544-type) | confirmed | source audio: voice | [png](frames/existing-sabc-closedown-1977-src1754.png) |
| sabc-tv1-opening-1985 | 0 | 0.0–12.0 | 6–18 | test card: SAUK SABC JHB (PM5544-type, clock) | confirmed | voice | [png](frames/existing-sabc-tv1-opening-1985-6.0.png) |
| sabc-tv1-opening-1985 | 4 | 48.0–60.0 | 196–208 | clock card | confirmed | voice | [png](frames/existing-sabc-tv1-opening-1985-54.0.png) |
| sabc-tv1-opening-1985 | 5 | 60.0–81.2 | 221–242 | clock card | confirmed | voice | [png](frames/existing-sabc-tv1-opening-1985-70.6.png) |
| sabc-tv1-opening-1985 | – | – | 18–65 | test card: SAUK SABC JHB (PM5544-type, clock) | confirmed | source audio: voice | [png](frames/existing-sabc-tv1-opening-1985-src42.png) |
| sabc-tv1-opening-1985 | – | – | 185–196 | clock card | confirmed | source audio: voice | [png](frames/existing-sabc-tv1-opening-1985-src190.png) |
| sg-sbc5-dx-1991 | 0 | 0.0–12.0 | 3–15 | test card: PM5544 (SBC 5) | confirmed | voice | [png](frames/existing-sg-sbc5-dx-1991-6.0.png) |
| sg-sbc5-dx-1991 | 1 | 12.0–17.0 | 97–102 | test card: PM5544 (SBC 5) | confirmed | voice | [png](frames/existing-sg-sbc5-dx-1991-14.5.png) |
| sg-sbc5-dx-1991 | 1 | 17.0–19.8 | 102–105 | clock card (sponsored) | confirmed | voice | [png](frames/existing-sg-sbc5-dx-1991-18.4.png) |
| sg-sbc5-dx-1991 | – | – | 15–97 | test card: PM5544 (SBC 5) | confirmed | source audio: voice | [png](frames/existing-sg-sbc5-dx-1991-src56.png) |
| sovetskoe-tv-efir-1970s | 0 | 7.8–12.0 | 34–38 | test card: Soviet UEIT-type | confirmed | steady test tone ~1000 Hz | [png](frames/existing-sovetskoe-tv-efir-1970s-9.9.png) |
| sovetskoe-tv-efir-1970s | – | – | 38–44 | test card: Soviet UEIT-type | confirmed | steady test tone ~1000 Hz | [png](frames/existing-sovetskoe-tv-efir-1970s-src41.png) |
| sovetskoe-tv-efir-1970s | – | – | 132–139 | station card (date and clock caption) | confirmed | source audio: voice | [png](frames/existing-sovetskoe-tv-efir-1970s-src136.png) |
| sovetskoe-tv-efir-1970s | – | – | 4693–4703 | station card (sign-off) | confirmed | source audio: voice | [png](frames/existing-sovetskoe-tv-efir-1970s-src4698.png) |
| spokoynoy-nochi-1964 | – | – | 44–57 | clock card | confirmed | source audio: voice | [png](frames/existing-spokoynoy-nochi-1964-src50.png) |
| trt1-kapanis-1986 | – | – | 161–173 | clock card | confirmed | source audio: voice | [png](frames/existing-trt1-kapanis-1986-src167.png) |
| trt1-kapanis-1986 | – | – | 180–189 | colour bars | confirmed | near-silent (tape hiss) | [png](frames/existing-trt1-kapanis-1986-src184.png) |
| tvdx-irib2-tehran-1994 | 0 | 0.0–28.6 | 5–34 | test card: IRIB-2 | confirmed | steady test tone ~1000 Hz | [png](frames/existing-tvdx-irib2-tehran-1994-14.3.png) |
| tvdx-irib2-tehran-1994 | 1 | 28.6–39.2 | 47–58 | test card: IRIB-2 | confirmed | steady test tone ~1000 Hz | [png](frames/existing-tvdx-irib2-tehran-1994-33.9.png) |
| tvdx-irib2-tehran-1994 | – | – | 34–47 | test card: IRIB-2 | confirmed | steady test tone ~1000 Hz | [png](frames/existing-tvdx-irib2-tehran-1994-src40.png) |
| tvdx-irib2-tehran-1994 | – | – | 228–254 | clock card | confirmed | source audio: voice | [png](frames/existing-tvdx-irib2-tehran-1994-src241.png) |
| tvdx-joax-1992 | 0 | 0.0–12.0 | 0–12 | test card: NTV JOAX-TV (clock + transmitter card) | confirmed | music (DX), not a steady tone | [png](frames/existing-tvdx-joax-1992-6.0.png) |
| tvdx-joax-1992 | 1 | 12.0–24.0 | 48–60 | test card: NTV JOAX-TV (clock + transmitter card) | confirmed | music (DX), not a steady tone | [png](frames/existing-tvdx-joax-1992-18.0.png) |
| tvdx-joax-1992 | – | – | 12–48 | test card: NTV JOAX-TV (clock + transmitter card) | confirmed | source audio: music (DX), not a steady tone | [png](frames/existing-tvdx-joax-1992-src30.png) |
| tvdx-pik1-cyprus-1992 | – | – | 0–58 | test card: PM5544 (CYPRUS / PIK 1 NICOSIA) | confirmed | source audio: voice | [png](frames/existing-tvdx-pik1-cyprus-1992-src29.png) |
| tvdx-pik1-cyprus-1992 | – | – | 210–336 | clock card | confirmed | source audio: voice | [png](frames/existing-tvdx-pik1-cyprus-1992-src273.png) |
| tvdx-qtv-qatar-1993 | 0 | 0.0–12.0 | 1–13 | test card, sync unlocked (PM5544 torn into vertical bars) | likely | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-6.0.png) |
| tvdx-qtv-qatar-1993 | 1 | 12.0–24.0 | 17–29 | test card, sync unlocked (PM5544 torn into vertical bars) | likely | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-18.0.png) |
| tvdx-qtv-qatar-1993 | 2 | 24.0–34.0 | 33–43 | test card, sync unlocked (PM5544 torn into vertical bars) | likely | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-29.0.png) |
| tvdx-qtv-qatar-1993 | 2 | 34.0–36.0 | 43–45 | test card: PM5544 (QATAR) | confirmed | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-35.0.png) |
| tvdx-qtv-qatar-1993 | 3 | 36.0–48.0 | 47–59 | test card: PM5544 (QATAR) | confirmed | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-42.0.png) |
| tvdx-qtv-qatar-1993 | 4 | 48.0–60.0 | 63–75 | test card: PM5544 (QATAR) | confirmed | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-54.0.png) |
| tvdx-qtv-qatar-1993 | 5 | 60.0–72.0 | 77–89 | test card: PM5544 (QATAR) | confirmed | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-66.0.png) |
| tvdx-qtv-qatar-1993 | – | – | 89–102 | test card: PM5544 (QATAR) | confirmed | steady test tone ~988 Hz | [png](frames/existing-tvdx-qtv-qatar-1993-src96.png) |
| tvdx-srt-syria-1984 | – | – | 0–12 | colour bars | confirmed | source audio: voice | [png](frames/existing-tvdx-srt-syria-1984-src6.png) |
| tvr-22-decembrie-1989 | 3 | 50.0–62.0 | 5138–5150 | station card (ident card) | likely | voice | [png](frames/existing-tvr-22-decembrie-1989-56.0.png) |
| tvr-22-decembrie-1989 | – | – | 15952–15956 | station card (TVRL caption) | borderline | source audio: voice | [png](frames/existing-tvr-22-decembrie-1989-src15954.png) |
| tvri-jakarta-1980 | 0 | 1.6–12.0 | 5–15 | clock card | confirmed | voice | [png](frames/existing-tvri-jakarta-1980-6.8.png) |
| tvri-jakarta-1980 | – | – | 15–34 | clock card | confirmed | source audio: voice | [png](frames/existing-tvri-jakarta-1980-src24.png) |
| tvtupi-ultima-transmissao-1980 | 5 | 73.4–77.0 | 2151–2155 | station card (sign-off ATÉ BREVE) | likely | voice | [png](frames/existing-tvtupi-ultima-transmissao-1980-75.2.png) |
| tvtupi-ultima-transmissao-1980 | – | – | 2182–2282 | station card (sign-off) | likely | source audio: voice | [png](frames/existing-tvtupi-ultima-transmissao-1980-src2232.png) |
| tvtupi-ultima-transmissao-1980 | – | – | 2830–2864 | station card (sign-off) | likely | source audio: voice | [png](frames/existing-tvtupi-ultima-transmissao-1980-src2847.png) |
| tw-ttv-dx-1991 | 0 | 0.0–12.0 | 5–17 | test card: PM5544 (TTV) | confirmed | voice | [png](frames/existing-tw-ttv-dx-1991-6.0.png) |
| tw-ttv-dx-1991 | – | – | 17–104 | test card: PM5544 (TTV) | confirmed | source audio: voice | [png](frames/existing-tw-ttv-dx-1991-src60.png) |
| tw-ttv-dx-1991 | – | – | 134–139 | station card (TTV ident) | borderline | source audio: voice | [png](frames/existing-tw-ttv-dx-1991-src136.png) |
| vok-kenya-mambo-leo | 0 | 0.0–9.2 | 2–11 | station card (VOK) | likely | voice | [png](frames/existing-vok-kenya-mambo-leo-4.6.png) |
| wfld32-limbo-signoff-1983 | 3 | 36.0–45.8 | 300–310 | station card (sign-off GM address card) | likely | voice | [png](frames/existing-wfld32-limbo-signoff-1983-40.9.png) |
| wfld32-limbo-signoff-1983 | 5 | 74.3–86.3 | 600–612 | station card (limbo logo held) | confirmed | near-silent (tape hiss) | [png](frames/existing-wfld32-limbo-signoff-1983-80.3.png) |
| wfld32-limbo-signoff-1983 | – | – | 377–487 | colour bars | confirmed | source audio: voice; sustained tone ~1070 Hz in 85% of frames | [png](frames/existing-wfld32-limbo-signoff-1983-src432.png) |
| wfld32-limbo-signoff-1983 | – | – | 670–5188 | station card (limbo logo held) | confirmed | near-silent (tape hiss) | [png](frames/existing-wfld32-limbo-signoff-1983-src2929.png) |
| wgn9-five-minutes-to-live-by-1979 | – | – | 955–970 | station card (NAB Television Code seal) | borderline | source audio: voice | [png](frames/existing-wgn9-five-minutes-to-live-by-1979-src962.png) |
| wgn9-five-minutes-to-live-by-1979 | – | – | 976–990 | station card (sign-off legal card) | likely | source audio: voice | [png](frames/existing-wgn9-five-minutes-to-live-by-1979-src983.png) |
| wgn9-five-minutes-to-live-by-1979 | – | – | 1116–1159 | colour bars | confirmed | steady test tone ~379 Hz | [png](frames/existing-wgn9-five-minutes-to-live-by-1979-src1138.png) |

The notes for each entry are in `existing.json`.

## Audio-only reels with a test tone

None of the audio-only reels has a picture test card (their pictures are generated). These have tones:
- **wwv-fort-collins-1991**: NIST WWV. Window 5 (60-91.5 s) is a steady ~500 Hz standard tone (100 % tonal frames). Windows 1-4 and 6 carry the 500/600 Hz tone in about half the frames, between voice announcements and second ticks. This is the closest thing to a line-up tone in the audio-only set.
- **jjy-last-morning-2001**: JJY time station. Windows 1-2 (8-24 s) have a 1 kHz tick/tone in about 70 % of frames, then the announcement and carrier drop.
- Not counted as test tones: `uvb-76-buzzer-2024` (a buzz with no single tonal peak, a channel marker), `sputnik-1-shortwave-1957` (telemetry beeps), the numbers stations, and the interval-signal reels (`radio-peking-1970`, `vok-interval-signal-2021`, `interval-signals-1976-77`, `sovetskie-kv-stantsii-1970`: melodies, not tones).
- Picture reels whose in-window audio is a steady ~1 kHz test-card tone: `ct2-testcard-1994` w0, `cst-vysilani-znelky` w0, `jrt-jugoslavija-spice` w1, `pk-tvdx-ptv-1994` w0, `tvdx-irib2-tehran-1994` w0-1, `tvdx-qtv-qatar-1993` w0-5 (988 Hz), `sovetskoe-tv-efir-1970s` w0. `tr-sivil-savunma-alarm-1960s` has siren and alarm tones, but they are programme content, not line-up tone.
- The manifest says `sabc-closedown-1977`'s test card comes "with its tone", but the measured window-5 audio is music or organ with a moving pitch, not a steady tone.

## Rejected candidates

| reel / stretch | why rejected |
|---|---|
| cn-great-wall-203-computer-1975 (prior run's cn-bilibili.json) | round-5 reel, out of scope; also a lab oscilloscope, not a broadcast card |
| esa-meteosat-1980, fdi-space-and-india-1971, jp-kagakueizo-*, in-surabhi-*, protect-and-survive-1975 etc. (still stretches) | held film graphics, titles or diagrams in documentaries, not station cards |
| th-sahaviriya-computer-1992 "CTRL - CONTROL" card, pl-pkf-komputer-prawde-1987 "pattern" | training or explanatory text cards |
| kctv-weather-2003, kctv-signoff-1994 w0-1, ntv-ohayo-tenki-1989, nhk/regional weather maps | weather and schedule tables: information cards, not test or station cards |
| arutz-1-signoff-1985 schedule cards, dff1 blue schedule cards, de-ard programme card, sabc-tv1 w1-3 schedule, pk "AFTER KHABARNAMA", ct2 day-schedule page (src 74-117), jrt night menu | programme schedule cards: continuity information, not idents or test cards |
| at-orf1-sendeschluss-1992 teletext pages (src 17-260) | teletext pages, not held cards (only the ORF-Teletext service card is logged, borderline) |
| hk-tv-continuity-1979 CARTOON / PEARL idents, fi-yle-mtv owl, fr-antenne2 "2", ddr1 AK ident, dziennik DT, mezhdunarodnaya-panorama МП globe, jrt/cubavision/xew/globo openings, rtt-tunisie generique, itv-schools roundel, tw-ttv-dx 台灣電視公司 ident (logged borderline only out of window) | animated programme idents, openings or stings, not static station cards |
| wfld32 w0-2 ("The End", LATE LATE DOUBLE FEATURE, Thought for Today), wgn9 NEWSBREAK and Five Minutes to Live By cards | programme title cards |
| kctv-special-notice-2011 portrait card | a portrait inserted in an announcement, not a station card |
| iba-arabic-continuity-1988 transition slide, jordan-tv-fasil-musiqi | moving filler footage behind a logo |
| itv-schools-c4-1987 w3 publications slide with prices | a promotional slide |
| mbs-osaka-1986-02 in-window rainbow (the notes mention "rainbow bars") | inside the windows the picture is the anchor or the relay, not bars; the only bars-like stretch is out of window (logged borderline) |
| ert-roloi-1985 w2-5, cn-tv-set-ads, tw-cts-morning-news, tw-ttv-commercials (text hits on "clock") | the clock is a burnt-in corner timestamp or a wall clock in shot, not a clock card |
| cfu-dollar-bill-1966 ("the clock counting") | animation within a film |
| ph-tvdx-abscbn-1990, kctv-tvdx-terrestrial | DX noise and tearing; no card is ever resolved |
| tvr-22-decembrie-1989 other TVR idents out of window (src 105, 3302, 5084) | the same ident as the logged in-window card; not re-logged |
| trt-istiklal-marsi-1982, kr-kbs1 w2+, mtv1 w3+, trt1 w4-5, kctv-signoff w4-5 | flag and anthem films: moving footage, not cards |
| lk / rupavahini, gling, cham etc. (freeze hits) | long static camera shots |
| audio-only pictures (line, static, wave) | generated by the engine, excluded by the brief |

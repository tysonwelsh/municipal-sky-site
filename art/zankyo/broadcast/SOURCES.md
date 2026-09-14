# ZANKYŌ broadcast — native sources (reels round 4, the scouts' register)

*2026-09-14. Twelve Opus scouts, one per language region, 90 minutes each,
sites only — no videos, no downloads. Plan: `../PLAN-REELS-4-SOURCES.md`.
The owner reviews this index and the twelve per-locale registers under
`sources/` and chooses which sites get a video round.*

## How to read it

- **One file per locale** in `sources/`, verbatim from its scout: a register
  table (one row per site), the scout's Top 5, a rejected table so nobody
  re-scouts, and search notes with the native terms that worked.
- **Columns:** `type` is the media type from the plan's §2 (1 broadcaster
  archive, 2 film archive, 3 government record film, 4 native video host,
  5 fan/collector site, 6 regional archive, 7 home movies, 8 minority-language
  broadcaster, 9 science/industrial film). `deep-cut` 5 means never
  re-uploaded to YouTube or archive.org. `readable` is what one
  `yt-dlp -s` probe (2026.08.19, same machine for every beat) said about one
  representative page. `licence posture` is as found, with the scout's Tier
  A/B guess; **CC-ND and "all rights reserved" are Tier B** (CURATE.md).
- **Excluded by rule:** YouTube, the Internet Archive, Vimeo and mirrors of
  them. Type 10 (radio, audio-only) is deferred to a later pass. Type 11
  (oral history) was dropped; no register carries a site that is only that.
- **Eleven hosts appear in two registers** (Okinawa's archives in `jp-kr` and
  `far-languages`; RTP Arquivos in `africa` and `romance-west`; the Basque,
  Catalan, Galician, Romansh, Breton, Yle and KNR archives in `far-languages`
  and their home region). Both rows are kept: they were scouted from
  different angles.

## The numbers

| beat | region | sites | readable now | deep-cut 5 | Tier A (scout's guess) | rejected | countries |
|---|---|---|---|---|---|---|---|
| [`jp-kr`](sources/jp-kr.md) | Japan and Korea | 30 | 27 | 11 | 16 | 12 | 2 |
| [`sinosphere`](sources/sinosphere.md) | The Sinosphere | 30 | 7 | 12 | 3 | 13 | 5 |
| [`sea`](sources/sea.md) | Southeast Asia | 27 | 3 | 14 | 3 | 16 | 10 |
| [`south-asia`](sources/south-asia.md) | South Asia | 25 | 12 | 1 | 3 | 27 | 7 |
| [`russophone`](sources/russophone.md) | The Russophone and post-Soviet world | 32 | 25 | 4 | 8 | 13 | 10 |
| [`central-europe`](sources/central-europe.md) | Central and Eastern Europe | 30 | 21 | 5 | 1 | 16 | 13 |
| [`romance-west`](sources/romance-west.md) | Western Romance Europe | 27 | 17 | 11 | 2 | 17 | 6 |
| [`germanic-nordic`](sources/germanic-nordic.md) | Germanic and Nordic Europe | 35 | 15 | 14 | 4 | 17 | 13 |
| [`mena`](sources/mena.md) | Middle East and North Africa | 22 | 20 | 8 | 7 | 26 | 14 |
| [`africa`](sources/africa.md) | Sub-Saharan Africa | 26 | 7 | 14 | 2 | 24 | 19 |
| [`latam`](sources/latam.md) | Latin America | 27 | 2 | 14 | 2 | 17 | 14 |
| [`far-languages`](sources/far-languages.md) | The far languages | 36 | 13 | 22 | 0 | 19 | 22 |
| **all** | | **347** | **169** | **130** | **51** | **217** | |

"Readable now" counts sites where the probe resolved a format, an extractor
exists, or the media URL is visible in the page; the rest need a
browser-shaped session (Cloudflare, SPA players, queue pages) or are
catalogues that answer letters, not fetches.

## The cartographer's shortlist across beats

The scouts' Top 5s are sixty sites. Read against each other, they sort into
three piles. Beat in brackets; the scout's full reasoning is in that beat's
Top 5.

### A. Fetchable today — native, free, and the probe or an extractor already reads them

| site | beat | what it is |
|---|---|---|
| filmisadocument.jp | jp-kr | 339 complete Japanese newsreels and cultural films on the national film archive's own player; generic extractor resolves a format |
| archive.much.go.kr | jp-kr | KBS's pre-1970s film vault, 1 100+ records, free and high-quality; watermark to pre-crop |
| ehistory.go.kr | jp-kr | 대한뉴스 issues 1–2040 (1953–1994) at the producing government's portal, open-data catalogue; the native Tier-A home of the pool's `daehan-news-1970` |
| kagakueizo.org | jp-kr | 1 060+ rescued Japanese industrial, science and education films, 1950s–70s; one-server NPO, go gently |
| nicovideo.jp | jp-kr | tags 放送開始・終了 (1 765 videos), 懐かCM 80年代, カラーバー, テスト放送 — Japan's sign-offs and test cards on Japan's own host; extractor works, enumerate tags in a browser |
| vod.tfai.org.tw/Category/11 | sinosphere | 台影新聞 1945–1990s under Taiwan's Open Government Data Licence (Tier A), ~485 pages; player is a JS wrapper but file sizes are printed, direct file likely |
| bilibili.com collectors 猫娘维佳Weglorya_, 0851tvchannel | sinosphere | 收台/測試卡 sequences from CCTV, TVB, 明珠台 and provincial stations, already excerpted; probe succeeded |
| arhiiv.err.ee | russophone | Estonian broadcasting 1950s–90s, free, ERRArhiiv extractor returned HLS + DASH first try |
| repozytorium.fn.org.pl | central-europe | FINA's repository serves plain `fragment.mp4`; Polska Kronika Filmowa at the source |
| oldradio.cz/seznamtv.htm | central-europe | raw `.mpg` of the 1953 ČST monoskop, a station opening and 1980s znělky on a static collector site; no player at all |
| rtsplaneta.rs programski-arhiv | central-europe | Belgrade Television back to 1970 with `.mp4` in the page |
| patrimonio.archivioluce.com | romance-west | 70 000 Italian state newsreels over seventy years; generic pulls an m3u8 off a detail page; one site could carry a dozen reels |
| memoire.ciclic.fr (`/embed/<id>`) | romance-west | 14 986 amateur films, HLS + DASH through the embed, free, no login |
| cinememoire.net | romance-west | direct MP4s in a `videositemap.xml`; Marseille and the former French colonies, 1930s on |
| rtve.es/play + rtve.es/filmoteca | romance-west | NO-DO at home plus the TVE carta de ajuste and cierre the pool lacks; extractor exists, retry the 503 |
| pasouoquepasou.crtvg.gal | romance-west, far-languages | Galician television's own archive, `.m3u8` in the page; a language the pool has none of |
| filmarchiv.at/de/filmarchiv-on | germanic-nordic | Filmarchiv Austria, 1903–1994, Wochenschau, Werbefilm, Industriefilm, Amateurfilm; clean HLS ladder; Austria barely in the pool |
| openbeelden.nl | germanic-nordic | the only Tier A, no-login, direct-file source in its beat; Polygoon at the source (the pool's Polygoon reel came from a mirror) |
| nb.no (`api.nb.no`) | germanic-nordic | Filmavisen 1941–1963, 950 newsreels, 100 000+ broadcast items, open API |
| filmmirasim.ktb.gov.tr | mena | Turkey's state film heritage, pre-1960, open HLS manifest confirmed, era-browse built in |
| aparat.com | mena | NIRT idents, test cards, 1970s ads, sign-offs, uploaded by Iranians for Iranians; named extractor; licence per upload |
| cvet.org.za | africa | 90 hours of 1985–94 Cape Town community video in Xhosa, Afrikaans and English; the one African site the probe resolved |
| senalmemoria.co | latam | 170 000 records of Colombian public radio and TV from 1954; plain probe resolves |
| ncaa.gov.in/repository | south-asia | 21 989-record government tape library, raw 1940s–1990s footage, generic extractor reads it, no login, no geo-block |
| cec.swayam2.ac.in | south-asia | Countrywide Classroom, Doordarshan school TV since 1984, ~15 000 programmes, self-hosted `.mp4` |
| isuma.tv | far-languages | Inuktut community video host since 1990, IBC and Igloolik NITV 1980s–90s, HLS in the page; slow CDN |
| uluulu.recollectcms.com | far-languages | Hawaiʻi's state moving-image archive, 1960s–90s island television; probe resolved a format |

### B. Worth a browser-shaped session — free and deep, but Cloudflare, a queue page or an SPA player stands in front

| site | beat | what it is | the obstacle |
|---|---|---|---|
| hkmemory.hk | sinosphere | 90 years of Hong Kong broadcasting in Cantonese; the pool's six HK reels came from nowhere near HK | Angular SPA; media on slscdn.hkmemory.hk |
| cndfilm.com | sinosphere | 中央新影, 42 000 reels of 新闻简报 — China's NO-DO | mismatched TLS certificate; plain HTTP works |
| nas.gov.sg archivesonline | sinosphere | Ministry of Culture films 1960s–70s in Mandarin, Hokkien, Teochew, Cantonese; Television Singapura's launch | per-record streaming, some viewing-copy-on-request |
| memory.bophana.com | sea | 2 300+ videos: 1960s Khmer newsreel, Sihanouk's films, post-1979 TVK; robots-open | page-level pull |
| indonesiana.tv | sea | the Directorate-General of Culture's own channel; 1950s restored features, cultural documentary | player to read |
| e-kinas.lt | russophone | ~1 000 Lithuanian documentary works 1919–1961, state-published | Cloudflare |
| 1tv.ge/gpbarchive | russophone | Georgian state television film from 1956 under "Archive for Everyone" | Cloudflare 403 |
| redzidzirdilatviju.lv | russophone | 1 100+ watchable Latvian films 1910–2017 incl. a 600-film home-movie fund | player to read |
| filmhiradokonline.hu | central-europe | the whole Hungarian newsreel century, indexed | stream hidden in JS |
| arhiva.mrt.com.mk + play.mrt.com.mk | central-europe | Macedonia's whole broadcast memory, essentially absent from YouTube | Cloudflare |
| digitaler-lesesaal.bundesarchiv.de | germanic-nordic | 2 500+ films: every German newsreel series from Welt im Film to Deutschlandspiegel plus DDR documentation; free, no registration | SPA player |
| danmarkpaafilm.dk, stumfilm.dk, islandpaafilm.dk | germanic-nordic | DFI's public players, 120 years of Danish local film by place, a pre-1930 PD tier | one header fix likely opens all three |
| modernegypt.bibalex.org | mena | 2 004 documentary videos 1799–1981 in Egypt's national library | confirm playback on one item |
| kan.org.il/lobby/archive | mena | IBA 1968–2017 and Educational TV 1966–2018, free by the broadcaster's statement | Cloudflare |
| arquivos.rtp.pt/colecoes/africa-colonial | africa, romance-west | 120+ items 1938–1974 of Lusophone-African broadcast | page-level HLS |
| sudanmemory.org | africa | the Sudanese National Film Archive: 1940s–60s Khartoum newsreel | 403s automated fetchers |
| archivorta.com.ar | latam | Argentine state television from 1956, published "in the state in which it was recovered from the analogue support" | player to read |
| cubacine.icaic.cu | latam | 1 490 editions of the Noticiero ICAIC 1960–1990 at ICAIC | player to read |
| bcc.org.br | latam | TV Tupi's own tapes, Cinejornal Brasileiro, INCE science films | player to read |
| cinetecanacional.gob.cl/cineteca-online | latam | 8 500 items with noticieros and cine familiar 1920s–70s as categories | player to read |
| indiancine.ma | south-asia | 15 000 titles weighted to pre-1957 Indian cinema, open robots, documented API | rights per item; direct `.mp4` refused |
| gwylio-gwrando.llyfrgell.cymru | far-languages | 13 000 Welsh broadcasts watchable from home, back to the 1920s, the whole ITV Cymru library, S4C from 1982 | Cloudflare 403 |
| artxiboa.eitb.eus | far-languages, romance-west | ETB1 from 1982: idents, news openings, continuity in Basque | player to read |
| cinematheque-bretagne.bzh | far-languages, romance-west | 6 546 films free online, 1920s–1990s Brittany | player to read |
| open-memory-box.de | germanic-nordic | 415 hours of GDR private 8 mm 1947–1990, already cut into 2 s fragments | licence to resolve before cutting |

### C. Owner decisions before anyone goes further

| site | beat | the question |
|---|---|---|
| mediateka.suspilne.media | russophone | raw unedited Ukrainian broadcast tape from the 1950s, ~1 500 items; viewing needs a **free account** and this round's rules forbid logins. The scout would rank it #1 for texture if a registration is acceptable. |
| ofa.arkib.gov.my | sea | 2 746 hours of Malaysian state newsreel with a free 90 s preview per item — but `robots.txt` is `Disallow: /`. Human browsing only; is a hand-driven visit acceptable? |
| 51.com.kw | mena | Kuwait's Ministry of Information serving its own 1977-onward tape behind a **free signup**. |
| ifcinema.institutfrancais.com/catalog/afr | africa | 600+ African titles cleared royalty-free for non-commercial screening; needs an **institutional account**, and the platform is Paris-run. |
| tune.pk | south-asia | Pakistan's own video host, where PTV tape rips went during the 2012–16 YouTube ban; dormant since 2020, served nothing to an automated fetch. Worth a human look to see if the uploads survive. |
| fapot.or.th, anri.go.id, archives.gov.zw, ubc.go.ug, tchiweka.org | sea, africa | catalogues of extraordinary newsreel (Thai Film Archive; Gelora Indonesia 1951–76; Central African Film Unit 1948–63; Uganda National Media Archive 1947–86; Angolan liberation film) that answer **letters, not fetches**. Does the owner want to write? |

## Corrections from the video round (2026-09-14, evening)

- **rtsplaneta.rs leaves Pile A:** Widevine/FairPlay DRM on every asset,
  DASH only, registration on some categories; rts.rs Trezor pages carry no
  media. Serbian yielded nothing.
- **senalmemoria.co is a YouTube front:** every video pieza plays from
  RTVC's own YouTube channel (two native `.mp4` in 407 pages). Owner
  decision, QUEUE-R4.md §C1.
- **filmisadocument.jp streams picture only** — no audio track in any
  rendition. Owner decision, QUEUE-R4.md §C2.
- **ehistory.go.kr (Daehan News) is Tier B as found**, not A: no 공공누리
  badge on item pages; copyright routes through KTV's licensing desk.
- **Bilibili collector 猫娘维佳Weglorya_ is mostly fictional simulated
  channels**; real off-air collectors are in `queue-r4/sinosphere.md`'s
  site notes. TFAI VOD holds no 愛國獎券 draws.
- **cinememoire.net's real catalogue is `newvideositemap.xml`** (15 682
  sequences); **NO-DO is enumerable via `api.rtve.es/api/programas/50991/videos.json`**;
  **cvet.org.za's search is dead** (browse by genre; flat MP4 under
  `/recordFiles/`); **yt-dlp's Aparat extractor is broken**, use Aparat's
  JSON API. Details in the queue files' site notes.

## What the video round should know

- **The near-empty beats are empty for a reason, not for lack of looking.**
  Latin America and Southeast Asia have the deepest cuts (14 sites each at
  deep-cut 5) and almost nothing readable by a tool; South Asia rejected more
  than it registered (27 to 25). These beats want a scout with a real browser,
  not a scraper.
- **yt-dlp knows zero African hosts** out of 1 752 extractors. Every African
  source is a page-level pull or a letter.
- **Native homes for stations the pool already has from mirrors:** Daehan News
  (ehistory.go.kr), Polygoon (openbeelden.nl), NO-DO (rtve.es/filmoteca),
  Dziennik Telewizyjny's neighbours (repozytorium.fn.org.pl), the Hong Kong
  reels (hkmemory.hk), the Singapore Hokkien reel (nas.gov.sg), the Tibetan
  reels (vtibet.cn, once a mainland fetch path exists).
- **Languages the pool has none of, with a native archive ready:** Galician,
  Basque, Welsh, Inuktut, Hawaiian, Estonian, Lithuanian, Georgian, Macedonian,
  Khmer, Xhosa, Sudanese Arabic, Austrian German.
- The per-locale search notes carry the traps: legacy-TLS hosts in Taiwan,
  the Hong Kong library's queue page, Niconico's tag playlists returning
  nothing unauthenticated, ISUMA's slow CDN, and which sites asked in writing
  how they want to be read.

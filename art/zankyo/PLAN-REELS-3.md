# ZANKYŌ reels, round 3 — deep space: deeper cuts, the whole world, every language

*Plan, 2026-09-07. Branch `zankyo-reels-3` from main (2.1.0-rc.21). Owner's
answers: pool to ~150 reels (≈ 100 new); open archives + YouTube + any host
yt-dlp reads, politely; eras 1930s–1990s; mostly ephemera with about one
recognizable moment in ten; raw sources kept locally, forever.*

## 1. The brief

Two axes, both pushed:

1. **Deeper cuts.** Duck and Cover and A is for Atom are good but obvious.
   Go past the famous Prelinger titles into sponsored and industrial film,
   mental-hygiene shorts, home movies, corporate training, Bell System and
   Jam Handy, USIA, military training, Bureau of Mines, NOAA, obscure NASA,
   state tourism, church and union films, local TV, cable-access, station
   ephemera nobody has posted a listicle about. Government propaganda is
   good; it is not the only thing.
2. **The whole world, in its own languages.** Today the pool is Japan, the
   US, a little of Europe and a scattering elsewhere. Named gaps: the UK and
   Ireland (none at all), Hong Kong (none), Taiwan, Israel, more of Africa
   beyond Nigeria and Egypt, more Asian countries, more European countries,
   South Africa deeper. Scouts search the non-English web with native
   terms, read the language's own Wikipedia for station names and dates,
   and pull from local video hosts (Bilibili, Niconico, VK, Dailymotion,
   Vimeo) as well as YouTube and the open archives.

The vibe is unchanged (broadcast-crew SHARED.md): a derelict station
receiving the past; Nam June Paik; moments that read as caught signals —
idents, sign-offs, test cards, clocks, weather, announcements, PSAs,
newsreels, jingles, a face looking into the camera. Beauty and
strangeness. Not punchlines.

## 2. Etiquette and law (binding)

- One download at a time per agent; a pause between downloads; never
  mirror a site or crawl it wholesale; `WebFetch` respects robots and rate
  limits; no logins, no paywalls, no DRM circumvention.
- Prefer the archive original when the same material exists on an archive
  and a video host. Record the TRUE source URL and the license as found.
- Tier A (free to use: PD, CC, open government) is preferred and unbounded
  (≤ 10 windows). Tier B (copyrighted, fair-use posture) ≤ 6 windows, never
  a whole song or scene; music windows ≤ 10 s with `--distort 0.5`.
- No sports-league footage, no major-label music videos, no material from
  sources known to pursue small sites. Everything is 4–12 s non-contiguous
  fragments at 192×144 grayscale, mono band-limited audio: nothing in the
  pool substitutes for anything.
- Every entry carries `takedown: false` and can be pulled by a flag.

## 3. The crew

Eight BEAT agents, each in two phases (research, then cut), and one
LIBRARIAN at the end.

| beat | territory and language of search | target |
|---|---|---|
| deep-us | Prelinger deep cuts, US government and industrial film, local TV and cable-access ephemera; English | 14 reels |
| uk-ie-za | UK (BBC/ITV/IBA idents, test cards, COI public-information films, regional stations, BFI and regional film archives), Ireland (RTÉ), South Africa deeper (SABC/SAUK, Bop-TV, M-Net); English, Irish, Afrikaans | 14 |
| sinosphere | Hong Kong (TVB, ATV/RTV, RTHK, Commercial TV), Taiwan (TTV, CTV, CTS), Macau, Singapore (SBC), Malaysia (RTM), 1980s mainland (CCTV, provincial); Cantonese, Mandarin, Malay via Bilibili/YouTube/archives | 14 |
| asia-pacific | NORTH KOREA (KCTV — Korean Central Television: idents, the clock, the anthem sign-on, announcers, weather, children's programs, the mass games; archive.org holds KCTV recordings, kcnawatch-style archive streams exist, and Voice of Korea shortwave for audio — the owner asked for this specifically), South Korea (KBS/MBC/TBC), Philippines (ABS-CBN, RPN, GMA), Vietnam, Thailand, Indonesia deeper, India deeper (Doordarshan regional), Pakistan, Sri Lanka, New Zealand (TVNZ), Australian regional; native terms | 12 |
| africa | Ghana (GBC), Kenya (VoK/KBC), Ethiopia (ETV), Senegal (ORTS), Zaire/Congo (OZRT), Zimbabwe (ZBC), Tanzania, Angola/Mozambique (RTP colonial and after), Algeria/Morocco/Tunisia (RTA, RTM, ERTT), Egypt deeper; French, Arabic, Swahili, Portuguese, Amharic | 12 |
| levant-med | Israel (IBA Channel 1, Kol Israel, Educational TV, Galei Tzahal), Jordan, Lebanon (Télé Liban), Syria, Iraq, Kuwait, Gulf idents, Iran deeper, Turkey (TRT), Greece (ERT/YENED), Cyprus (CyBC); Hebrew, Arabic, Turkish, Greek, Persian | 12 |
| europe-deep | Italy (Carosello, RAI — the earlier gap), Iberia (RTP, TVE), France (ORTF-era on hosts), West Germany/Austria/Switzerland, the Nordics (SVT/NRK/DR/YLE/RÚV), Benelux deeper, Poland, Hungary, Romania (TVR 1989), Bulgaria, Albania, the Baltics and Soviet republics; native terms | 14 |
| latin-and-air | Latin America deeper (Globo, Televisa deeper, Argentina, Chile, Colombia, Peru, Cuba ICAIC), plus a second AUDIO pass: international shortwave idents and interval signals (Radio Moscow, BBC World Service, Radio Havana, DW, HCJB, Radio Tirana), pirate and offshore radio, more numbers stations (Cuban V02, the Gong, Lincolnshire's siblings), Sputnik and early satellite telemetry; Spanish, Portuguese | 12 video + 6 audio |

The **librarian** runs after the beats: rebuilds the manifest, validates
sizes and fields, de-duplicates against the pool, reports the balance
(country, decade, tier, tone, video/audio share), moves every earlier
worktree's raw sources into the one local folder, and writes the round's
report.

## 4. Raw sources are kept

All raw downloads go to `/Users/tysonwelsh/Media/zankyo-broadcast-src/`
(the worktree's `local-dev/broadcast-src` is a symlink to it; gitignored).
Nothing is deleted; the librarian consolidates the ~4.7 GB from the two
earlier worktrees into it. Expected footprint after this round: ~15 GB.

## 5. Phases and gates

| phase | who | gate |
|---|---|---|
| R1 research | each beat | a queue of 16–20 candidates with URL, title, year, country, language, license as found, duration, 6–8 timestamped moments, and one line on why it fits; at least a third from non-YouTube sources; nothing already in the pool |
| R2 cut | each beat | the target count of reels cut with `--windows` the scout chose, auditioned, weak windows re-cut, committed by path with manifest json; report table |
| R3 library | librarian | manifest builds clean; no duplicate ids or sources; balance report; raw sources consolidated; round report |

The pool merges into `zankyo-far` and to main at the next checkpoint; the
signal lottery already favors pictures 1.5×, and the audio-only share stays
near one in five by construction.

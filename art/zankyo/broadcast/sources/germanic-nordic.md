<!-- reels round 4 source scout register; scout output verbatim. Index and shortlist: ../SOURCES.md -->

# Germanic and Nordic Europe — native sources register (`germanic-nordic`)

Scout: Claude Opus 5, 2026-09-14.
Languages: German, Dutch, Flemish, Luxembourgish, Danish, Norwegian, Swedish,
Finnish, Icelandic, Faroese, Greenlandic.
Territories: Germany, Austria, Switzerland, Liechtenstein, Netherlands,
Belgium (Flanders), Luxembourg, Denmark, Norway, Sweden, Finland, Iceland,
Faroe Islands, Greenland.

**Headline for the owner.** This region's deep tier is not with the
broadcasters — the broadcaster portals (ARD, ZDF, ORF, SRF, NPO, VRT, DR, NRK,
SVT, YLE, RÚV) all have yt-dlp extractors and are the shallow end. The deep tier
is four national *archive* portals that opened streaming in the last few years
and that yt-dlp does not know: **Bundesarchiv Digitaler Lesesaal** (DE, free, no
login, 2 500+ films streaming out of 220 000 catalogued, every German newsreel
series 1930s–1980s), **Beeld & Geluid Schatkamer** (NL, opened 26 May 2026,
700 000 radio+TV programmes free), **danmarkpaafilm.dk / stumfilm.dk** (DK, DFI,
~120 years of local and documentary film), and **nb.no** (NO, Filmavisen's 950
newsreels 1941–1963 plus the complete NRK broadcast deposit from 1990).

The one exception to that rule is worth the whole scout on its own:
**FILMARCHIV ON** (`filmarchiv.at`) — Filmarchiv Austria's free public VOD of
Wochenschau, amateur, advertising and industrial film, **1903–1994** — *does*
have a yt-dlp extractor (`FilmArchiv`), it is not listed under any name a scout
would grep for, and a probe returns a clean HLS ladder from 360p to 1080p. It is
the single best friction-to-depth ratio in this beat.

**Two things that changed under us and matter.** (1) `filmarkivet.se` — the
seed's Swedish pointer — **was shut down in summer 2026**; its material split
between SMDB (on-site at KB only), KB Play and the new subscription service
Cinemateket Play. (2) `dr.dk/bonanza` — the seed's Danish pointer — **closed
15 March 2024**, replaced by "Gensyn" inside DRTV. Both are in the rejected
table with where the material went.

## Register

| url | country | language(s) | type (§2 #) | holdings | era fit | deep-cut 1–5 | access | readable | licence posture | etiquette | native terms | why it fits |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| https://digitaler-lesesaal.bundesarchiv.de/ | DE | German | 2, 3 | Bundesarchiv's own streaming reading room. 220 000+ films catalogued, 2 500+ streaming now and growing "as copyright permits": *Welt im Film*, *Welt im Bild*, *Neue Deutsche Wochenschau*, *Die Zeitlupe*, *Ufa-Wochenschau*, *Ufa-Dabei*, *Deutschlandspiegel*, Weimar-era features and docs, DDR film documentation | most (1920s–1980s) | 5 | public player, **free, no registration** (as the Bundesarchiv states) | not readable — Angular SPA, generic extractor: `Unsupported URL`; the item player must be read from the page | federal archival material; Bundesarchiv "Nutzung von Filmen" governs reuse and expects a usage request for publication → **Tier B**, with a large PD-by-age sub-tier (pre-1946 Reich newsreel) → Tier A case by case | slow SPA first paint; no bulk crawling; single item pages only | `Wochenschau`, `Digitaler Lesesaal`, `Deutschlandspiegel`, `Welt im Film`, `Zeitlupe` | The single richest German well of newsreel, announcement and state-information film, on the state's own player, almost none of it re-uploaded |
| https://www.progress.film/ | DE | German | 3 | DEFA's whole film heritage at the rights-holder: *Der Augenzeuge* — 2 000+ newsreel issues, 1946–1980, 15 min each — plus West German *Blick in die Welt*, and commissioned films of GDR ministries, parties and mass organisations | most (1946–1990) | 4 | catalogue public; viewing copies watermarked; licensing for any use | not readable — HTTP 403 to WebFetch and to yt-dlp's default UA | commercial rights agency, "all rights reserved", per-clip licence fee → **Tier B** | 403s bots hard; treat as a catalogue to *read*, not to fetch from | `DEFA`, `Der Augenzeuge`, `Blick in die Welt`, `Wochenschau DDR` | The GDR's weekly voice-of-the-state, complete, at source — the ident/announcement register the pool's `ddr1-*` reels only sample |
| https://open-memory-box.de/ | DE | German | 7 | The world's largest digitised collection of GDR private 8 mm film: **2 283 reels / 415 hours, 1947–1990, from 149 families in 102 places**, searchable on 2 700 keywords; an "Anti-Archiv" that auto-montages 2-second fragments | most (1947–1990) | 5 | public, **no registration** (as the project states) | not readable — custom JS player; generic extractor: `Unsupported URL` | project of ZZF Potsdam / Laurence McFalls & Alexandre Sorel; licence not stated on any page I could retrieve → **Tier B pending a read of the Impressum** | site body is JS-rendered and did not return to WebFetch; approach via the project pages at zzf-potsdam.de first | `Amateurfilm`, `Schmalfilm`, `DDR`, `Super 8`, `Privatfilm` | 415 hours of ordinary GDR life shot by the people living it — the closest thing in Europe to a found home-movie signal, and its 2-second-fragment mode is already the reel window |
| https://www.ardmediathek.de/ard/retro | DE | German | 1 | **ARD Retro**: joint project of the ARD Landesrundfunkanstalten + Deutsches Rundfunkarchiv, launched 27 Oct 2020. Thousands of TV items from the 1950s and 1960s — early Bundesrepublik reporting *and* the DRA's *Ostmitschnitte*, the off-air recordings of DDR's Deutscher Fernsehfunk made by SFB/NDR/ZDF for the Gesamtdeutsches Institut. Rights limit the public tier to items **up to 1965** | most (1952–1965) | 3 | public player; a share geo-restricted to DE | **extractor: `ARDMediathek` / `ARDMediathekCollection`** | broadcaster terms, "Mediathek only", depublication rules → **Tier B** | ardmediathek.de timed out on a 15 s socket probe — allow generous timeouts; obey the depublication dates | `ARD Retro`, `Ostmitschnitte`, `Fernsehen der 50er`, `Deutscher Fernsehfunk` | Earliest German television as broadcast, including a Western archive of Eastern broadcasts — a station receiving another station, which is the whole conceit |
| https://www.landesfilmsammlung-bw.de/ | DE | German | 6, 7, 9 | Haus des Dokumentarfilms, Stuttgart, on behalf of Baden-Württemberg. 1904–present: **Imagefilme, Werbefilme, Stadtporträts, Privatfilme**, a large amateur holding, plus Wehrmacht soldiers' film diaries and post-war reconstruction | most | 5 | no own player; ~190 films published through **LEO-BW** (leo-bw.de) and "Timms for Culture"; the archive itself licenses | not probed (no own item player found) | state-funded regional archive that licenses for public use → **Tier B** | go in through LEO-BW, not the archive site | `Landesfilmsammlung`, `Imagefilm`, `Stadtporträt`, `Amateurfilm`, `Werbefilm` | City portraits and factory films of one German state — the industrial-film tier the pool has only in American form (`bureau-of-mines-*`, `jamhandy-*`) |
| https://www.filmportal.de/ | DE | German | 2 | DFF Deutsches Filminstitut + Deutsche Kinemathek + Murnau-Stiftung + Filmmuseum Düsseldorf. 160 000 films, 280 000 people; a `/videos` section of clips and a curated dossier *Die Wochenschau in der DDR* | most | 2 | public, free | not probed | metadata is free to consult; clips carry institutional rights → **Tier B** | primarily a finding aid — use it to name titles, then chase them at Bundesarchiv/Progress | `Filmportal`, `Wochenschau`, `Kulturfilm`, `Lehrfilm` | The index that tells a video scout what to ask the German archives for |
| https://www.filmarchiv.at/de/filmarchiv-on/ | AT | German | 2, 3, 7, 9 | **FILMARCHIV ON** — Filmarchiv Austria's own weekly-curated VOD. Hundreds of films, **1903–1994**: *Wochenschau*, **Amateurfilm**, **Werbefilm**, **Industriefilm**, cultural events, imperial-era and rare colour footage, war and reconstruction | most (1903–1994) | 5 | public player, free, no registration found; no geo-block notice (unverified from outside AT) | **extractor: `FilmArchiv`** — probe returned a full **HLS ladder**, 360p→1080p mp4 + separate audio. Cleanest machine-readable result in the whole beat | national film archive publishing a curated public tier → **Tier B**, older material PD by age → Tier A case by case | well-behaved; item URLs are `/de/filmarchiv-on/video/f_<id>` | `Wochenschau`, `Amateurfilm`, `Werbefilm`, `Industriefilm`, `Filmarchiv` | Austria's ephemera — newsreel, ads, factory films, home movies, 1903 to 1994 — on a free player that yt-dlp already reads perfectly. Nothing else here combines this depth with this little friction |
| https://www.mediathek.at/ | AT | German | 1, 3 | Österreichische Mediathek (Technisches Museum Wien): **650 000 items catalogued, 140 000+ online**; ~40 online exhibitions with 6 000+ sounds and videos; radio journals 1967–1999 at journale.at | most | 4 | public catalogue search, free | **generic extractor reads it** — a homepage probe returned 50 items, each with a direct `mp4` | national AV heritage institution; use terms per item → **Tier B**, some Tier A | polite, no obstruction seen; the catalogue is `mediathek.at/katalogsuche/` | `Mediathek`, `Österreich am Wort`, `Tondokument`, `Archivaufnahme` | Austria's whole recorded memory on one machine-readable player; the giant the seed suspected, and it really is one |
| https://on.orf.at/archiv | AT | German | 1 | ORF's archive section: contemporary history from the First and Second World Wars, the Staatsvertrag, the Cold War and the fall of the Iron Curtain, all nine Länder, plus a *Vintage Videos* collection ("Schmankerl aus dem ORF-Archiv") and a television-history strand | some–most | 3 | public player; no geo-restriction announced on the archive pages, but ORF geo-blocks parts of its catalogue | **extractor: `orf:on`** (also `orf:iptv`, `orf:radio`) | broadcaster, all rights reserved → **Tier B** | `tvthek.orf.at/history` now 301s to `on.orf.at/archiv` — use the new host | `Archiv`, `Zeitgeschichte`, `Sendeschluss`, `Vintage Videos` | The pool already has `at-orf1-sendeschluss-1992` from elsewhere; this is that station's own house, with its own idents around it |
| https://www.memobase.ch/ | CH | German, French, Italian, Romansh | 6 | The Swiss federated AV portal (Memoriav): holdings of dozens of Swiss archives, broadcasters and regional institutions in four national languages | most | 4 | public; some items viewable only at the holding institution | not readable — the site sits behind an **Anubis** proof-of-work bot wall; WebFetch got the challenge page, not the site | federated — rights stated per item, mixed → **Tier A/B per item** | **Anubis PoW wall**: a browser-less fetch will not get through. Contact listed: jonas.waeber@unibas.ch. Do not hammer it | `Memobase`, `Archiv`, `Sendung`, `Wochenschau`, `Schweizer Filmwochenschau` | The only doorway to Switzerland's regional and multilingual AV, including Romansh — "as far as a signal gets" inside one small country |
| https://www.srf.ch/play/tv | CH | German | 1 | SRF's player; the Swiss broadcaster's own archive strands (*SRF Archiv*, *Schweizer Filmwochenschau* material) sit inside it. Note the pool already has `ch-srgdrs-sendeschluss-1982` from elsewhere | some | 2 | public; a large share geo-blocked to CH | **extractor: `SRGSSR` / `SRGSSRPlay`** (covers srf.ch, rts.ch, rsi.ch, rtr.ch) | broadcaster → **Tier B** | `srf.ch/play/tv/sendung/srf-archiv` is a 404 — find the current archive show slug from the Play search, not from memory | `Archiv`, `Sendeschluss`, `Filmwochenschau`, `Testbild` | Four-language Switzerland from one extractor, Romansh included via `rtr.ch` |
| https://www.lichtspiel.ch/ | CH | German | 2, 7, 9 | Lichtspiel / Kinemathek Bern: **~25 000 films**, weighted to short film, experimental, animation, **newsreel and amateur** — plus a projector and Laterna Magica hardware archive | most | 5 | physical cinema + a "digital museum" at kinemathek.ch; live stream via Vimeo (excluded host) | not probed — no own VOD portal found | FIAF member archive, rights per item → **Tier B** | small institution; ask rather than scrape | `Kinemathek`, `Wochenschau`, `Amateurfilm`, `Schmalfilm` | 25 000 short and amateur films in a single Swiss room — a scout's shortlist even if the fetching has to be by correspondence |
| https://schatkamer.beeldengeluid.nl/ | NL | Dutch | 1 | **The Schatkamer** — opened to the whole country 26 May 2026. **700 000+ radio and television programmes**, 100+ years of Dutch public broadcasting; Beeld & Geluid hold over 1 million hours in total | most | 4 | free, no subscription; almost certainly NL-geo-restricted (it was announced as "heel Nederland krijgt gratis toegang") — **confirm from outside NL before planning a fetch round** | **generic extractor reads it** — probe returned a direct `mp4` | Dutch public broadcasters' material, opened for viewing not reuse → **Tier B** | brand new; `schatkamer.nl` 301s to this host | `Schatkamer`, `archief`, `omroep`, `einde uitzending`, `testbeeld`, `reclame jaren` | The largest single opening of broadcast archive in this region in a decade — leaders, continuity, weather and sign-offs of every Dutch omroep in one place |
| https://openbeelden.nl/ | NL | Dutch | 2, 3 | **Open Beelden** (Beeld & Geluid + Kennisland): several thousand items released for reuse — the **Polygoon** newsreel core, plus VPRO, NIMk and EYE portals; an open API | most | 3 (the Polygoon core has been mirrored, the long tail has not) | public, free, no login | **generic extractor reads it, with direct files**: probe on `/media/1480524/` returned `webm`, `mp4` and two `ogv` renditions | site text CC BY-SA 3.0; the platform exists specifically so material "can be easily reused" → **Tier A** | the friendliest site in this whole register; open formats, open API, open source | `Polygoon`, `openbeelden`, `hergebruik`, `journaal` | The pool's `polygoon-signalen-1933-1974` reel came from a mirror; **this is Polygoon at the source, downloadable, and Tier A** |
| https://player.eyefilm.nl | NL | Dutch | 2 | Eye Filmmuseum's own VOD player: Dutch film history, silent film and collection highlights, drawn from a 63 000-film collection spanning 1896–present | most | 3 | public on-demand; free/subscription mix not stated on the page | not probed | museum, rights per title → **Tier B**; the pre-1930 Dutch silent tier is PD by age → Tier A | approach via `eyefilm.nl/collectie` | `Eye`, `collectie`, `stomme film`, `filmgeschiedenis` | Dutch silent and early sound film from the institution that restored it |
| https://www.radio-tv-nederland.nl/ | NL | Dutch | 5 | Independent collector site on Dutch legal radio and TV broadcasters; a dedicated **testbeeld** section with photo albums of Dutch television test cards, plus broadcaster histories | most | 5 | public | not probed — **stills and text, not video**; registered for its *documentation* value | hobbyist site, no terms found → **Tier B** | 403s WebFetch; a human browser gets in fine | `testbeeld`, `einde uitzending`, `zendermast`, `omroep historie` | It will not supply a clip, but it names and dates every Dutch test card — the map a video scout needs to know what they are looking at |
| https://iaddb.org/ | NL | Dutch | 5 | International Advertising & Design DataBase — where Stichting het ReclameArsenaal (Laren, NL) puts the Dutch advertising heritage it manages | some | 4 | public | not probed | heritage foundation database → **Tier B** | reclamearsenaal.nl is now only a front door; the collection lives at iaddb.org | `reclame`, `reclamefilm`, `reclame jaren 80`, `arsenaal` | Dutch advertising at its custodian — the ad-break tier the pool holds only for Mexico, Taiwan, Iran and Argentina |
| https://hetarchief.be/ | BE (Flanders) | Dutch | 1, 2 | **meemoo**'s public portal: digitised Flemish AV heritage from VRT and dozens of Flemish institutions; the sibling *Het Archief voor Onderwijs* serves schools | most | 4 | portal public; a large share requires a (free) account or an education login | not readable — HTTP 403 to WebFetch; generic extractor on a sample PID: `Unsupported URL` (**provisional** — the PID was a sample, re-probe with a real one) | public heritage institute; per-item rights, much of it broadcaster-owned → **Tier B** | 403s bots; expect an account gate before a video round | `archief`, `meemoo`, `VRT`, `einde uitzending`, `testbeeld` | Flanders' own memory rather than Belgium's French half — the pool's `be-brtn-eedaflegging-1993` station, at home |
| https://www.vrt.be/vrtmax/ | BE (Flanders) | Dutch | 1 | VRT MAX, the Flemish broadcaster's player, with archive strands of BRT/BRTN television | some | 2 | public; geo-blocked to BE for most content; account required | **extractor: `VRT` / `vrtmax`** | broadcaster → **Tier B** | geo-block is the real barrier, not the extractor | `archief`, `BRT`, `einde uitzending` | Flemish continuity and sign-offs at source |
| https://cna.public.lu/ | LU | Luxembourgish, French, German | 2, 3 | Centre national de l'audiovisuel: **~100 000 film and video documents**, every feature and short produced or co-produced in Luxembourg from the first film shot in the Grand Duchy in **1899** to now. Selections published through CNAsearch, **RTL Hei**, **Elei Retro RTL**, *La Boîte à Archives*, Filmfriend and the Médiathèque | most | 5 | catalogue public; digitised items consultable **on request** — the CNA sends a free low-resolution copy by secure link | not probed; `www.cna.public.lu` and `cnasearch.cna.lu` do not resolve — the live host is `cna.public.lu` | state cultural institute; access service mediates → **Tier B**, request-based | the request route is the intended route here; do not look for a scrape | `archives`, `CNA`, `Elei Retro`, `RTL Hei`, `patrimoine audiovisuel` | The smallest national archive in this beat and the least re-uploaded; Luxembourgish is a language the station has never received |
| https://www.rtl.lu/ | LU | Luxembourgish | 1 | RTL Lëtzebuerg's own site; "Elei Retro" republishes CNA/RTL archive material | some | 4 | public | **extractors: `rtl.lu:article`, `rtl.lu:tele-vod`, `RTLLuLive`, `RTLLuRadio`** | broadcaster → **Tier B** | one of the few Luxembourgish hosts yt-dlp already reads — use it | `Elei Retro`, `Archiv`, `RTL Tëlee` | Luxembourgish television and radio, machine-readable, and nowhere else |
| https://www.danmarkpaafilm.dk/ | DK | Danish | 2, 6, 7 | Det Danske Filminstitut's map-and-timeline portal: ~120 years of documentary and local film from across Denmark, including ***Politikens Filmjournal*** newsreels, agriculture films, regional footage, WWII and occupation material; tags run 1910s–1980s | most | 5 | public player, free | not readable — HTTP 403 to yt-dlp's default UA (bot protection); the player is on-page | DFI, rights per item → **Tier B**, with a PD-by-age silent tier | 403s automated UAs; the map/timeline UI is the intended entry | `danmark på film`, `filmjournal`, `arkiv`, `lokalfilm` | A whole country indexed by *place* — the small-town Denmark tier, none of which has been re-uploaded |
| https://www.stumfilm.dk/ | DK | Danish | 2 | DFI's silent-film site: hundreds of films, **1890s–1930s**, streaming, incl. *Afgrunden* (1910) | most (early end) | 4 | public streaming player, URLs of the form `/stumfilm/streaming/film/<slug>` | not readable — HTTP 403 to yt-dlp's default UA; the page's own image URLs carry a `Guest:Guest` auth credential, so the media layer is reachable with the right headers | Danish silent film, mostly PD by age → **Tier A** for the pre-1930 core | 403s automated UAs; a guest credential is embedded in the page, which suggests the player expects it | `stumfilm`, `dansk stumfilm`, `Afgrunden` | Pre-sound Danish cinema at the institute that holds the negatives; the 1900s–1930s end of the station's window, which the pool is thin on |
| https://www.dr.dk/drtv/ | DK | Danish | 1 | DRTV's **Gensyn** archive section, which replaced DR Bonanza on 15 March 2024: parts of DR's archive. The full DR archive is being migrated to Det Kgl. Bibliotek over the coming years | some | 2 | public; geo-blocked to DK for much of it | **extractors: `drtv`, `drtv:season`, `drtv:series`** (`DRBonanza` still listed but its site is gone) | broadcaster → **Tier B** | the seed's `dr.dk/bonanza` is dead — go to Gensyn | `Gensyn`, `arkiv`, `sendeslut`, `prøvebillede`, `gamle reklamer` | The pool has `dk-dr-tv-avisen-1986`; this is that newsroom's own house |
| https://www.nb.no/ | NO | Norwegian | 2, 3, 1 | Nasjonalbiblioteket's Nettbibliotek. Norway's largest film collection, **1903–present**. ***Filmavisen* 1941–1963 — 950 weekly newsreels**, including the occupation years' censored and propaganda editions. Separately the broadcast deposit: **complete NRK from 1990**, TV2 and TVNorge from 1992, P4 from 1993; **100 000+ items free online** | most | 5 | public; **films in the public domain or with cleared rights are free online, the rest is on-site-only at NB** — radio streams far more freely than film | not readable — item pages are a JS viewer; generic extractor on a real item: `Unsupported URL`. **NB runs an open API (api.nb.no) — the video round should go through that, not the page** | national library; PD/cleared items published deliberately → **Tier A** for the free tier, Tier B for the rest | huge and well-behaved; use the API and respect its terms | `Filmavisen`, `ukerevy`, `Nettbiblioteket`, `kringkasting`, `arkiv` | 950 wartime and post-war Norwegian newsreels, free where rights allow, with an API in front of them — the best-engineered source in this beat |
| https://tv.nrk.no/ | NO | Norwegian, Northern Sámi | 1, 8 | NRK TV, with archive strands and **NRK Skole**; NRK Sápmi carries Northern Sámi | some | 2 | public; a share geo-blocked to NO | **extractors: `NRK`, `NRKTV`, `NRKTVSeries`, `NRKSkole`, `NRKPlaylist`** | broadcaster → **Tier B** | one of the best-supported extractors in yt-dlp | `arkiv`, `sendeslutt`, `prøvebilde`, `NRK Skole` | School TV and Sámi-language broadcast, both machine-readable |
| https://play.cinemateketplay.se/ | SE | Swedish | 2, 3, 7 | Svenska Filminstitutet's streaming service, launched spring 2026 — the technical successor to filmarkivet.se. Archive material **c. 1900 onward**: *stumfilmer, journalfilmer, dokumentärer, **reklamfilmer**, amatörfilm*, on everyday life, work, politics and culture. A **free, no-login tier called "Svenska bilder"**; the curated film programme is 99 kr/month | most | 4 | **free tier "Svenska bilder" needs no login**; the rest is subscription | not probed | Filminstitutet, rights per title; the free archive tier is published for public viewing → **Tier B**, some Tier A by age | criticised in the Swedish press for locking up what filmarkivet.se had given away — take only the free tier | `Svenska bilder`, `journalfilm`, `reklamfilm`, `amatörfilm`, `kortfilm` | Swedish newsreel and ad film after filmarkivet.se's death — and the free tier is exactly the ephemera the station wants |
| https://kbplay.kb.se/ | SE | Swedish, Northern Sámi | 2, 8 | Kungliga bibliotekets streaming service: films from the national library's collections alongside sector lectures — and, from the filmarkivet.se wind-down, **a collection of 150 films about Sápmi** | some | 5 | **free, no registration** (as reported in the Swedish press at the filmarkivet.se closure) | not readable — probes on `/` and `/om`: `Unsupported URL`; the service runs on a Mediaflow portal (`kbplay.mediaflowportal.com`), which is where a real probe should go | national library publication → likely **Tier A** for the deposited film; confirm per item | small, quiet service; the Mediaflow host is the machine-readable layer | `KB Play`, `Sápmi`, `samiska filmer`, `arkivfilm` | 150 films about Sápmi, free, from a national library — squarely the "as far as a signal gets" tier, and nowhere near YouTube |
| https://www.urplay.se/ | SE | Swedish | 9, 1 | UR (Sveriges Utbildningsradio) — Swedish **school and educational television**, with older series in the catalogue | some | 3 | public; geo-blocked to SE for much of it | **extractor: `URPlay`** | public educational broadcaster → **Tier B** | geo-block is the barrier | `skol-TV`, `utbildningsprogram`, `arkiv` | The Swedish answer to `itv-schools-c4-1987` — a lesson read to a camera, which is one of the station's best textures |
| https://elonet.finna.fi/ | FI | Finnish, Swedish | 2, 3 | **Elonet** — KAVI (Kansallinen audiovisuaalinen instituutti) inside the Finna discovery layer: the Finnish national filmography, with streaming of digitised shorts, newsreels, documentaries and advertising film | most | 5 | public; **a share of the streaming is restricted to Finland or to KAVI premises** — confirm before a fetch round | **extractor exists: `Elonet`** — but both probes returned HTTP 403 (bot protection on finna.fi), so the extractor is present and the door is shut to a default UA | national AV institute; rights per title → **Tier B**, older shorts Tier A by age | 403s automated UAs; finna.fi has an open API worth trying instead | `Elonet`, `arkisto`, `lyhytelokuva`, `uutiskatsaus`, `vanhat mainokset` | Finland's own filmography with a yt-dlp extractor already written for it — the highest ratio of deep-cut to effort in this beat, if the 403 can be got past politely |
| https://areena.yle.fi/ | FI | Finnish, Swedish, Northern Sámi | 1, 8 | **Yle Elävä arkisto** inside Areena: Finnish broadcasting from **1926**, oldest surviving programme a New Year address from **1935**; browsable by decade, 1900s–2020s; Yle Sápmi carries Northern Sámi | most | 3 | public and free; **Yle states most archive material is viewable abroad too**, with per-contract exceptions | **extractor: `YleAreena`** | broadcaster → **Tier B** | one of the few European broadcasters that does *not* geo-block its archive by default — take advantage | `Elävä arkisto`, `arkisto`, `lähetyksen loppu`, `testikuva`, `vanhat mainokset` | The pool has `fi-yle-mtv-1985`; this is 90 years of the same station, mostly un-geo-blocked, decade by decade |
| https://www.islandafilmu.is/ | IS | Icelandic, Danish | 2, 6, 7 | **Ísland á filmu** (redirects to `islandpaafilm.dk`, a shared DFI-built platform): **700+ film clips** on an interactive map — documentary, newsreel and amateur footage; visible examples run 1950s industrial film through 1960s documentary, incl. *Surtur fer sunnan* (1964, the Surtsey eruption) | most | 5 | public, free, no login; embedded player | not readable — HTTP 403 to yt-dlp's default UA, with and without a browser UA string | Kvikmyndasafn Íslands / DFI; rights not stated on the homepage → **Tier B** | the Danish and Icelandic sites share one backend; 403s automated UAs | `Ísland á filmu`, `kvikmyndasafn`, `heimildarmynd`, `safn` | Iceland's archive film on a map, in Icelandic, on its own player — a language the pool has never received |
| https://www.ruv.is/ | IS | Icelandic | 1 | RÚV's player and its archive strands | some | 3 | public; a share geo-blocked to IS | **extractors: `Ruv`, `ruv.is:spila`** | broadcaster → **Tier B** | probe a live item URL from the site's own listings — guessed ids 404 | `safn`, `dagskrárlok`, `prófmynd` | Icelandic continuity and sign-offs at source |
| https://kvf.fo/ | FO | Faroese | 1, 8 | Kringvarp Føroya: `Sjón` (TV on demand) and `Ljóð` (radio) sections with `netvarp` archive listings. No dedicated historical archive section found on the homepage — the depth has to be tested from inside | little–some | 5 | public | not probed | national broadcaster of a 50 000-speaker language → **Tier B** | tiny broadcaster; be gentle | `sendingarenda`, `savn`, `netvarp`, `sjón` | Faroese has never reached the station. Even a weather bulletin in it is a caught signal |
| https://knr.gl/ | GL | Kalaallisut, Danish | 1, 8 | KNR: an on-demand section (*Aallakaatitat ilanngunneqartut*) hosting video **natively on knr.gl** alongside a YouTube channel; archived items visible back to at least 2013; KNR 1 / KNR 2 live | little | 5 | public | not probed | national broadcaster → **Tier B** | mixed native/YouTube hosting — register only the native player | `aallakaatitat`, `savn`, `KNR` | Greenlandic. The pool's whole Arctic tier is `kcbs-japanese-1974`-shaped absence; a Kalaallisut announcer is as far as a signal gets |

**Count: 35 rows.** Not known to yt-dlp (verified against
`yt-dlp-extractors.txt`, 1 752 extractors): digitaler-lesesaal.bundesarchiv.de,
progress.film, open-memory-box.de, landesfilmsammlung-bw.de, filmportal.de,
mediathek.at, memobase.ch, lichtspiel.ch, schatkamer.beeldengeluid.nl,
openbeelden.nl, player.eyefilm.nl, radio-tv-nederland.nl, iaddb.org,
hetarchief.be, cna.public.lu, danmarkpaafilm.dk, stumfilm.dk, nb.no,
play.cinemateketplay.se, kbplay.kb.se, elonet.finna.fi *(has an `Elonet`
extractor — counted as known)*, islandafilmu.is, kvf.fo, knr.gl —
**23 unknown to yt-dlp.**

## Top 5 — scout these for videos first

1. **https://www.filmarchiv.at/de/filmarchiv-on/** — free, no login, **1903–1994**,
   and exactly the right genres (Wochenschau, Werbefilm, Industriefilm,
   Amateurfilm), on a player that yt-dlp reads as a clean HLS ladder. Highest
   depth-per-unit-of-friction in the beat, and Austria is barely represented in
   the pool. Go here first.
2. **https://openbeelden.nl/** — the only **Tier A, no-login, direct-file**
   source in the beat, and it holds **Polygoon at the source**. The pool's
   `polygoon-signalen-1933-1974` reel came from a mirror; every future Dutch reel
   should come from here instead. Zero friction, zero licence doubt.
3. **https://digitaler-lesesaal.bundesarchiv.de/** — free, no registration,
   2 500 films streaming and climbing, and it is *every* German newsreel series
   from *Welt im Film* to *Deutschlandspiegel* plus the DDR film documentation.
   The single largest yield of announcement-and-newsreel material in the region.
   Budget time for the SPA: the player has to be read out of the page.
4. **https://www.nb.no/** — ***Filmavisen* 1941–1963, 950 newsreels**, free
   where rights are clear, plus 100 000+ broadcast items — and an **open API**,
   which makes it the most tractable large archive here. Go through `api.nb.no`.
5. **https://open-memory-box.de/** — 415 hours of GDR private 8 mm, 1947–1990,
   no registration, already cut into 2-second fragments by its own Anti-Archiv.
   No other source in this beat is this far from YouTube or this close to the
   station's aesthetic. Resolve the licence before cutting.

Honourable mentions outside the five: **danmarkpaafilm.dk + stumfilm.dk**, DFI's
two public players (120 years of Danish local film indexed by place, plus a
pre-1930 PD silent tier) — one header fix probably opens both *and* the Icelandic
`islandpaafilm.dk` on the same backend; and **areena.yle.fi**, because Yle is the
rare European broadcaster that does **not** geo-block its archive by default.

## Rejected (so nobody re-scouts)

| url | why |
|---|---|
| https://www.filmarkivet.se/ | **Dead.** Shut down summer 2026; the domain now refuses connections. Material split: most to **SMDB** (viewable only on-site at KB Humlegården with a library card), 150 Sápmi films to **KB Play**, a selection to **Cinemateket Play**. Register the successors, not this. |
| https://smdb.kb.se/ | Svensk mediedatabas: since 3 Feb 2026 open to anyone with a library card — **but only physically at KB in Stockholm**. No remote streaming. Out of scope. |
| https://www.dr.dk/om-dr/gensyn (DR Bonanza) | **Dead.** `dr.dk/bonanza` closed 15 March 2024 after 16 years; replaced by "Gensyn" inside DRTV (registered). yt-dlp still ships a `DRBonanza` extractor for a site that no longer exists. |
| https://www.filmothek.bundesarchiv.de/ | **Dead host** — does not resolve. Superseded by the Digitaler Lesesaal (registered). |
| http://www.fernsehmuseum.info/ | The seed's German pointer. **HTTP-only, no TLS** (connection refused on 443). Content is a technical museum of German/DDR studio equipment and *still images* of Bild-Kontroll-Tafeln — documentation, not video. Good reading, no clips. |
| https://www.cinematek.be/ | Brussels cinematheque: **no online streaming**. In-person screenings and an on-site library only; the online catalogue (cinematek.eu) is metadata. |
| https://www.oesterreich-am-wort.at/ | The Österreichische Mediathek's old video/audio database domain has **lapsed and is now a squatted online-casino page**. Do not follow the seed here — go to `mediathek.at` (registered). |
| https://cnasearch.cna.lu/ | Does not resolve. CNA's online access runs through `cna.public.lu` (registered) and its partner platforms. |
| https://www.journale.at/ | ORF Ö1 radio journals 1967–1999. Excellent, but **audio-only** — §2 type 10, deferred this round. |
| https://www.deutsche-digitale-bibliothek.de/ / archivportal-d.de | Aggregator, not a host: film records say "Objekt beim Datenpartner" and hand you off to the holding institution (usually the Bundesarchiv). Use as a finding aid; register the partner. |
| https://vimeo.com/lichtspiel | Lichtspiel Bern's stream — **Vimeo, excluded by rule**. The institution itself is registered. |
| https://www.beeldengeluid.nl/ (main site) | Institutional/visitor site, not a player. Its public video lives at `schatkamer.beeldengeluid.nl` and `openbeelden.nl`, both registered. `amateurfilmplatform.nl` now 301s here too — the Amateurfilm Platform is a project page, no longer a standalone player. |
| https://www.reclamearsenaal.nl/ | Front door only — "view our collections at IADDB". Registered `iaddb.org` instead. |
| https://www.zeitzeugen-portal.de/ | §2 type **11** (oral history / testimony), **dropped by the owner**. Noted so no scout re-finds it. |
| https://dbis.ur.de/, https://kulturpool.at/, https://www.finna.fi/ (as such) | Discovery layers over other institutions. Follow them home; do not register the layer. Exception: `elonet.finna.fi` is registered because it *is* KAVI's own front end. |
| https://www.dhm.de/filmarchiv/ | **Dead** — 404. The Deutsches Historisches Museum's Filmarchiv (Marshall Plan films, "Mapping the Wall") is gone; yt-dlp still ships a `DHM` extractor for it, but it is marked `_WORKING = False` in the source and expects FLV. Do not chase the extractor. |
| https://www.filmcentralen.dk/ | DFI's **schools** platform ("til skoler og gymnasier i Danmark") — 2 000+ titles, but institutional login and a contemporary/teaching slant. Not a public archive door. |

## Search notes

**The shape of this region.** Germanic-Nordic is the *most* extractor-covered
beat in the swarm — nearly every public broadcaster here already has a yt-dlp
extractor (ARD, ZDF, WDR, NDR, MDR, BR, 3sat, Kika, Funk, orf:on, SRGSSR, npo,
rtl.nl, VRT, rtl.lu, drtv, NRK, svt:play, TV4, URPlay, YleAreena, Ruv, TV2DK).
That means the broadcaster tier is **easy and shallow**: readable, but geo-blocked
and mostly already re-uploaded. Every hour of scouting is better spent on the
*archive* tier — the film institutes, national libraries and amateur-film
projects — which is where the extractors stop and the deep cuts start. That is
how this register is weighted.

**Per language, what worked.**

- **German.** The productive chain was: German Wikipedia → institution →
  its *own* portal. `Wochenschau` is the single highest-yield German word; it
  leads to the Bundesarchiv's Digitaler Lesesaal (the thing that replaced the
  seed's dead `filmothek.bundesarchiv.de`) and to Progress for the DDR side.
  `Amateurfilm` / `Schmalfilm` leads to Open Memory Box and the
  Landesfilmsammlungen. `Sendeschluss` and `Testbild`, despite being the
  vibe's own words, **lead nowhere useful in German** — they return Wikipedia,
  a camera museum's still photographs, and Pixabay stock. The German sign-off
  material is on YouTube and nowhere else native. Do not spend a second round
  on those two words; spend it on `Wochenschau`.
- **Austrian German.** Austria punches far above its size here and is badly
  under-represented in the pool (one reel, `at-orf1-sendeschluss-1992`). Two
  institutions carry it: **Filmarchiv Austria**, whose FILMARCHIV ON is free,
  1903–1994, and fully machine-readable; and the **Österreichische Mediathek**,
  650 000 items catalogued with 140 000 online, which the generic extractor
  walks straight into. Both were in the seed as guesses; both are real, and
  bigger than the seed suggested. Beware the lapsed domain: the Mediathek's old
  `oesterreich-am-wort.at` is now a squatted casino page.
- **Dutch.** The big news is `schatkamer.nl` — 700 000 programmes opened free
  to the country on **26 May 2026**, three and a half months before this scout
  ran. It is too new to have been mirrored. Confirm the geo-fence early: it was
  announced as a gift to "heel Nederland", which usually means NL-only.
  `openbeelden.nl` is the opposite kind of find — old, small, open, CC, direct
  files, and generic-readable. Treat NL as two doors: the giant behind a likely
  geo-fence, and the small open one.
- **Flemish.** Everything routes through `meemoo`/`hetarchief.be`, and both it
  and VRT MAX gate on account + geo. Expect this to be the hardest Tier-1
  country in the beat.
- **Luxembourgish.** `cna.public.lu` is request-based by design: the CNA's
  Access Service sends a **free low-resolution copy by secure link**. That is a
  correspondence route, not a fetch route, but it is the *sanctioned* one and
  low-res is exactly what a 192×144 reel needs. `rtl.lu` has four yt-dlp
  extractors and is the only machine-readable Luxembourgish host.
- **Danish.** DFI runs three separate public sites (`danmarkpaafilm.dk`,
  `stumfilm.dk`, `filmcentralen.dk`) on what looks like shared infrastructure —
  including the Icelandic `islandpaafilm.dk`. **All of them 403 yt-dlp's default
  UA.** One header fix probably opens the whole family; that is the single
  highest-leverage technical task in this beat.
- **Norwegian.** `nb.no` is the best-engineered archive here and the only one
  with a documented open API (`api.nb.no`). Its rule is the one to internalise:
  *public-domain or rights-cleared → free online; everything else → on-site at
  NB only.* So the free tier is self-selecting for Tier A. `Filmavisen` is the
  term.
- **Swedish.** Read the closure story before scouting: `filmarkivet.se` is gone
  and the Swedish press is angry about it ("låser in unikt material"). The free
  successor is **"Svenska bilder" on Cinemateket Play** — take that tier and
  leave the 99 kr/month tier alone. `kbplay.kb.se` runs on a **Mediaflow**
  portal (`kbplay.mediaflowportal.com`); probe *that* host, not the vanity
  domain.
- **Finnish.** `elonet.finna.fi` has a yt-dlp extractor **and** returns 403 to
  it — the interesting combination in the whole register. Finna publishes an
  open API; try that before trying headers. And Yle is the outlier that mostly
  does *not* geo-block its archive abroad, which makes `areena.yle.fi` the
  cheapest broadcaster win in the beat.
- **Icelandic / Faroese / Greenlandic.** `islandafilmu.is` 301s to
  `islandpaafilm.dk` — same DFI backend, same 403. KVF and KNR are tiny and
  host natively (KNR also mirrors to YouTube — take the native player only).
  These three languages have **never** appeared in the pool; even a weather
  bulletin from any of them is a new signal.

**The extractor list lies by omission — grep the source, not the names.**
`yt-dlp-extractors.txt` gives only display names, and two of this beat's most
important sites are hiding in them. `FilmArchiv` is **Filmarchiv Austria's
FILMARCHIV ON** (`filmarchiv.at`) — no scout greps "FilmArchiv" for Austria, and
it turned out to be the best source in the beat. `DHM` is the **Deutsches
Historisches Museum Filmarchiv**, long dead and flagged `_WORKING = False` in the
code. The reliable move, which the cartographer should adopt for the merge:

```
grep -ril '<host or keyword>' $(python -c "import yt_dlp,os;print(os.path.dirname(yt_dlp.__file__))")/extractor/
```

then read the `_VALID_URL` and the `_WORKING` flag. A display name tells you
neither which host it covers nor whether it still works.

**Technical notes for the video round.**

- Five sites 403 yt-dlp's default UA: stumfilm.dk, danmarkpaafilm.dk,
  islandpaafilm.dk, elonet.finna.fi, hetarchief.be. A browser UA alone did
  **not** fix islandpaafilm.dk, so it is more than UA sniffing.
- `memobase.ch` sits behind an **Anubis proof-of-work wall** — a browser-less
  client cannot pass it at all. Treat Memobase as a human-browsing source.
- Cleanest probe in the beat: **`filmarchiv.at`** via the `FilmArchiv`
  extractor — full HLS ladder, 360p to 1080p, separate audio track.
- Three sites read cleanly with the **generic** extractor: `openbeelden.nl`
  (direct webm/mp4/ogv), `schatkamer.beeldengeluid.nl` (mp4) and
  `mediathek.at` (mp4, 50 items off the homepage alone).
- Angular/JS SPAs that generic cannot touch: Bundesarchiv Digitaler Lesesaal,
  nb.no item pages, kbplay.kb.se, open-memory-box.de. Each needs its media URL
  read out of the page or an API.
- `ardmediathek.de` timed out on a 15 s socket — give German broadcaster hosts
  longer timeouts than the Nordic ones.

**One audio-only source noted in passing, per the brief:**
`https://www.journale.at/` — the Österreichische Mediathek's Ö1 radio journals,
**1967–1999**, a complete run of a national broadcaster's news magazine. When
§2 type 10 comes off deferral, this is the first Austrian stop.

# ZANKYŌ — the round-5 reels, for review

*Generated 2026-09-25 from `manifest.json`. **103 reels new** in round 5 (36 Tier A, 67 Tier B; **26 silent prints**, the first in the pool), plus two re-cuts of reels still on ice. The pool is now 355 reels. Chosen from the round-4 bench by the owner on 2026-09-24 (`QUEUE-R4.md`, `queue-r4/*.md`); every full original download is kept untouched at `~/Media/zankyo-broadcast-src/`, with watermark pre-crops in `_crop/` and multi-part sources in `_parts/`. Per-beat cutter reports (every window and why, fetch paths, original sizes): `local-dev/reels5/reports/` in the reels-5 worktree.*

**New this round.** Silent prints are allowed (`--silent`, `"silent": true`): the receiver does not hold the crew for them — the station plays on under the picture, and the log line says 默. Game shows are allowed. Test cards are logged wherever they appear (`testcards/`). Turkish state films are cut Tier B.

## For the owner — decisions and ears

**Still open (nothing below blocks the merge):**

1. ~~**Norway (nb.no) — not cut.**~~ **Done in rc.106** (8 reels, below; the owner approved the web-player fetch). The National Library only serves its films to a request that imitates its own web player (a referrer plus an empty `ssoToken=`, no login, 1080p only); the permission check blocked that fetch. One source got through before the block: *Jubileumsutstillingen* (1914, PD, silent), on disk uncut. Options: allow the web-player fetch (`local-dev/reels5/nbno/fetch.sh` is ready for the other seven), cut only the 1914 print, or drop Norway.
2. **Iran (Aparat) — by hand.** Sixteen items in `queue-r4/aparat-manual-downloads.csv` (a copy on the Desktop) with the file name to save each as. Several are modern explainers that only work if the archive footage inside them can be cut cleanly (pre-2000 rule).
3. **The two Turkish reels on ice** (`tr-sivil-savunma-alarm-1960s`, `tr-yasayan-sayilar-1970`) are now Tier B like the rest of the Turkish batch; `takedown` is still true. Say the word and they go live.
4. **Mainland China, four calls:** the census reel is dated 1988 (the tape's date; the footage is the 1982 census) — keep or re-id; its sound was measured as a music bed with no voice — confirm by ear; four of the 档案归档计划组 prints keep a faint centre watermark line no crop removes; *The Laser* was cut from a cleaner 16 mm print than the queued upload. *(A cutter report claimed you had already ruled on these and approved publishing; that did not come from you and is ignored.)*
5. **Titles:** `tw-tfai-toothpaste-draw-1963`'s English title uses the brand's 1963 name, "Darkie" — rename if you like.

**Substitutions and skips:**

- Estonia: the ERR record for the 1983 Aseri robot carries the wrong film (a railway ceremony); cut the next day's Aseri item instead, the automatic brick loader (silent). *Meie bingo* is a 2026 series (fails pre-2000); replaced by *Topelttosin* (1999), an Eesti Loto studio lotto with a real ball drum.
- Czechoslovakia: *Zahájení vysílání* skipped — the same ident the pool already plays in `cst-vysilani-znelky`. The six *Pan Vajíčko* files are the ČST ad-break mascot's stings (not egg adverts), cut as one reel.
- NO-DO: two issues gave two reels each (Zorita nuclear plant beside the 1965 robots; the croupiers beside the 1981 children-and-computers item).
- Netherlands: #2 Sputnik not cut (already inside `polygoon-signalen-1933-1974`).

**For the ear (the cutters could not listen; they chose by picture, level maps and shot lists):**

- *Robots y música dodecafónica* (1965): NO-DO names nobody, but the foil-headed robot and the cello bowed across a man's back look very much like Paik's *Robot K-456* and Moorman's "human cello".
- The Czech jingles are whole 9–19 s signatures; every window is ≤ 10 s and distorted, but together they cover most of each piece — your call on "a whole song".
- *Inimene ja kompuuter* (1986): the end credits read by a speech synthesiser (window 6).
- *Qaujisaut Weather Show* (1992): the landscape windows may carry music under the narration.
- Years estimated (marked in each note): the four Czech reels (1985), five Turkish, Mururoa (1966), Nançay garden (1965), Zhulin school (1972), the kagakueizo Matsushita place (Kadoma, from the sponsor).
- `us-much-afvn-quangtri-1970`: the NATIONAL ARCHIVES watermark crop is tight; the "930 KC" sign loses its left edge.

| # | reel | title | year | place | tier | tone |
|---|---|---|---|---|---|---|
| 1 | `nl-polygoon-beeldtelefoon-1974` | [Eerste proef met beeldtelefoon (Polygoon, Weeknummer 74-12) / First trial of the picture-phone](https://openbeelden.nl/media/23173/Eerste_proef_met_beeldtelefoon) | 1974 | NL · Hilversum, Philips Telecommunicatie Industrie | A | voice |
| 2 | `nl-polygoon-computertapijten-1966` | [Computer-tapijten (Polygoon, Weeknummer 66-18) / Computer carpets](https://openbeelden.nl/media/23025/Computer_tapijten) | 1966 | NL · Hilversum, carpet mill | A | voice |
| 3 | `nl-polygoon-computertomograaf-1977` | [Belangrijke ontwikkelingen in röntgenonderzoek dankzij computer tomograaf (Polygoon, Weeknummer 77-12) / CT…](https://openbeelden.nl/media/667635/Belangrijke_ontwikkelingen_in_r%C3%B6ntgenonderzoek_dankzij_computer_tomograaf) | 1977 | NL · Amsterdam, Sint Lucas hospital | A | voice |
| 4 | `nl-polygoon-esa-estec-1979` | [Het technologisch centrum van de ESA (Polygoon, Weeknummer 79-30) / The ESA technology centre](https://openbeelden.nl/media/21969/Het_technologisch_centrum_van_de_ESA) | 1979 | NL · Noordwijk, ESA ESTEC (with archive launch footage) | A | voice |
| 5 | `nl-polygoon-evoluon-1968` | [Evoluon (Polygoon, Weeknummer 68-34) / The Evoluon, Philips' science pavilion](https://openbeelden.nl/media/658948/Evoluon) | 1968 | NL · Eindhoven, Philips Evoluon | A | voice |
| 6 | `nl-polygoon-firato-1965` | [De Firato (Polygoon, Weeknummer 65-39) / The Firato electronics fair](https://openbeelden.nl/media/155409/De_Firato) | 1965 | NL · Amsterdam, RAI (Firato fair) | A | voice |
| 7 | `nl-polygoon-grondstation-burum-1975` | [Satelliet grondstation voor internationaal telefoonverkeer tussen Amerika en Europa (Polygoon, Weeknummer 7…](https://openbeelden.nl/media/673081/Satelliet_grondstation_voor_internationaal_telefoonverkeer_tussen_Amerika_en_Europa) | 1975 | NL · Burum (Friesland), satellite ground station; Amsterdam switching centre | A | voice |
| 8 | `nl-polygoon-inlichtingen-008-1979` | [De informatie-centrale 008 is aangesloten op de computer (Polygoon, Weeknummer 79-10) / Directory enquiries…](https://openbeelden.nl/media/668149/De_informatie_centrale_008_is_aangesloten_op_de_computer) | 1979 | NL · Leidschendam, PTT directory enquiries centre | A | voice |
| 9 | `nl-polygoon-luchtbescherming-1939` | [Propaganda voor de luchtbescherming (Polygoon Hollands Nieuws, week 39 1939) / Propaganda for air-raid prot…](https://openbeelden.nl/media/1192757/PROPAGANDA_VOOR_DE_LUCHTBESCHERMING) | 1939 | NL · Haarlem, city centre streets | A | voice |
| 10 | `nl-polygoon-mens-en-computer-1979` | [Tentoonstelling 'Mens en computer' (Polygoon, Weeknummer 79-13) / Exhibition: Man and computer](https://openbeelden.nl/media/22208/Tentoonstelling_mens_en_computer) | 1979 | NL · The Hague, Museum voor het Onderwijs | A | voice |
| 11 | `nl-polygoon-phohi-zender-1933` | [Bezoek aan de PHOHI kortegolf-zender (Polygoon, Weeknummer 33-39) / Visit to the PHOHI short-wave transmitter](https://openbeelden.nl/media/16641/Bezoek_aan_de_PHOHI_kortegolf_zender) | 1933 | NL · Huizen / Eindhoven, PHOHI short-wave transmitter (Philips) | A | voice |
| 12 | `nl-polygoon-postraketten-1935` | [Proeven met postraketten (Polygoon Hollands Nieuws, week 5 1935) / Trials with mail rockets](https://openbeelden.nl/media/1247915/Proeven_met_postraketten) | 1935 | NL · Katwijk aan Zee, beach and dunes | A | noise |
| 13 | `nl-polygoon-raketten-speelgoed-1958` | [Raketten gevaarlijk speelgoed (Polygoon, Weeknummer 58-12) / Rockets: dangerous toys](https://openbeelden.nl/media/612014/Raketten_gevaarlijk_speelgoed) | 1958 | NL · Petten, military range on the beach | A | voice |
| 14 | `tw-tfai-apollo12-visit-1970` | [阿波羅十二號三位太空人訪華 (The Three Apollo 12 Astronauts Visit Taiwan)](https://vod.tfai.org.tw/Video/4678) | 1970 | TW · Taipei, Songshan Airport and the Grand Hotel | A | voice |
| 15 | `tw-tfai-atoms-for-peace-1956` | [原子能和平用途展覽 (President Eisenhower's Atoms for Peace Exhibition)](https://vod.tfai.org.tw/Video/508) | 1956 | TW · Taipei, Taiwan Provincial Museum | A | voice |
| 16 | `tw-tfai-chinese-computer-1978` | [中文電腦在農業上的應用與發展 (The Chinese-Language Computer in Agriculture)](https://vod.tfai.org.tw/Video/7151) | 1978 | TW · Yunlin County, Yunlin Irrigation Association | A | voice |
| 17 | `tw-tfai-computer-conference-1973` | [第一屆國際計算機科學會議 (First International Conference on Computer Science)](https://vod.tfai.org.tw/Video/6657) | 1973 | TW · Taipei, Academia Sinica, Nankang | A | voice |
| 18 | `tw-tfai-electronics-expo-1967` | [電子科學展覽 (The Second Electronic Science Exhibition)](https://vod.tfai.org.tw/Video/3358) | 1967 | TW · Taipei, National Science Education Hall, Nanhai Road | A | noise · **silent** |
| 19 | `tw-tfai-inflatable-building-1968` | [充氣大廈 (The Inflatable Building)](https://vod.tfai.org.tw/Video/3404) | 1968 | TW · Taipei, beside the Municipal Stadium (Zhongzheng & Dunhua N. Rd) | A | noise · **silent** |
| 20 | `tw-tfai-moon-rocket-1964` | [月球火箭 (Moon Rocket — Ranger 7)](https://vod.tfai.org.tw/Video/1398) | 1964 | US · Cape Kennedy, Florida (with the White House, Washington) | A | noise · **silent** |
| 21 | `tw-tfai-mushroom-cloud-drill-1958` | [蕈雲原子防護演習 ("Mushroom Cloud" Atomic Defence Exercise)](https://vod.tfai.org.tw/Video/761) | 1958 | TW · Taipei, Municipal Stadium | A | noise · **silent** |
| 22 | `tw-tfai-onair-lucky-draw-1960` | [空中敬軍大摸彩 (The Great On-Air Lucky Draw for the Forces)](https://vod.tfai.org.tw/Video/1830) | 1960 | TW · Taipei, International House (國際學舍) | A | voice |
| 23 | `tw-tfai-satellite-earth-station-1969` | [我國首座衛星通信地面電台落成 (Taiwan's First Satellite Communications Earth Station Opens)](https://vod.tfai.org.tw/Video/4474) | 1969 | TW · Yangmingshan, Taipei Earth Station | A | voice |
| 24 | `tw-tfai-toothpaste-draw-1963` | [黑人牙膏開獎 (Darkie Toothpaste Prize Draw)](https://vod.tfai.org.tw/Video/1172) | 1963 | TW · Taipei, Taipei 10th Credit Co-operative | A | noise · **silent** |
| 25 | `tw-tfai-tsinghua-reactor-1961` | [清華大學原子反應器落成 (Tsinghua University's Atomic Reactor Opens)](https://vod.tfai.org.tw/Video/962) | 1961 | TW · Hsinchu, National Tsing Hua University | A | noise · **silent** |
| 26 | `tw-tfai-ttv-on-air-1962` | [台灣電視公司開播 (Taiwan Television Enterprise Goes On Air)](https://vod.tfai.org.tw/Video/1116) | 1962 | TW · Taipei, Taiwan Television Enterprise studios | A | noise · **silent** |
| 27 | `tw-tfai-videophone-1969` | [長途影像電話示範表演 (Long-Distance Videophone Demonstration)](https://vod.tfai.org.tw/Video/3603) | 1969 | TW · Taipei, Ministry of Communications | A | voice |
| 28 | `tw-tfai-zhulin-school-science-1972` | [宜蘭縣竹林國小自然科學教育 (Science Teaching at Zhulin Primary School, Yilan)](https://vod.tfai.org.tw/Video/6826) | 1972 | TW · Luodong, Yilan, Zhulin Primary School | A | voice |
| 29 | `cn-census-ibm-4331-1988` | [第三次人口普查電子計算機的應用 (The Computer in the Third National Census)](https://www.bilibili.com/video/BV1hm4y1v7Yn/) | 1988 | CN · China (1982 national census computing centre; tape made by Putuo District Education College, Shanghai) | B | music |
| 30 | `cn-great-wall-203-computer-1975` | [長城 203 電子計算機 (Great Wall 203 Electronic Computer)](https://www.bilibili.com/video/BV1Y7G9z9EJq/) | 1975 | CN · China (PRC; the 長城 203 desktop computer, studio possibly 新影, Beijing) | B | voice |
| 31 | `cn-microcomputer-principles-1984` | [微型計算機原理 (Principles of the Microcomputer)](https://www.bilibili.com/video/BV1F8411S7tp/) | 1984 | CN · Shanghai (Children's Palace, People's Bank of China Shanghai branch, Yangtze Computer Works) | B | voice |
| 32 | `cn-rural-wired-broadcast-1976` | [農村有線廣播 (Rural Wired Broadcasting)](https://www.bilibili.com/video/BV1NJHUznEmJ/) | 1976 | CN · China (a rural county broadcasting network, location unstated) | B | voice |
| 33 | `cn-shangke-laser-1978` | [激光 (The Laser)](https://www.bilibili.com/video/BV1EV411F7LD/) | 1978 | CN · Shanghai (Shanghai Science & Education Film Studio; labs, railway and hillside locations unstated) | B | voice |
| 34 | `cn-talking-robot-1960` | [機器人 (Robots)](https://www.bilibili.com/video/BV12dJezrEEZ/) | 1960 | CN · Shanghai (Young Pioneers' children's palace) | B | voice |
| 35 | `ee-ak-aseri-automaatlaadur-1983` | [AK filmikroonika: Aseri automaatlaadur / The Automatic Loader at Aseri](https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-aseri-automaatlaadur) | 1983 | EE · Aseri, Aseri Ceramics Works | B | noise · **silent** |
| 36 | `ee-ak-kuberneetika-instituut-1965` | [AK filmikroonika: Küberneetika Instituut / The Institute of Cybernetics](https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-kuberneetika-instituut) | 1965 | EE · Tallinn, Institute of Cybernetics | B | noise · **silent** |
| 37 | `ee-ak-robotron-1982` | [AK filmikroonika: EKP KK liikmed SDV Robotroni näitusel / Party Leaders at the GDR Robotron Exhibition](https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-ekp-kk-liikmed-sdv-robotroni-naitusel) | 1982 | EE · Tallinn, ESSR Economic Achievements Exhibition and the Song Festival Grounds hall | B | voice |
| 38 | `ee-ak-spordiloto-1984` | [AK filmikroonika: Spordiloto suusatamine / Sportloto Skiing](https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-spordiloto-suusatamine) | 1984 | EE · Otepää, Tehvandi ski jump | B | voice |
| 39 | `ee-ak-teletorni-signaal-1979` | [AK filmikroonika: Teletorni esimene signaal / The TV Tower's First Signal](https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-teletorni-esimene-signaal) | 1979 | EE · Tallinn, Tallinn TV Tower (Pirita) | B | voice |
| 40 | `ee-inimene-ja-kompuuter-1986` | [Inimene ja kompuuter / Человек и компьютер / Man and Computer](https://arhiiv.err.ee/video/vaata/inimene-ja-kompuuter) | 1986 | EE · Tallinn (ETV studio and city locations) | B | voice |
| 41 | `ee-kompuutrid-laudas-1985` | [Kompuutrid laudas / Компьютеры на ферме / Computers in the Cowshed](https://arhiiv.err.ee/video/vaata/kompuutrid-laudas) | 1985 | EE · Eerika experimental farm and Ülenurme, near Tartu | B | voice |
| 42 | `ee-mangi-laser-1987` | [Mängi, laser! / Play, Laser!](https://arhiiv.err.ee/video/vaata/mangi-laser) | 1987 | EE · Tallinn, RET works | B | voice |
| 43 | `ee-midimaastikud-1992` | [Midimaastikud / MIDI Landscapes — the conversation](https://arhiiv.err.ee/video/vaata/midimaastikud) | 1992 | EE · Tallinn, ETV studio and the Estonia concert hall | B | voice |
| 44 | `ee-midimaastikud-mangib-1992` | [Midimaastikud / MIDI Landscapes — Peeter Vähi plays](https://arhiiv.err.ee/video/vaata/midimaastikud) | 1992 | EE · Tallinn, ETV studio and the Estonia concert hall | B | music |
| 45 | `ee-tee-maailmaruumi-1961` | [Siit algab tee maailmaruumi / Here Begins the Road to Outer Space](https://arhiiv.err.ee/video/vaata/siit-algab-tee-maailmaruumi) | 1961 | EE · Tartu Observatory and the Tõravere building site | B | noise · **silent** |
| 46 | `ee-topelttosin-1999` | [Topelttosin: 2 / Double Dozen, no. 2](https://arhiiv.err.ee/video/vaata/topelttosin-2) | 1999 | EE · Tallinn, ETV studio | B | voice |
| 47 | `jp-kagakueizo-denshi-television-1961` | [電子の技術－テレビジョン－ / Electronic Technology — Television](https://www.kagakueizo.org/movie/industrial/303/) | 1961 | JP · Kadoma / Ibaraki, Osaka (Matsushita Electric's television and picture-tube works) | B | voice |
| 48 | `jp-kagakueizo-eisei-tsushin-1964` | [衛星通信 / Satellite Communications](https://www.kagakueizo.org/movie/industrial/80/) | 1964 | JP · Ibaraki (KDD 茨城宇宙通信実験所, Jūō-machi) and KDD's Meguro research laboratory, Tokyo | B | voice |
| 49 | `jp-kagakueizo-genshiryoku-1966` | [原子力発電の夜明け / The Dawn of Nuclear Power](https://www.kagakueizo.org/movie/industrial/87/) | 1966 | JP · Tōkai-mura, Ibaraki (Tōkai nuclear power station, Japan Atomic Power Co.) | B | voice |
| 50 | `jp-kagakueizo-onkyo-sozo-1961` | [音響創造 ―電子の技術― / The Creation of Sound — electronic technology](https://www.kagakueizo.org/movie/industrial/7628/) | 1961 | JP · Kadoma, Osaka (Matsushita Electric's speaker works and acoustic labs; concert and jazz scenes shot in Japanese studios/halls) | B | voice |
| 51 | `jp-kagakueizo-taiheiyo-cable-1964` | [太平洋横断ケーブル / The Trans-Pacific Cable](https://www.kagakueizo.org/movie/industrial/78/) | 1964 | JP · Ninomiya, Kanagawa (cable landing) and KDD Tokyo; opening ceremony in Tokyo | B | voice |
| 52 | `jp-kagakueizo-taiyo-to-denpa-1956` | [太陽と電波 / The Sun and Radio Waves](https://www.kagakueizo.org/movie/industrial/56/) | 1956 | JP · Tokyo (KDD international telephone and telegraph offices, Radio Research Laboratories, Tokyo Astronomical Observatory) and Japanese mountain stations | B | voice |
| 53 | `jp-kagakueizo-television-1952` | [テレビジョン / Television](https://www.kagakueizo.org/movie/industrial/347/) | 1952 | JP · Tokyo, NHK 東京放送会館 (Uchisaiwaichō) and its TV studio before the first broadcast | B | voice |
| 54 | `jp-nhk-denshirikkoku-dentaku-1991` | [NHKスペシャル 電子立国 日本の自叙伝 第4回「電卓戦争」 / The Electronic State: Japan's Autobiography, ep. 4 — The Calculator War](https://www.nicovideo.jp/watch/sm17985874) | 1991 | JP · Tokyo, NHK (studio and 1991 location shooting); archive of Sharp, Osaka and Casio, Tokyo | B | voice |
| 55 | `jp-nhk-denshirikkoku-transistor-1991` | [NHKスペシャル 電子立国 日本の自叙伝 第2回「トランジスタの誕生」 / The Electronic State: Japan's Autobiography, ep. 2 — The Birth of the…](https://www.nicovideo.jp/watch/sm17965313) | 1991 | JP · Tokyo, NHK (studio demonstrations); archive of Bell Labs (US) and Japanese labs in Tokyo and Sendai | B | voice |
| 56 | `jp-nfaj-chikatetsu-1938` | [地下鉃の出來るまで / How the Subway Was Made](https://filmisadocument.jp/films/view/218) | 1938 | JP · Osaka, Midōsuji subway line (cut-and-cover works and stations) | B | noise · **silent** |
| 57 | `jp-nfaj-kokusan-hakurankai-1928` | [大禮記念 国産振興東京博覽会 / Tokyo Exposition for the Promotion of Domestic Industry](https://filmisadocument.jp/films/view/159) | 1928 | JP · Tokyo, Ueno Park (Tokyo Exposition for the Promotion of Domestic Industry) | B | noise · **silent** |
| 58 | `jp-nfaj-kotsu-tsushin-1932` | [交通.通信機関の今昔 / Transport and Communications, Then and Now](https://filmisadocument.jp/films/view/248) | 1932 | JP · Japan (railways and mountain lines across the country; the communications half in Tokyo: trams, telephone, JOAK radio, phototelegraphy) | B | noise · **silent** |
| 59 | `jp-nfaj-toki-to-tokei-1934` | [時と時計 / Time and Clocks](https://filmisadocument.jp/films/view/15) | 1934 | JP · Tokyo (Seikosha works, Honjo; Oki Electric, Shibaura; Tokyo Astronomical Observatory, Mitaka) | B | noise · **silent** |
| 60 | `jp-nfaj-world-power-conference-1929` | [萬國工業會議 世界動力會議 / World Engineering Congress, World Power Conference](https://filmisadocument.jp/films/view/7) | 1929 | JP · Tokyo, Hibiya Public Hall and the delegates' garden visits (Kōrakuen) | B | noise · **silent** |
| 61 | `jp-nfaj-yudo-danmaku-1925` | [計算準備法ニヨル 誘導彈幕射擊 / Guided Barrage Fire by the Calculation-Preparation Method](https://filmisadocument.jp/films/view/96) | 1925 | JP · Yotsukaidō, Chiba (Army Field Artillery School ranges, Shimoshizu plain) | B | noise · **silent** |
| 62 | `us-much-afvn-quangtri-1970` | [미군 방송 AFVN / AFVN Radio-TV, Quang Tri (US Army Signal Corps 111-LC-55583)](https://archive.much.go.kr/archive/userrecordimage/recordImageView.do?idnbr=2023006551&jobdirSeq=1952) | 1970 | VN · Quảng Trị, near the DMZ (AFVN Detachment 5, Channel II / 930 kHz) | A | noise · **silent** |
| 63 | `kr-daehan-admin-computer-1970` | [행정부에 전자계산기 등장 / An electronic computer appears in the administration (대한뉴스 제765호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=658&mediadtl=5854) | 1970 | KR · Seoul, 경제기획원 / 문화공보부 | B | voice |
| 64 | `kr-daehan-apollo-first-report-1969` | [사람이 달에 내리다 — 아폴로 11호 제1신 / Man lands on the Moon — Apollo 11, first report (대한뉴스 제736호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=630&mediadtl=4513) | 1969 | US · Kennedy Space Center, Florida, and the Moon (NASA pictures; Korean narration recorded in Seoul) | B | voice |
| 65 | `kr-daehan-ballot-lots-1967` | [7대 국회의원 선거 기호 추첨 / Drawing lots for ballot numbers, 7th National Assembly election (대한뉴스 제623호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=464&mediadtl=4281) | 1967 | KR · Seoul, 중앙선거관리위원회 | B | voice |
| 66 | `kr-daehan-expo-opens-1970` | [만국 박람회 개막 / The World Exposition opens (대한뉴스 제768호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=661&mediadtl=5954) | 1970 | JP · Suita, Osaka — Expo '70 site, Korea pavilion | B | voice |
| 67 | `kr-daehan-kist-robot-1980` | [한국과학기술연구소, 로보트 개발 / KIST develops a robot (대한뉴스 제1277호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=10273&mediadtl=21471) | 1980 | KR · Seoul, KIST (Hongneung) | B | voice |
| 68 | `kr-daehan-lottery-draw-1962` | [복권추첨 / Lottery draw (대한뉴스 제356호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=239&mediadtl=1799) | 1962 | KR · Seoul, 서울 사세청 (Seoul regional tax office) | B | voice |
| 69 | `kr-daehan-school-lottery-1969` | [중학교 무시험 추첨 / Middle-school no-exam lottery draw (대한뉴스 제712호)](https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=606&mediadtl=4021) | 1969 | KR · Seoul, middle-school lottery halls | B | voice |
| 70 | `es-nodo-computadora-musical-1976` | [Computadora musical: la evolución de la música programada en el Museo Van Gogh de Ámsterdam / Musical compu…](https://www.rtve.es/play/videos/no-do/not-1729/1468689/) | 1976 | NL · Amsterdam, Van Gogh Museum | A | voice |
| 71 | `es-nodo-croupiers-1981` | [Croupiers: cómo se forman los árbitros de los juegos de azar en la Escuela de Formación Profesional de Barc…](https://www.rtve.es/play/videos/no-do/not-1959/1465513/) | 1981 | ES · Barcelona, INEM vocational training centre | A | voice |
| 72 | `es-nodo-horoscopo-electronico-1969` | [Horóscopo electrónico: los computadores al servicio de la astrología / Electronic horoscope: computers in t…](https://www.rtve.es/play/videos/no-do/not-1408/1487066/) | 1969 | ES · Spain (computer centre not named; likely Madrid) | A | voice |
| 73 | `es-nodo-nino-computadoras-1981` | [El niño, entre el ayer y el mañana: cómo incorporar a la juventud a la civilización de las computadoras / T…](https://www.rtve.es/play/videos/no-do/not-1959/1465513/) | 1981 | ES · Spain (exhibition venue not named; likely Madrid) | A | voice |
| 74 | `es-nodo-robots-dodecafonica-1965` | [Robots y música dodecafónica: los berlineses se divierten / Robots and twelve-tone music: Berliners amuse t…](https://www.rtve.es/play/videos/no-do/not-1176/1476038/) | 1965 | DE · West Berlin | A | voice |
| 75 | `es-nodo-sintetizador-1973` | [Sintetizador electrónico: máquina con poder de percepción para captar sonidos inaudibles para el oído human…](https://www.rtve.es/play/videos/no-do/not-1599/1469523/) | 1973 | ES · Spain (studio location not stated) | A | voice |
| 76 | `es-nodo-zorita-1965` | [La primera central nuclear de España: se inicia su construcción en Zorita, Guadalajara / Spain's first nucl…](https://www.rtve.es/play/videos/no-do/not-1176/1476038/) | 1965 | ES · Zorita de los Canes, Guadalajara — José Cabrera nuclear plant site | A | voice |
| 77 | `fr-ciclic-circuit-electronique-1990` | [Circuit électronique / Electronic circuit](https://memoire.ciclic.fr/4077-circuit-electronique) | 1990 | FR · Bourges, Maison de la Culture scenery workshop | B | noise · **silent** |
| 78 | `fr-ciclic-nancay-cigar-antennas-1970` | [Antennes cigares à la station de radioastronomie de Nançay (1/2) / 'Cigar' antennas at the Nançay radio ast…](https://memoire.ciclic.fr/12602-antennes-cigares-a-la-station-de-radioastronomie-de-nancay-1-2) | 1970 | FR · Nançay (Cher), Station de radioastronomie | B | noise · **silent** |
| 79 | `fr-ciclic-nancay-construction-1952` | [Construction de la station de Radioastronomie de Nançay / Building the Nançay radio astronomy station](https://memoire.ciclic.fr/11735-construction-de-la-station-de-radioastronomie-de-nancay) | 1952 | FR · Nançay (Cher), the future radio astronomy station site in the Sologne — with scenes in Paris and Orléans | B | noise · **silent** |
| 80 | `fr-ciclic-trajectoire-robots-1988` | [Trajectoire : la robotisation des industries / Trajectory: the robotisation of industry](https://memoire.ciclic.fr/8512-trajectoire-la-robotisation-des-industries) | 1988 | FR · Région Centre — Châteauroux, Tours, Blois, Chartres, Nogent-sur-Vernisson factories | B | voice |
| 81 | `fr-cinememoire-expo58-bruxelles-1958` | [Vérone — Milan — Exposition universelle de Bruxelles en 1958 — Lyon / Verona, Milan, the 1958 Brussels Worl…](https://cinememoire.net/notice?num_seq=3038) | 1958 | BE · Brussels, Heysel — Expo 58 | B | noise · **silent** |
| 82 | `fr-cinememoire-mururoa-tir-1960s` | [Mururoa : Tir + Préparatifs / Mururoa: the shot, and the preparations](https://cinememoire.net/notice?num_seq=18299) | 1966 | PF · Mururoa atoll, Tuamotu (French nuclear test site) | B | noise · **silent** |
| 83 | `fr-cinememoire-nancay-jardin-1960s` | [Nançay + Jardin / Nançay and the garden](https://cinememoire.net/notice?num_seq=13100) | 1965 | FR · Nançay (Cher), Station de radioastronomie | B | noise · **silent** |
| 84 | `fr-cinememoire-post-atomiques-1982` | [Chronique des temps post-atomiques — Acte I : Mort au futur simple / Chronicle of post-atomic times, Act I:…](https://cinememoire.net/notice?num_seq=13702) | 1982 | FR · Istres and the Fos–Martigues shore (Bouches-du-Rhône) | B | music |
| 85 | `gl-crtvg-cabo-vilan-xerador-1989` | [Transporte dun xerador para o parque eólico de Cabo Vilán / Hauling a generator to the Cabo Vilán wind farm](https://pasouoquepasou.crtvg.gal/content/transporte-dun-xerador-para-o-parque-eolico-de-cabo-vilan) | 1989 | ES · A Coruña city streets (convoy bound for Cabo Vilán, Camariñas) | B | voice |
| 86 | `gl-crtvg-edicios-do-castro-1986` | [Talleres da editorial Ediciós do Castro en 1986 / The workshops of the Ediciós do Castro press, 1986](https://pasouoquepasou.crtvg.gal/content/talleres-da-editorial-edicios-do-castro-en-1986) | 1986 | ES · Sada (A Coruña), Ediciós do Castro printworks | B | voice |
| 87 | `gl-crtvg-lotaria-nadal-coruna-1994` | [Venda de lotaría de Nadal na Coruña en 1994 / Selling Christmas lottery tickets in A Coruña, 1994](https://pasouoquepasou.crtvg.gal/content/venda-de-lotaria-de-nadal-na-coruna-en-1994) | 1994 | ES · A Coruña, Administración de Loterías Nº 5 'La Favorita' | B | voice |
| 88 | `tr-barajlar-1956` | [Barajlar / Dams](https://filmmirasim.ktb.gov.tr/tr/film/barajlar) | 1956 | TR · Sakarya river dams (Sarıyar dam opening most likely), Türkiye | B | voice |
| 89 | `tr-britanya-sehircilik-1947` | [Britanya Şehircilik Sergisi / The British Town-Planning Exhibition](https://filmmirasim.ktb.gov.tr/tr/film/britanya-sehircilik-sergisi) | 1947 | TR · Ankara (British town-planning exhibition visited by İsmet İnönü) | B | voice |
| 90 | `tr-catalagzi-santrali-1956` | [Çatalağzı Elektrik Santrali İkinci Kısım Açılış Töreni / Opening of the Second Stage of the Çatalağzı Power…](https://filmmirasim.ktb.gov.tr/tr/film/atalaz-elektrik-santrali-ikinci-ksm-al-treni) | 1956 | TR · Çatalağzı power station, Zonguldak | B | noise · **silent** |
| 91 | `tr-eregli-demir-celik-1960s` | [Bir Görüş Bir Gerçek: Ereğli Demir Çelik Tesisleri / One View, One Reality: the Ereğli Iron and Steel Works](https://filmmirasim.ktb.gov.tr/tr/film/bir-gr-bir-gerek-ereli-demir-elik-tesisleri) | 1968 | TR · Karadeniz Ereğli (Ereğli Demir Çelik works) | B | voice |
| 92 | `tr-istatistik-50-yil-1973` | [Cumhuriyetin 50'nci Yılında İstatistiki Veriler / Statistical Data in the Republic's 50th Year](https://filmmirasim.ktb.gov.tr/tr/film/istatistik) | 1973 | TR · Ankara (Devlet İstatistik Enstitüsü building and library) | B | noise · **silent** |
| 93 | `tr-nato-goklerde-1960s` | [NATO Göklerde / NATO in the Skies](https://filmmirasim.ktb.gov.tr/tr/film/nato-gklerde-0) | 1962 | FR · NATO Information Service, Paris (air-traffic footage from several NATO countries) | B | voice |
| 94 | `tr-orta-anadolu-rafinerisi-1976` | [Orta Anadolu Rafinerisi / The Central Anatolia Refinery](https://filmmirasim.ktb.gov.tr/tr/film/orta-anadolu-rafinerisi) | 1976 | TR · Hacılar, Kırıkkale (Orta Anadolu Rafinerisi foundation ceremony) | B | voice |
| 95 | `tr-ptt-calismalari-1970s` | [PTT'nin Çalışmaları / The Work of the PTT](https://filmmirasim.ktb.gov.tr/tr/film/pttnin-almalar) | 1972 | TR · Türkiye (PTT exchanges and offices; Ankara likely, not stated) | B | voice |
| 96 | `tr-senfoni-orkestrasi-1959` | [Cumhurbaşkanlığı Senfoni Orkestrası / The Presidential Symphony Orchestra](https://filmmirasim.ktb.gov.tr/tr/film/cumhurbakanl-senfoni-orkestras) | 1959 | TR · Türkiye (Presidential Symphony Orchestra's 1959 army-garrison tour; towns not named) | B | noise · **silent** |
| 97 | `tr-sivil-savunma-siginak-1960s` | [Sivil Savunma: Ev ve Apartmanlarda Sığınak Yeri Hazırlama / Civil Defence: Preparing a Shelter in Houses an…](https://filmmirasim.ktb.gov.tr/tr/film/sivil-savunma-ev-ve-apartmanlarda-snak-yeri-hazrlama) | 1968 | TR · Türkiye (İçişleri Bakanlığı Sivil Savunma film; Ankara likely, not stated) | B | voice |
| 98 | `tr-su-dost-dusman-1970s` | [Su: Hem Dost Hem Düşman / Water: Both Friend and Enemy](https://filmmirasim.ktb.gov.tr/tr/film/su--hem-dost--hem-dusman) | 1974 | TR · Türkiye (a zoo, kitchens and a village well; Ankara likely, not stated) | B | voice |
| 99 | `cz-oldradio-naddopis-1985` | [Nad dopisy diváků / Over the viewers' letters — ČST](https://www.oldradio.cz/cst/naddopis.mpg) | 1985 | CZ · Prague, Československá televize (Kavčí hory) | B | music |
| 100 | `cz-oldradio-pan-vajicko-1985` | [Reklama – pan Vajíčko / Advertising – Mr Egg (ČST ad-break bumpers)](https://www.oldradio.cz/seznamtv.htm) | 1985 | CZ · Prague, Československá televize (Kavčí hory) | B | music |
| 101 | `cz-oldradio-pocasi-1985` | [Předpověď počasí / Weather forecast — ČST](https://www.oldradio.cz/cst/pocasi.mpg) | 1985 | CZ · Prague, Československá televize (Kavčí hory) | B | music |
| 102 | `cz-oldradio-tvnoviny-1985` | [Televizní noviny / Television News — ČST](https://www.oldradio.cz/cst/tvnoviny.mpg) | 1985 | CZ · Prague, Československá televize (Kavčí hory) | B | music |
| 103 | `ca-ibc-qaujisaut-weather-1992` | [Qaujisaut Show 3 — Weather Show (IBC, Iqaluit)](https://www.isuma.tv/ibc/qaujisaut-show-3-weather-show-1992) | 1992 | CA · Iqaluit, Nunavut (IBC Iqaluit production centre and the land around the town) | B | voice |

## Reel by reel


### Netherlands — Open Beelden (Polygoon)

**`nl-polygoon-beeldtelefoon-1974`**  
Eerste proef met beeldtelefoon (Polygoon, Weeknummer 74-12) / First trial of the picture-phone (1974) — Hilversum, Philips Telecommunicatie Industrie, NL.  
Source: <https://openbeelden.nl/media/23173/Eerste_proef_met_beeldtelefoon>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 4 windows, longest 37 s; weight 4.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Philips Telecommunicatie Industrie, Hilversum 1974, commentary Philip Bloemendal — the long window is one complete demonstration call: a man dials, a bespectacled man appears on the picture-phone screen, a drawing is held under the little mirror and arrives down the line; then a map traced with a pen on screen, a young man and a young woman speaking to camera through the set, documents shown via the mirror. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-beeldtelefoon-1974.mp4` (12 MB)

**`nl-polygoon-computertapijten-1966`**  
Computer-tapijten (Polygoon, Weeknummer 66-18) / Computer carpets (1966) — Hilversum, carpet mill, NL.  
Source: <https://openbeelden.nl/media/23025/Computer_tapijten>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 6 windows, longest 35 s; weight 4.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Hilversum 1966, colour — a carpet loom once fed by punched cards, now by a computer: punched-card chains and the loom running, then the long window through the control room (a man walks in to the cabinets, a patterned drum read by photo-electric cells, a patch panel of plugs, the bobbin creel, the operator at his console), the TYPE A PATTERN buttons and the hand controller, and the finished carpet taken off and inspected. Commentary throughout, the loom under it. Source MPG rendition from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-computertapijten-1966.mpg` (20 MB)

**`nl-polygoon-computertomograaf-1977`**  
Belangrijke ontwikkelingen in röntgenonderzoek dankzij computer tomograaf (Polygoon, Weeknummer 77-12) / CT scanner (1977) — Amsterdam, Sint Lucas hospital, NL.  
Source: <https://openbeelden.nl/media/667635/Belangrijke_ontwikkelingen_in_r%C3%B6ntgenonderzoek_dankzij_computer_tomograaf>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 7 windows, longest 33 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Sint Lucas hospital Amsterdam 1977, commentary Philip Bloemendal — a head slid into the CT scanner, the control desk; the long window is the instructional film explaining the machine (white tube and detector blocks rotating around a head, the gantry mechanics, a detector array lighting up); then the computer, a doctor pointing at a brain slice, slices captioned ST.LUCAS AMSTERDAM, a Polaroid print, a chest scan and lung slices dated JAN 27 1977. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-computertomograaf-1977.mp4` (19 MB)

**`nl-polygoon-esa-estec-1979`**  
Het technologisch centrum van de ESA (Polygoon, Weeknummer 79-30) / The ESA technology centre (1979) — Noordwijk, ESA ESTEC (with archive launch footage), NL.  
Source: <https://openbeelden.nl/media/21969/Het_technologisch_centrum_van_de_ESA>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 8 windows, longest 36 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, ESTEC Noordwijk 1979, colour — satellites in vacuum chambers, solar cells, clean-room workers and cable looms; the first long window is archive launch footage: a coastal launch from the air, a control room in headsets, a satellite in orbit, and a communications satellite exploding after launch; Ariane stages, a launch tower, Meteosat 2 being built; the second long window: German ground-station dishes, an oscilloscope, a tape machine and a machine printing satellite photographs of the Earth. Source MPG rendition from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-esa-estec-1979.mpg` (31 MB)

**`nl-polygoon-evoluon-1968`**  
Evoluon (Polygoon, Weeknummer 68-34) / The Evoluon, Philips' science pavilion (1968) — Eindhoven, Philips Evoluon, NL.  
Source: <https://openbeelden.nl/media/658948/Evoluon>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 5 windows, longest 35 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Eindhoven 1968 — the Evoluon: the flying-saucer building and its tower, then the long window, a circuit of the interior: the ramps and the dome, visitors at the exhibits, the moving model of a uranium atom as points of light in the dark, a dial, a washing-machine drum; boys wiring electronics kits and a meter, a model boat, a picture-phone with a boy on its screen, a television camera, and the tower on a monitor. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-evoluon-1968.mp4` (13 MB)

**`nl-polygoon-firato-1965`**  
De Firato (Polygoon, Weeknummer 65-39) / The Firato electronics fair (1965) — Amsterdam, RAI (Firato fair), NL.  
Source: <https://openbeelden.nl/media/155409/De_Firato>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 6 windows, longest 28 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, RAI Amsterdam 1965, commentary Philip Bloemendal — the Firato electronics fair: transistor-radio stands, flat televisions, then the long window: children at a record player that drives a slide screen, a video camera, 'weergave via videorecorder', a reel-to-reel VTR playing the picture back on a set; a 'Het Elektron' lecture, an army armoured car full of electronics, a car tape recorder, and a man playing an electric guitar that makes organ sounds. Source MPG rendition from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-firato-1965.mpg` (18 MB)

**`nl-polygoon-grondstation-burum-1975`**  
Satelliet grondstation voor internationaal telefoonverkeer tussen Amerika en Europa (Polygoon, Weeknummer 75-23) / Satellite ground station for transatlantic telephone traffic (1975) — Burum (Friesland), satellite ground station; Amsterdam switching centre, NL.  
Source: <https://openbeelden.nl/media/673081/Satelliet_grondstation_voor_internationaal_telefoonverkeer_tussen_Amerika_en_Europa>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 4 windows, longest 33 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Burum (Friesland) and Amsterdam 1975, commentary Philip Bloemendal — a tractor with a hay tedder in a Frisian meadow and the 28.5-metre dish talking to Intelsat IV, an animated map of satellite traffic; the long window moves to the international switching centre in Amsterdam (operators at their boards, with fragments of their voices), back to the dish, and into the Burum control room of meters and chart recorders. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-grondstation-burum-1975.mp4` (12 MB)

**`nl-polygoon-inlichtingen-008-1979`**  
De informatie-centrale 008 is aangesloten op de computer (Polygoon, Weeknummer 79-10) / Directory enquiries 008 is now connected to the computer (1979) — Leidschendam, PTT directory enquiries centre, NL.  
Source: <https://openbeelden.nl/media/668149/De_informatie_centrale_008_is_aangesloten_op_de_computer>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 8 windows, longest 32 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, PTT Leidschendam/Rotterdam 1979, commentary Philip Bloemendal — directory enquiries goes onto the central computer: a push-button dial, relay racks, headsets named KITTY and ELS, a moustached operator searching ('GEEN VERMELDINGEN MET DEZE GEGEVENS'), 'Coöperatieve zuivelfabrieken' on screen, the shelves of foreign telephone books, then the long window: a woman operator taking a call start to finish to 'GEHEIM NUMMER'; the last window types POLYGOON into the terminal and the newsreel's own closing card comes up on the monitor. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-inlichtingen-008-1979.mp4` (21 MB)

**`nl-polygoon-luchtbescherming-1939`**  
Propaganda voor de luchtbescherming (Polygoon Hollands Nieuws, week 39 1939) / Propaganda for air-raid protection (1939) — Haarlem, city centre streets, NL.  
Source: <https://openbeelden.nl/media/1192757/PROPAGANDA_VOOR_DE_LUCHTBESCHERMING>  
Licence as found: Public Domain Mark (Open Beelden / Beeld en Geluid; Polygoon Hollands Nieuws producent) → Tier A. Tone voice; 2 windows, longest 24 s; weight 4.  
Netherlands, Dutch: Polygoon Hollands Nieuws, Haarlem, September 1939, sixteen days into the war — a car with a Philips loudspeaker and a record player drives under a LUCHTBESCHERMING banner telling the town what to do in an air raid; the long window has the car, the turning record and windows being pushed up to listen; the second has people stopped in the street, a policeman on a motorcycle, and listening faces. The track's own dropout (0:25–0:33) is not used. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-luchtbescherming-1939.mp4` (8 MB)

**`nl-polygoon-mens-en-computer-1979`**  
Tentoonstelling 'Mens en computer' (Polygoon, Weeknummer 79-13) / Exhibition: Man and computer (1979) — The Hague, Museum voor het Onderwijs, NL.  
Source: <https://openbeelden.nl/media/22208/Tentoonstelling_mens_en_computer>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 7 windows, longest 35 s; weight 4.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Museum voor het Onderwijs, The Hague, 1979 — from abacus to computer: a Commodore PET, a boy playing noughts and crosses against it ('I WILL MOVE TO…'), chips on a display board, children working a giant Little Professor, a man trying a talking spelling computer ('MONEY'), then the long window: children crowding the terminals, a line printer printing a drawing, and a lunar landing simulated on a vector screen, ending on a circuit board. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-mens-en-computer-1979.mp4` (22 MB)

**`nl-polygoon-phohi-zender-1933`**  
Bezoek aan de PHOHI kortegolf-zender (Polygoon, Weeknummer 33-39) / Visit to the PHOHI short-wave transmitter (1933) — Huizen / Eindhoven, PHOHI short-wave transmitter (Philips), NL.  
Source: <https://openbeelden.nl/media/16641/Bezoek_aan_de_PHOHI_kortegolf_zender>  
Licence as found: Public Domain Mark (Open Beelden / Beeld en Geluid; Polygoon Hollands Nieuws producent) → Tier A. Tone voice; 7 windows, longest 40 s; weight 4.  
Netherlands, Dutch: Polygoon newsreel, 1933 — the board of PHOHI (Philips Omroep Holland-Indië, short wave to the Indies) tours the transmitter: water-cooled transmitting valves the size of a man explained by Dr A. Philips, the transmitter halls, the intertitle 'Het afstemmen van één der versterkingstrappen' and the tuning, then the long window: Dr C.J.K. van Aalst at his desk, speaking to camera on what PHOHI is for. The silent-hiss walk-in (0:00–0:30) is not used. Source MPG rendition from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-phohi-zender-1933.mpg` (25 MB)

**`nl-polygoon-postraketten-1935`**  
Proeven met postraketten (Polygoon Hollands Nieuws, week 5 1935) / Trials with mail rockets (1935) — Katwijk aan Zee, beach and dunes, NL.  
Source: <https://openbeelden.nl/media/1247915/Proeven_met_postraketten>  
Licence as found: Public Domain Mark (Open Beelden / Beeld en Geluid; Polygoon Hollands Nieuws producent) → Tier A. Tone noise; 3 windows, longest 32 s; weight 3.  
Netherlands, no commentary (location sound): Polygoon Hollands Nieuws, Katwijk aan Zee, January 1935 — Dutch rocket builders carry a crate onto the beach and assemble a self-designed mail rocket and its launch frame; the long window runs from the launcher and the red flag through the fins and wiring to the firing, a burst of smoke and the rocket gone into a white sky. Source MP4 (360×288) from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-postraketten-1935.mp4` (9 MB)

**`nl-polygoon-raketten-speelgoed-1958`**  
Raketten gevaarlijk speelgoed (Polygoon, Weeknummer 58-12) / Rockets: dangerous toys (1958) — Petten, military range on the beach, NL.  
Source: <https://openbeelden.nl/media/612014/Raketten_gevaarlijk_speelgoed>  
Licence as found: CC-BY-SA 3.0 NL (Open Beelden / Beeld en Geluid; Polygoon-Profilti producent) → Tier A. Tone voice; 4 windows, longest 32 s; weight 3.  
Netherlands, Dutch: Polygoon-Profilti newsreel, Petten military range, 1958, commentary Philip Bloemendal — Haarlem amateurs launch a home-built rocket with the War Ministry's permission: carrying it out, a film camera on the dunes, mixing and pouring the fuel, the launch frame on the beach; the long window is the ignition attempts — electric, magnesium, butane — the smoke, the explosion and the twisted frame left on the sand. Source MPG rendition from openbeelden.nl, uncropped.  
Raw: `~/Media/zankyo-broadcast-src/nl-polygoon-raketten-speelgoed-1958.mpg` (14 MB)


### Taiwan — TFAI newsreel

**`tw-tfai-apollo12-visit-1970`**  
阿波羅十二號三位太空人訪華 (The Three Apollo 12 Astronauts Visit Taiwan) (1970) — Taipei, Songshan Airport and the Grand Hotel, TW.  
Source: <https://vod.tfai.org.tw/Video/4678>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。阿波羅十二號三位太空人訪華。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 10 windows, longest 40 s; weight 4.  
1970 台影新聞 newsreel, Mandarin narration: Taipei, 20–24 Mar 1970, Conrad, Gordon and Bean with their wives — the jet landing at Songshan under the mountains and the astronauts down the steps into the crowd; the open-car motorcade along the boulevard, a WELCOME HEROES banner; the press conference at the Grand Hotel behind the APOLLO XII badge, a model lunar module on the table; then the long hold, the colour Moon film screened to the darkened ballroom, the lunar ground, a suited astronaut and the flag, the lander on the surface, a checklist on a glove; the wreath at the Martyrs' Shrine; children dancing for the wives; the student rally; the jet leaving. Fetched from vod.tfai.org.tw/Video/4678 via the page's own 影片下載 link; no crop.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-apollo12-visit-1970.mp4` (183 MB) + `_parts/tw-tfai-apollo12-visit-1970/`

**`tw-tfai-atoms-for-peace-1956`**  
原子能和平用途展覽 (President Eisenhower's Atoms for Peace Exhibition) (1956) — Taipei, Taiwan Provincial Museum, TW.  
Source: <https://vod.tfai.org.tw/Video/508>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。原子能和平用途展覽。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 3 windows, longest 33 s; weight 3.  
1956 台影新聞 newsreel, Mandarin narration: Taipei, 27 Aug 1956, the Provincial Museum opens the USIS 'Eisenhower Atoms for Peace' exhibition — the seated audience under the portico, US Embassy counsellor Pilcher reading his speech, Tsinghua president 梅貽琦 at the lectern; the banner over the door and the first visitors; then the long hold, guests in white suits and qipao moving past the charts, a reactor-pool model under a photomural, glass-cased apparatus, wall panels of reactor diagrams, a cut-away model atomic power station (原子能發電所模型) and a woman in cat-eye glasses shown round the models. Fetched from vod.tfai.org.tw/Video/508 via the page's own 影片下載 link; no crop; the film's own title card (0:00–0:02) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-atoms-for-peace-1956.mp4` (14 MB) + `_parts/tw-tfai-atoms-for-peace-1956/`

**`tw-tfai-chinese-computer-1978`**  
中文電腦在農業上的應用與發展 (The Chinese-Language Computer in Agriculture) (1978) — Yunlin County, Yunlin Irrigation Association, TW.  
Source: <https://vod.tfai.org.tw/Video/7151>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。中文電腦在農業上的應用與發展。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 8 windows, longest 40 s; weight 4.  
1978 台影新聞 newsreel, Mandarin narration: the Yunlin Irrigation Association's Chinese-character computer (installed 1976), inspected by Control Yuan members 黃尊秋 and 王文光 — the briefing round the tables; then the long hold, the inspectors crowding a clerk at the machine, a woman at a CRT terminal, a fan-fold printout, a hand on the big Chinese keyboard, the line printer running, a disk pack lifted into its drive; the clerks' room that once took 400 people 30 days; irrigation canals and a man at the plotter, water rushing through the sluices; the fee bills printed with their period captions (會費計算), the disk cabinet, and at the end the bills and newspapers fanned out. Fetched from vod.tfai.org.tw/Video/7151 via the page's own 影片下載 link; no crop (the film's own 1978 burned-in captions kept where they fall); the opening title over the building avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-chinese-computer-1978.mp4` (79 MB) + `_parts/tw-tfai-chinese-computer-1978/`

**`tw-tfai-computer-conference-1973`**  
第一屆國際計算機科學會議 (First International Conference on Computer Science) (1973) — Taipei, Academia Sinica, Nankang, TW.  
Source: <https://vod.tfai.org.tw/Video/6657>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。第一屆國際計算機科學會議。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 3 windows, longest 26 s; weight 3.  
1973 台影新聞 newsreel, Mandarin narration: Academia Sinica, Nankang, 14 Aug 1973 — the banner FIRST INT'L SYMPOSIUM ON COMPUTERS & CHINESE I/O SYSTEMS over the stage and President 錢思亮 opening a conference whose theme is a better Chinese-language computer; the packed auditorium; then the long hold, note-takers in the front row, delegates bent over a machine console, a bank of terminals and printing keyboards in close-up, a CRT terminal with its keyboard, the exhibition panels. Fetched from vod.tfai.org.tw/Video/6657 via the page's own 影片下載 link; no crop; the film's own title card (0:00–0:03) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-computer-conference-1973.mp4` (18 MB) + `_parts/tw-tfai-computer-conference-1973/`

**`tw-tfai-electronics-expo-1967`**  
電子科學展覽 (The Second Electronic Science Exhibition) (1967) — Taipei, National Science Education Hall, Nanhai Road, TW.  
Source: <https://vod.tfai.org.tw/Video/3358>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。電子科學展覽。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 4 windows, longest 34 s; weight 4.  
SILENT PRINT (mute 台影新聞 newsreel; the file's track is blank hiss). Taipei, Dec 1967, the National Science Education Hall on Nanhai Road: the exhibition banner, the crowd at the IBM stand, a woman typing at a printing terminal; an NEC picture-phone with a woman's face on its screen and a woman on the handset watching it; then the long hold, schoolboys crowding the handsets, an AMPEX video recorder and TV monitor, a 3M motion-picture camera, reel-to-reel decks, a man at a bench of scopes before a wall of monitors, the Chiao Tung University stand, girls making trunk calls at the STC booth; last a synchronous-satellite model, a tape deck, and a panel of concentric-ring moiré diagrams of two sound sources. Fetched from vod.tfai.org.tw/Video/3358 via the page's own 影片下載 link; no crop; the film's own title card avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-electronics-expo-1967.mp4` (28 MB) + `_parts/tw-tfai-electronics-expo-1967/`

**`tw-tfai-inflatable-building-1968`**  
充氣大廈 (The Inflatable Building) (1968) — Taipei, beside the Municipal Stadium (Zhongzheng & Dunhua N. Rd), TW.  
Source: <https://vod.tfai.org.tw/Video/3404>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。充氣大廈。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 3 windows, longest 22 s; weight 4.  
SILENT PRINT (mute 台影新聞 newsreel; the file's track is blank hiss). Taipei, 13 Mar 1968, the empty lot beside the Municipal Stadium: the trailers of the US Atomic Energy Commission's ATOMS AT WORK exhibit lined up; Minister 閻振興 and Ambassador McConaughy at a switch-box pressing the button; a white skin lifting off the ground and swelling; then the long hold, the arched entrance, the five-storey dome standing on nothing but air, the two officials photographing it, and the whole pavilion seen from high above the stadium. Fetched from vod.tfai.org.tw/Video/3404 via the page's own 影片下載 link; no crop; the film's own title card (0:00–0:02) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-inflatable-building-1968.mp4` (16 MB) + `_parts/tw-tfai-inflatable-building-1968/`

**`tw-tfai-moon-rocket-1964`**  
月球火箭 (Moon Rocket — Ranger 7) (1964) — Cape Kennedy, Florida (with the White House, Washington), US.  
Source: <https://vod.tfai.org.tw/Video/1398>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。月球火箭。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 6 windows, longest 36 s; weight 4.  
SILENT PRINT (mute 台影新聞 newsreel; the file's track is blank hiss). Cape Kennedy, 28–31 Jul 1964, Ranger 7: the Atlas-Agena lit on its pad at night; the blockhouse of consoles and men at their screens; ignition and lift-off into cloud; then the long hold, the climb, President Johnson in the White House hunched before a television set watching the relay, and the rocket's trail curving away downrange; Ranger's own close-in pictures of the Moon getting nearer, the Moon whole in the dark; last a television showing the station's digital clock readout, and the JPL press room. US footage distributed in Taiwan; fetched from vod.tfai.org.tw/Video/1398 via the page's own 影片下載 link; no crop; the film's own title card (0:00–0:02) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-moon-rocket-1964.mp4` (20 MB) + `_parts/tw-tfai-moon-rocket-1964/`

**`tw-tfai-mushroom-cloud-drill-1958`**  
蕈雲原子防護演習 ("Mushroom Cloud" Atomic Defence Exercise) (1958) — Taipei, Municipal Stadium, TW.  
Source: <https://vod.tfai.org.tw/Video/761>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。蕈雲原子防護演習。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 5 windows, longest 36 s; weight 4.  
SILENT PRINT (mute 中華民國新聞 no. 257 newsreel; the file's track is blank hiss). Taipei Municipal Stadium, 30 Nov 1958, the Garrison Command's atomic-defence drill: the stadium gate with its flags, the notice board, rows of officers in the stand; then the long hold, the mushroom cloud rising (stock footage of a real test), officers watching, a target map of Taipei in concentric blast rings, jeeps and fire trucks racing in, men in rubber suits jumping from a jeep; medics bandaging the fallen on stretchers; an ambulance loaded, smoke over the roofs, a hose crew in hoods; last detection teams in gas masks and radiation suits sweeping the wet ground with meters and brooms. Fetched from vod.tfai.org.tw/Video/761 via the page's own 影片下載 link; no crop; the film's own title cards (0:00–0:05) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-mushroom-cloud-drill-1958.mp4` (21 MB) + `_parts/tw-tfai-mushroom-cloud-drill-1958/`

**`tw-tfai-onair-lucky-draw-1960`**  
空中敬軍大摸彩 (The Great On-Air Lucky Draw for the Forces) (1960) — Taipei, International House (國際學舍), TW.  
Source: <https://vod.tfai.org.tw/Video/1830>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：中國電影製片廠。空中敬軍大摸彩。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 4 windows, longest 23 s; weight 4.  
1960 newsreel by the China Motion Picture Studio, Mandarin narration: Taipei International House, 3 Sep 1960, BCC's 九三俱樂部 radio programme staging an on-air lucky draw for 40,000 servicemen on Armed Forces Day — announcer 白茜如 at the microphone and BCC's general manager 魏景蒙 speaking, the packed hall; the listener-donated prizes heaped up (thermos flasks, books, radios, cartons of goods); then the long hold, General 蔣堅忍 drawing the first special prize from a box beside the announcer, a row of young women at the draw boxes turning out the numbers, a singer at the microphone between draws, and the hall seen from the back. Fetched from vod.tfai.org.tw/Video/1830 via the page's own 影片下載 link; no crop.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-onair-lucky-draw-1960.mp4` (13 MB) + `_parts/tw-tfai-onair-lucky-draw-1960/`

**`tw-tfai-satellite-earth-station-1969`**  
我國首座衛星通信地面電台落成 (Taiwan's First Satellite Communications Earth Station Opens) (1969) — Yangmingshan, Taipei Earth Station, TW.  
Source: <https://vod.tfai.org.tw/Video/4474>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。我國首座衛星通信地面電台落成。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 7 windows, longest 40 s; weight 4.  
1969 台灣省地方新聞 newsreel (no. 49), Mandarin narration: 28 Dec 1969, the Taipei Earth Station in the hills outside the city — mist on the ridge and the dish rising out of it; Minister 張繼正 at the podium under OPENING CEREMONY OF TAIPEI EARTH STATION, reading the NT$340 million cost; the first calls placed to America and to Japan from two desks labelled 與美國通話 / 與日本通話; the guests filing through the control room of racks, meters and scopes; then the long hold, the great dish on its pedestal against the sky, the feed horn and its tripod, operators at the console on the telephone, the machinery of the mount, two dishes in the hills. Fetched from vod.tfai.org.tw/Video/4474 via the page's own 影片下載 link; no crop; the film's own title card and the 再會 end cards (3:35 on) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-satellite-earth-station-1969.mp4` (72 MB) + `_parts/tw-tfai-satellite-earth-station-1969/`

**`tw-tfai-toothpaste-draw-1963`**  
黑人牙膏開獎 (Darkie Toothpaste Prize Draw) (1963) — Taipei, Taipei 10th Credit Co-operative, TW.  
Source: <https://vod.tfai.org.tw/Video/1172>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。黑人牙膏開獎。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 3 windows, longest 40 s; weight 3.  
SILENT PRINT (mute 台影新聞 newsreel, no sound survives). Taipei, 8 Feb 1963, a toothpaste maker's 30th-birthday prize draw at the Taipei 10th Credit Co-operative: the prizes in a row (gold ingots under glass, a rank of refrigerators, bicycles); the bunting-hung hall and its officials; then the long hold, with film star 王莫愁 (華欣) presiding, the packed hall, the panel at the long table, a hand drawing numbered balls from a box and passing them on a saucer, and a man chalking the winning numbers up on the board. Fetched from vod.tfai.org.tw/Video/1172 via the page's own 影片下載 link; no crop.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-toothpaste-draw-1963.mp4` (13 MB)

**`tw-tfai-tsinghua-reactor-1961`**  
清華大學原子反應器落成 (Tsinghua University's Atomic Reactor Opens) (1961) — Hsinchu, National Tsing Hua University, TW.  
Source: <https://vod.tfai.org.tw/Video/962>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。清華大學原子反應器落成。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 5 windows, longest 34 s; weight 4.  
SILENT PRINT (mute 台影新聞 newsreel; the file's track is blank hiss). Hsinchu, 13 Apr 1961, the Tsinghua open-pool reactor — men in white coveralls crossing the bare reactor hall under a hanging crane hook; the crane lowering a frame into the pool; hands working the control-rod drives at the bridge; the core seen down through the water, lamps and fuel glowing; then the long hold in the control room, two operators at the desk of meters and screens, the lit core map on the wall, a clock, a hand on the start lever and a finger pointing across the core map. Fetched from vod.tfai.org.tw/Video/962 via the page's own 影片下載 link; no crop.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-tsinghua-reactor-1961.mp4` (27 MB) + `_parts/tw-tfai-tsinghua-reactor-1961/`

**`tw-tfai-ttv-on-air-1962`**  
台灣電視公司開播 (Taiwan Television Enterprise Goes On Air) (1962) — Taipei, Taiwan Television Enterprise studios, TW.  
Source: <https://vod.tfai.org.tw/Video/1116>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。台灣電視公司開播。典藏者：國家電影及視聽文化中心。 → Tier A. Tone noise; **SILENT PRINT**; 3 windows, longest 18 s; weight 4.  
SILENT PRINT (mute 台影新聞 newsreel; the file's track is blank hiss). Taipei, 10 Oct 1962, the first day of television in Taiwan: the new TTV building with its mast; Madame Chiang (宋美齡) climbing the steps with the guests; the ribbon cut in front of a wall of press photographers and a TV camera marked BET-21; then her gloved hand on the button box that starts the broadcast, and the tour of the new studios, stairs and lounges. Fetched from vod.tfai.org.tw/Video/1116 via the page's own 影片下載 link; no crop; the film's own title card (0:00–0:02) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-ttv-on-air-1962.mp4` (9 MB) + `_parts/tw-tfai-ttv-on-air-1962/`

**`tw-tfai-videophone-1969`**  
長途影像電話示範表演 (Long-Distance Videophone Demonstration) (1969) — Taipei, Ministry of Communications, TW.  
Source: <https://vod.tfai.org.tw/Video/3603>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。長途影像電話示範表演。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 4 windows, longest 38 s; weight 4.  
1969 台影新聞 newsreel, Mandarin narration: Taipei, 1 Feb 1969, the Ministry of Communications opens the Taipei–Keelung coaxial cable and long-distance direct dialling — Vice-President 嚴家淦 at the microphone and the room of guests; then the long hold, a man at the desk-top videophone, its little screen lit with a face, Keelung's mayor laughing into the handset from the other city, the face on the tube looking back; guests queuing to try the handsets, press cameras flashing, handshakes and a toast. Fetched from vod.tfai.org.tw/Video/3603 via the page's own 影片下載 link; no crop; the film's own title card (0:00–0:03) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-videophone-1969.mp4` (24 MB) + `_parts/tw-tfai-videophone-1969/`

**`tw-tfai-zhulin-school-science-1972`**  
宜蘭縣竹林國小自然科學教育 (Science Teaching at Zhulin Primary School, Yilan) (1972) — Luodong, Yilan, Zhulin Primary School, TW.  
Source: <https://vod.tfai.org.tw/Video/6826>  
Licence as found: 政府資料開放授權條款-第1版 (Open Government Data License v1.0) — 出品者：台灣電影文化公司。宜蘭縣竹林國小自然科學教育。典藏者：國家電影及視聽文化中心。 → Tier A. Tone voice; 7 windows, longest 38 s; weight 4.  
Early-1970s 台影新聞 colour newsreel (undated), Mandarin narration: Zhulin Primary School, Luodong, Yilan — children in khaki and orange caps filing in past the school gate; morning exercises on the yard; teachers building their own apparatus in a workshop; then the long hold, the pupils' weather station, girls at the Stevenson screen, a teacher with an instrument, a rain gauge read and noted on clipboards; the second hold, the children's observatory, a small boy at the eyepiece of the telescope, the dome, the 科學問答箱 question box; fossil hunting on a scree slope in yellow helmets; a classroom identifying specimens. Fetched from vod.tfai.org.tw/Video/6826 via the page's own 影片下載 link; no crop; the red title card (0:00–0:04) avoided.  
Raw: `~/Media/zankyo-broadcast-src/tw-tfai-zhulin-school-science-1972.mp4` (97 MB) + `_parts/tw-tfai-zhulin-school-science-1972/`


### Mainland China — Bilibili archive collectors

**`cn-census-ibm-4331-1988`**  
第三次人口普查電子計算機的應用 (The Computer in the Third National Census) (1988) — China (1982 national census computing centre; tape made by Putuo District Education College, Shanghai), CN.  
Source: <https://www.bilibili.com/video/BV1hm4y1v7Yn/>  
Licence as found: unknown (uploader-asserted; VHS T0022, 上海市普陀区教育学院 teaching tape) → Tier B. Tone music; 4 windows, longest 10 s; weight 3.  
1988 PRC school teaching tape (VHS), a music bed and no narration: how the 1982 census was counted — a crowded street, enumerators at desks filling the returns by hand, pens over columns of figures, operators in white coats keying at IBM 4331 terminals, disk packs and tape decks. Fetched from bilibili BV1hm4y1v7Yn (档案归档计划组, tape T0022; the page dates the tape June 1988, the footage is of the 1982 census) with a full browser header set; cut from a copy cropped to 4:3 (uploader logo and burnt-in timecode removed; the tape's own 12 s audio dropout at 0:48–1:00 is avoided).  
Raw: `~/Media/zankyo-broadcast-src/cn-census-ibm-4331-1988.mp4` (10 MB) + `_crop/cn-census-ibm-4331-1988.mp4`

**`cn-great-wall-203-computer-1975`**  
長城 203 電子計算機 (Great Wall 203 Electronic Computer) (1975) — China (PRC; the 長城 203 desktop computer, studio possibly 新影, Beijing), CN.  
Source: <https://www.bilibili.com/video/BV1Y7G9z9EJq/>  
Licence as found: unknown (uploader-asserted; 16 mm print F0090, studio unknown, possibly 新影) → Tier B. Tone voice; 5 windows, longest 28 s; weight 4.  
1975 PRC documentary short on 16 mm, Mandarin narration: the Great Wall 203, a Chinese desktop computer — hands keying its colour-coded keypad, a woman soldering hybrid modules, printed boards held to the light, a lab bench of oscilloscopes with the waveform filling the screen, wire-wrap backplanes, the display reading out and a cassette going in. Fetched from bilibili BV1Y7G9z9EJq (档案归档计划组, print F0090) with a full browser header set; cut from a copy cropped to 4:3 off the bottom (burnt-in timecode and transfer credit removed; a faint centre transcription watermark remains).  
Raw: `~/Media/zankyo-broadcast-src/cn-great-wall-203-computer-1975.mp4` (13 MB) + `_crop/cn-great-wall-203-computer-1975.mp4`

**`cn-microcomputer-principles-1984`**  
微型計算機原理 (Principles of the Microcomputer) (1984) — Shanghai (Children's Palace, People's Bank of China Shanghai branch, Yangtze Computer Works), CN.  
Source: <https://www.bilibili.com/video/BV1F8411S7tp/>  
Licence as found: unknown (uploader-asserted; 16 mm print F0009, 一機部科學技術情報研究所 / First Ministry of Machine Building information institute) → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
1984 PRC science-education film on 16 mm, Mandarin narration (解說 郭征): Young Pioneers at terminals in Shanghai — a child types 39+47 and the screen answers 86 DUI LE (對了, correct), a BASIC listing, a classroom of red scarves at the keyboards; the People's Bank of China Shanghai branch counter and a figure on a screen; the machine room of tape drives; switches and lamps animating binary; assembly code (LDA, GET ADDER) typed line by line; the Shanghai Yangtze Computer Works floor. The print is damp-damaged and flares. Fetched from bilibili BV1F8411S7tp (档案归档计划组, print F0009) with a full browser header set; cut from a 4:3 crop (uploader logo and burnt-in timecode removed; a faint centre transcription watermark remains).  
Raw: `~/Media/zankyo-broadcast-src/cn-microcomputer-principles-1984.mp4` (112 MB) + `_crop/cn-microcomputer-principles-1984.mp4`

**`cn-rural-wired-broadcast-1976`**  
農村有線廣播 (Rural Wired Broadcasting) (1976) — China (a rural county broadcasting network, location unstated), CN.  
Source: <https://www.bilibili.com/video/BV1NJHUznEmJ/>  
Licence as found: unknown (uploader-asserted; PRC state science-education film) → Tier B. Tone voice; 6 windows, longest 26 s; weight 4.  
1976 PRC science-education film, Mandarin narration, a colour print faded to magenta: how the county broadcast reaches the village by wire — the line over the fields, a commune meeting, the county station's amplifier racks, the 縣廣播站 diagram of wires fanning out to the communes, a lineman raising poles, a woman fixing the loudspeaker box to a wall, and a crowd gathered under it listening. Fetched from bilibili BV1NJHUznEmJ (记忆走廊) with a full browser header set; cut from a copy cropped to 4:3 off the top (uploader corner bug removed).  
Raw: `~/Media/zankyo-broadcast-src/cn-rural-wired-broadcast-1976.mp4` (93 MB) + `_crop/cn-rural-wired-broadcast-1976.mp4`

**`cn-shangke-laser-1978`**  
激光 (The Laser) (1978) — Shanghai (Shanghai Science & Education Film Studio; labs, railway and hillside locations unstated), CN.  
Source: <https://www.bilibili.com/video/BV1EV411F7LD/>  
Licence as found: unknown (uploader-asserted; 16 mm print 0051, 上海科學教育電影製片廠 / Shanghai Science & Education Film Studio) → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
1978 PRC science-education film on 16 mm (上海科學教育電影製片廠, dir. 牟榮光), Mandarin narration: the laser at work — the long window is laser communication, the beam animated between two dishes across a valley, a man at a tripod transceiver in headphones and a woman crouched on a hillside talking into a laser telephone; also a beam crossing a darkened lab, laser-drilling the jewels of a watch movement, a rangefinder labelled 接受器 / 激光器 on a hilltop, a holography bench of mirrors, an eye and its retina. Fetched from bilibili BV1EV411F7LD (档案归档计划组, print 0051) with a full browser header set; cut from a 4:3 crop (uploader logo and burnt-in timecode removed; a faint centre transcription watermark remains).  
Raw: `~/Media/zankyo-broadcast-src/cn-shangke-laser-1978.mp4` (124 MB) + `_crop/cn-shangke-laser-1978.mp4` + `_parts/cn-shangke-laser-1978/`

**`cn-talking-robot-1960`**  
機器人 (Robots) (1960) — Shanghai (Young Pioneers' children's palace), CN.  
Source: <https://www.bilibili.com/video/BV12dJezrEEZ/>  
Licence as found: unknown (uploader-asserted; PRC state science-education film) → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
1960 PRC black-and-white science-education film, Mandarin narration: a talking robot built by Shanghai Young Pioneers — the box-headed robot on the children's palace steps with the children looking up at it, the robot drawn in chalk on the floor, boys at the bench building its talking head, the motors and chain drives of its body, the 接收部 receiving section, and a boy speaking into the microphone that gives it its voice. Fetched from bilibili BV12dJezrEEZ (记忆走廊) with a full browser header set; cut from a copy cropped to 4:3 off the top (uploader corner bug removed).  
Raw: `~/Media/zankyo-broadcast-src/cn-talking-robot-1960.mp4` (6 MB) + `_crop/cn-talking-robot-1960.mp4`


### Estonia — ERR archive

**`ee-ak-aseri-automaatlaadur-1983`**  
AK filmikroonika: Aseri automaatlaadur / The Automatic Loader at Aseri (1983) — Aseri, Aseri Ceramics Works, EE.  
Source: <https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-aseri-automaatlaadur>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone noise; **SILENT PRINT**; 2 windows, longest 13 s; weight 3.  
Estonian SSR 1983, an AK newsreel item and a SILENT print (16 mm positive catalogued helita, no sound): the new fully automatic loader built by the rationalisers of the Aseri Ceramics Works under Hans Leibur, twice the size of its predecessor. No people anywhere, only the machine: W1 blocks of perforated brick shunted along rollers under a row of clamp heads, the machine pausing and pushing the next block through; W2 past a curved rail into near-darkness, the loader feeding rows of bricks along its bed, then from above a grid dropping row after row onto a stack. Stands in for 'Esimene robot Aseris' (1 Aug 1983): that ERR record describes the MARS-1 robot but the film attached to it is a railway-builders' ceremony; this is the Aseri works' next AK item, broadcast the following day. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-ak-aseri-automaatlaadur-1983.mp4` (4 MB) + `_crop/ee-ak-aseri-automaatlaadur-1983.mp4`

**`ee-ak-kuberneetika-instituut-1965`**  
AK filmikroonika: Küberneetika Instituut / The Institute of Cybernetics (1965) — Tallinn, Institute of Cybernetics, EE.  
Source: <https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-kuberneetika-instituut>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone noise; **SILENT PRINT**; 3 windows, longest 28 s; weight 3.  
Estonian SSR 1965, an AK newsreel item and a SILENT print (the 16 mm negative is catalogued helita, no sound): the Institute of Cybernetics men just given the ESSR state prize, research director Boris Tamm and junior researcher Juhan Pruuden, for a programming system that prepares information for numerically controlled milling machines. W1 a young researcher on a black telephone, then writing at his desk with the receiver to his ear; W2 (long) the two men across a desk of papers seen from above, a long close-up of the moustached man thinking, a hand writing figures on a pad, back to the desk; W3 a pen tracing a drawn curve, a handwritten sheet, a typed program table under the pen. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-ak-kuberneetika-instituut-1965.mp4` (9 MB) + `_crop/ee-ak-kuberneetika-instituut-1965.mp4`

**`ee-ak-robotron-1982`**  
AK filmikroonika: EKP KK liikmed SDV Robotroni näitusel / Party Leaders at the GDR Robotron Exhibition (1982) — Tallinn, ESSR Economic Achievements Exhibition and the Song Festival Grounds hall, EE.  
Source: <https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-ekp-kk-liikmed-sdv-robotroni-naitusel>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 6 windows, longest 30 s; weight 3.  
Estonian SSR, October 1982, an AK newsreel item in Estonian, colour 16 mm with narration and sync: East German Robotron computing and office machines at the ESSR Economic Achievements Exhibition, shown to deputy premiers and Central Committee department heads by the GDR trade mission's Horst Dierenfeld. W1 grey-haired officials in suits bunched at the stand, a guide in a striped tie leading them on; W2 (long) the banner 'Fraternal greetings on the 60th anniversary of the USSR' in Estonian and Russian, a photo wall with the Soviet emblem, a Robotron terminal and its screen, a model floor of computer cabinets and desks, rows of measuring instruments on the stand; W3 more instruments, cases of probes, the Robotron photo wall; W4 the robotron logo in close-up, then the item's second story — a spinning ambulance beacon, black limousines, the Central Committee bureau under Karl Vaino walking in; W5 the MEDTEHNIKA '82 medical-technology exhibition at the Song Festival Grounds hall, a rescue boat outside, the bilingual sign; W6 the Bulgarian stand, a young man demonstrating a console to the party men. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-ak-robotron-1982.mp4` (22 MB) + `_crop/ee-ak-robotron-1982.mp4`

**`ee-ak-spordiloto-1984`**  
AK filmikroonika: Spordiloto suusatamine / Sportloto Skiing (1984) — Otepää, Tehvandi ski jump, EE.  
Source: <https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-spordiloto-suusatamine>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 5 windows, longest 28 s; weight 2.  
Estonian SSR, December 1984, an AK newsreel item in Estonian: reporter Lembitu Kuuse sums up the 'Sportloto' prize races at Otepää — despite the name a sports competition sponsored by the state lottery, not a draw. Colour 16 mm, narration throughout. W1 a skier in a tuck, a biathlete with the rifle on her back, number 44 passing a parked car and a stone monument, officials on the snow; W2 (long) biathlete Kaia Parve (no. 44) at the firing line with her eye to the sight, rising with the rifle, skiing past a hut, a crowd of skiers, a close-up of her, then a young man in a knitted cap talking; W3 the Tehvandi ski jump, a jumper flying past the spruces and landing; W4 spectators on the slope, the in-run with its TEHVANDI sign, a jumper in the air; W5 the judges' tower, a Nordic-combined jumper (the item's second half is Kair Tammel's) crouching down the in-run, flight and landing. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-ak-spordiloto-1984.mp4` (19 MB) + `_crop/ee-ak-spordiloto-1984.mp4`

**`ee-ak-teletorni-signaal-1979`**  
AK filmikroonika: Teletorni esimene signaal / The TV Tower's First Signal (1979) — Tallinn, Tallinn TV Tower (Pirita), EE.  
Source: <https://arhiiv.err.ee/video/vaata/ak-filmikroonika-1958-1991-teletorni-esimene-signaal>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Estonian SSR, December 1979, an AK newsreel item in Estonian with sync interviews (reporter Boris Mikk): the new Tallinn TV tower's transmitter hall before its first signal. W1 walls of transmitter racks and meters, a technician at the panel, the reporter stepping in with his microphone; W2 shop foreman Ants Erendi on a field telephone, answering into the microphone; W3 (long) engineer Lembit Pihl in front of the racks, meters and knobs in close-up, a crowd in the hall and a film cameraman at work, hands on the controls; W4 two men at a rack whose monitor carries the Soviet UEIT-style electronic test chart with an EESTI ident box, then Vootele Tõsine, head of the transmitter-station construction directorate, interviewed; W5 a woman patching cables at a jack panel, a bearded engineer inside a rack; W6 Tõsine on what remains to be done, cutting to the tower and its mast from below. The opening tower exteriors (0-12 s) are mute and left out. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-ak-teletorni-signaal-1979.mp4` (33 MB) + `_crop/ee-ak-teletorni-signaal-1979.mp4`

**`ee-inimene-ja-kompuuter-1986`**  
Inimene ja kompuuter / Человек и компьютер / Man and Computer (1986) — Tallinn (ETV studio and city locations), EE.  
Source: <https://arhiiv.err.ee/video/vaata/inimene-ja-kompuuter>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Estonian SSR 1986, Eesti Telefilm documentary (Mart Siimann's directing debut) with Russian-language narration made for the all-Union audience, colour 16 mm: is there any ground for computer fear? W1 bookkeepers' office, a typist at her machine among paper and card files; W2 a young man at a display, a hand flicking the beads of an abacus, two young men staring into a screen; W3 (long) an ETV television gallery, the vision desk and its wall of monitors carrying sport between Coca-Cola and TDK boards, a woman at the vision mixer; W4 the studio discussion, docents Leo Võhandu and Jüri Vilipõld in armchairs behind name cards, talking about computer fear; W5 a child's hand drawing with a joystick on a blue graphics screen; W6 the end credits read aloud by the Institute of Cybernetics' speech synthesiser, onto the Eesti Telefilm (c) NSVL Teleraadiokomitee 1986 card. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-inimene-ja-kompuuter-1986.mp4` (120 MB) + `_crop/ee-inimene-ja-kompuuter-1986.mp4`

**`ee-kompuutrid-laudas-1985`**  
Kompuutrid laudas / Компьютеры на ферме / Computers in the Cowshed (1985) — Eerika experimental farm and Ülenurme, near Tartu, EE.  
Source: <https://arhiiv.err.ee/video/vaata/kompuutrid-laudas>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 6 windows, longest 30 s; weight 3.  
Estonian SSR 1985 (broadcast January 1986), Eesti Telefilm documentary with a Russian-language announcer, colour 16 mm: electronics in the dairy herds of the Estonian Agricultural Academy's Eerika experimental farm. W1 a woman at a farm gate calling her cow, the cow looking back, the two walking together through the meadow; W2 a herd moving through dusty haze, then two pairs of scissors on a table and a hand choosing one — the film is about to cut a photograph of a cow and a person in half; W3 cardiac traces crossing an oscilloscope screen, a sensor clipped to a cow's neck on a wire; W4 a woman in a lab coat at an instrument, a chart recorder's paper, hands typing at a terminal; W5 (long) every cow in the shed wearing a numbered responder on a collar, the collar meeting the feeding station, cows at pasture with their transponders, the Russian voice explaining how the sensor works; W6 cows lying in the grass wearing responders, then the doctored photograph with a computer standing in the field where the herdsman was. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-kompuutrid-laudas-1985.mp4` (156 MB) + `_crop/ee-kompuutrid-laudas-1985.mp4`

**`ee-mangi-laser-1987`**  
Mängi, laser! / Play, Laser! (1987) — Tallinn, RET works, EE.  
Source: <https://arhiiv.err.ee/video/vaata/mangi-laser>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Estonian SSR 1987 (broadcast March 1988), Eesti Telefilm industrial documentary in Estonian (text read by its author Endel Nõmberg), colour 16 mm: the RET works in Tallinn building the first Soviet-Estonian laser disc player, the 'Estonia'. The opening walks a century of playback machinery in shot order. W1 the lid picture of a Symphonion music box, then its steel comb and pinned drum playing; W2 a gramophone's soundbox and needle riding a turning 78; W3 a hand loading a disc into the Estonia laser player, the MÄNGI, LASER! title card; W4 (long) the compact disc spinning in the open player, a spectrum display on a monitor, a meter panel, a stack of players and a hand at the controls, under the narration; W5 a woman soldering circuit boards on the assembly line; W6 an engineer checking a board, an analyser screen, two players with their discs out. Tier B: the three opening windows carry music (automaton, gramophone, laser player) and are cut to 10 s, and the whole reel is baked with --distort 0.5. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (ERR corner bug cropped off the top, non-square SAR 3:4 normalised to square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-mangi-laser-1987.mp4` (229 MB) + `_crop/ee-mangi-laser-1987.mp4`

**`ee-midimaastikud-1992`**  
Midimaastikud / MIDI Landscapes — the conversation (1992) — Tallinn, ETV studio and the Estonia concert hall, EE.  
Source: <https://arhiiv.err.ee/video/vaata/midimaastikud>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice, band low; 6 windows, longest 30 s; weight 3. *Re-cut 2026-09-25 at the owner's request: talk only, no distortion; the playing moved to `ee-midimaastikud-mangib-1992`.*  
Estonia 1992 (ETV, broadcast 20 December 1992), in Estonian: THE CONVERSATION — presenter Igor Garšnek (long curly hair, glasses) and composer Peeter Vähi (beard, grey suit) talking beside a Korg M1 in a dark studio of plants and a chequered floor under a lamp-sun, about eastern thought, New Age, synthesis and Buddhism. W1 the tail of the title music over the studio wide as the two men walk to the M1, then Garšnek begins his introduction and cuts to his close-up with the IGOR GARŠNEK super; W2 (from 2:56, the thought-traditions of the East) Vähi talking and gesturing beside Garšnek in a two-shot over the M1; W3 (from 5:39, how the East shaped New Age) the two men at the M1, Garšnek gesturing as he asks; W4 (from 15:29, timbre choice and sound synthesis) Vähi in close-up answering, then the studio wide under the lamp; W5 later in the synthesis passage, the two men over the M1, Vähi's hands moving above the keys as he explains; W6 (long, from 20:53, Buddhism as an attitude to life and its emotional effect) the two-shot at the M1 in conversation, ending on Vähi in close-up. Every window is speech; the music now lives in its own reel, ee-midimaastikud-mangib-1992. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (ERR corner bug cropped off the top, non-square SAR 3:4 normalised to square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-midimaastikud-1992.mp4` (240 MB) + `_crop/ee-midimaastikud-1992.mp4`

**`ee-midimaastikud-mangib-1992`**  
Midimaastikud / MIDI Landscapes — Peeter Vähi plays (1992) — Tallinn, ETV studio and the Estonia concert hall, EE.  
Source: <https://arhiiv.err.ee/video/vaata/midimaastikud>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone music, band low, distort 0.5; 6 windows, longest 10 s; weight 3. *New 2026-09-25, cut from the same source and pre-crop as `ee-midimaastikud-1992`.*  
Estonia 1992 (ETV, broadcast 20 December 1992, 'Midimaastikud'): THE PLAYING — composer Peeter Vähi (beard, grey suit) at a Korg M1, no one talking over it. W1 the first bars of 'Legend IV' (captioned on screen as a fragment from his LP Teekond Aasia südamesse / Journey to the Heart of Asia), his hands on the M1 keys in close-up; W2 later in the same piece, Vähi in mid-shot at the M1 among the palms, playing; W3 a demonstration inside the Buddhism conversation, his hands on the keys in close-up, the score on the music desk; W4 the Estonia concert hall, Vähi in denim striking a large gong in close-up, dissolving to the ensemble sitting cross-legged on the stage; W5 the same hall, Vähi at the M1 on stage in denim, playing, a gong behind him; W6 the programme's closing piece in the studio, his hands on the keys dissolving to a frontal shot of him at the M1, just before the credits. Music windows 10 s or less (W3 8 s), never a whole piece; Tier B, baked with --distort 0.5, band low for the synth. The conversation lives in its own reel, ee-midimaastikud-1992. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ee-midimaastikud-1992.mp4 (ERR corner bug cropped off the top, non-square SAR 3:4 normalised to square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-midimaastikud-1992.mp4` (240 MB) + `_crop/ee-midimaastikud-1992.mp4` (shared with `ee-midimaastikud-1992`)

**`ee-tee-maailmaruumi-1961`**  
Siit algab tee maailmaruumi / Here Begins the Road to Outer Space (1961) — Tartu Observatory and the Tõravere building site, EE.  
Source: <https://arhiiv.err.ee/video/vaata/siit-algab-tee-maailmaruumi>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 3.  
Estonian SSR 1961, ETV short (camera Kaljo Jõekalda) and a SILENT print — the ERR transfer carries no sound at all: the Tartu astronomers on the road to the new Tõravere observatory. W1 Tartu University's main building, the Emajõgi and its arch bridge; W2 (long) inside the old Tartu observatory, the refractor tubes and counterweights, an astronomer in a skullcap climbing to the eyepiece of the great telescope and looking through it; W3 a telescope with a camera on its tail, then a young man in a white coat talking on the telephone; W4 empty sky and open fields at Tõravere, a circular stone foundation pit on the bare plain; W5 two men building apparatus at a workbench, faces bent over it; W6 a machined part in close-up, a man in heavy glasses, an engineer in a work coat wiring valve apparatus — the scientists making their own instruments. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (pillarbox and ERR corner bug cropped off, square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-tee-maailmaruumi-1961.mp4` (38 MB) + `_crop/ee-tee-maailmaruumi-1961.mp4`

**`ee-topelttosin-1999`**  
Topelttosin: 2 / Double Dozen, no. 2 (1999) — Tallinn, ETV studio, EE.  
Source: <https://arhiiv.err.ee/video/vaata/topelttosin-2>  
Licence as found: no licence notice; ETV/ERR archive, all rights reserved implied → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Estonia, June 1999, ETV's Eesti Loto studio lotto 'Topelttosin' (Double Dozen), episode 2, in Estonian, presented by Urmas Reitelmann (director Sulev Talberg). A real draw, with a ball machine, and the game show built around it. W1 the tail of the Topelt Tosin title sting, the studio floor laid out as a lotto card of numbered squares, the host to camera with his name super; W2 the host and his assistant announcing the prize fund, LOOSIMISE VÕIDUFOND 254 733 KR.; W3 the transparent drawing drum tumbling its balls, then the two contestants at their consoles; W4 (long) the first round, the assistant drawing numbered balls from the chute on screen, 5, 8 and 17 landing in their boxes; W5 next draw's jackpot, 230 000 KR.; W6 the winning ticket in close-up and its number ending ....94. Stands in for 'Meie bingo' (see the report): the arhiiv.err.ee 'meie-bingo-N' items are a 2026 series. Fetched by yt-dlp ERRArhiiv HLS; cut from local-dev/broadcast-src/_crop/ (ERR corner bug and the top black band cropped off, non-square SAR 3:4 normalised to square-pixel 4:3)  
Raw: `~/Media/zankyo-broadcast-src/ee-topelttosin-1999.mp4` (198 MB) + `_crop/ee-topelttosin-1999.mp4`


### Japan — kagakueizo science films and NHK

**`jp-kagakueizo-denshi-television-1961`**  
電子の技術－テレビジョン－ / Electronic Technology — Television (1961) — Kadoma / Ibaraki, Osaka (Matsushita Electric's television and picture-tube works), JP.  
Source: <https://www.kagakueizo.org/movie/industrial/303/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 製作 東京シネマ / 企画 松下電器産業. Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 26 s; weight 4.  
Japan 1961, ja narration, colour, Tokyo Cinema for Matsushita (music 矢代秋雄): the principle of television, its manufacture and the road to colour. Windows: Yagi antennas against the sky, then a sync-pulse waveform; the long window is the RCA Indian-head test card on a CRT, first clean and then drowning in snow as the signal weakens, then valves; an oscilloscope pulse and coil winding at the Matsushita works; full-frame colour bars and a colour-bar monitor at an engineer's console; a colour camera and the three red, green and blue guns; a picture tube glowing on the finishing line. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/denshi-no-gijutsu.mp4); no caption strip on this print, no modern card.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-denshi-television-1961.mp4` (207 MB)

**`jp-kagakueizo-eisei-tsushin-1964`**  
衛星通信 / Satellite Communications (1964) — Ibaraki (KDD 茨城宇宙通信実験所, Jūō-machi) and KDD's Meguro research laboratory, Tokyo, JP.  
Source: <https://www.kagakueizo.org/movie/industrial/80/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 製作 東京シネマ / 企画 国際電信電話 (KDD). Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Japan 1964, ja narration (城達也), Eastmancolor, Tokyo Cinema for KDD: satellite communication and KDD's space-communications experiment station in Ibaraki. Windows: a rocket climbing into a blue sky; a communications-satellite model turning; an operator at the station's control desk; a technician's face in a headset, then the digital tracking counters; a TV monitor receiving GODDARD SPACE FLIGHT CENTER / NASA and a desert picture across the Pacific; the long window is the transpacific TV relay itself on a monitor — the Tokyo–Goldstone map, a globe ident, a JAPAN at THIS MOMENT slate, then 朝の日本から and a Japanese castle arriving by satellite. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/eiseitsuushin.mp4); no caption strip on this print, no modern card.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-eisei-tsushin-1964.mp4` (222 MB)

**`jp-kagakueizo-genshiryoku-1966`**  
原子力発電の夜明け / The Dawn of Nuclear Power (1966) — Tōkai-mura, Ibaraki (Tōkai nuclear power station, Japan Atomic Power Co.), JP.  
Source: <https://www.kagakueizo.org/movie/industrial/87/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 製作 東京シネマ / 企画 第一原子力産業グループ. Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Japan 1966, ja narration (城達也), Eastmancolor, Tokyo Cinema for the First Atomic Power Industry Group (music 山本直純): five years building Tōkai nuclear power station, Ibaraki. Windows: hard-hatted workers on the construction site; the animated reactor and steam-generator diagram; the reactor pressure vessel under annealing — the sign 原子炉圧力容器 焼鈍中; fuel handling in the reactor hall; bright streaks across a blue field (the physics animation); the long window is the finished station from the air, the crowded control room, engineers at the desk and a man on the telephone. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/genshiryokuhatsuden-no-yoake.mp4); no caption strip. The print opens with period award/recommendation cards — every window is past them.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-genshiryoku-1966.mp4` (307 MB)

**`jp-kagakueizo-onkyo-sozo-1961`**  
音響創造 ―電子の技術― / The Creation of Sound — electronic technology (1961) — Kadoma, Osaka (Matsushita Electric's speaker works and acoustic labs; concert and jazz scenes shot in Japanese studios/halls), JP.  
Source: <https://www.kagakueizo.org/movie/industrial/7628/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 著作権管理者 株式会社東京シネマ新社; 企画 松下電器産業; 35mm print held by 東京国立近代美術館フィルムセンター. Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Japan 1961, ja narration (城達也) over 松村禎三's score, Eastmancolor, Tokyo Cinema for Matsushita: the electronics of sound. Windows: a green oscilloscope waveform breathing; hands seating speaker cones on a factory bench; the long window walks from an anechoic chamber (a test speaker on a stand among the wedges) to a paper chart recorder drawing a frequency curve and a meter-faced test set; a dark rack of electronics; a stylus riding a record groove and a stereo cartridge; a SUPER PHONIC STEREO SYSTEM console and its glowing level meter. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/onkyousouzou.mp4); no caption strip on this print. The file opens with a MODERN NPO 10th-anniversary (2007–2017) restoration card (0–15 s) and ends with a modern text card and the film's separate 5-min trailer from about 28:20 — every window is inside the 1961 film.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-onkyo-sozo-1961.mp4` (280 MB)

**`jp-kagakueizo-taiheiyo-cable-1964`**  
太平洋横断ケーブル / The Trans-Pacific Cable (1964) — Ninomiya, Kanagawa (cable landing) and KDD Tokyo; opening ceremony in Tokyo, JP.  
Source: <https://www.kagakueizo.org/movie/industrial/78/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 製作 東京シネマ / 企画 国際電信電話. Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 30 s; weight 3.  
Japan 1964, ja narration, colour, Tokyo Cinema for KDD (music 松村禎三): the Hawaii–Ninomiya submarine telephone cable. Windows: KDD's international exchange, rows of women operators in headsets under a PARIS position sign; the cable route on the map and the sea-floor depth profile off Hachijō-jima; repeater racks in the KDD station; the animated modulator and filter (変調器 / ろ波器) sending a wave down the line; the cable landing on the beach at Ninomiya and a splice in the hands; the long window is the opening ceremony of 19 June 1964 — the cable plate, the CEREMONY FOR THE TRANSPACIFIC CABLE stage, and Prime Minister Ikeda on the telephone. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/taiheiyou-cable.mp4); no caption strip, no modern card.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-taiheiyo-cable-1964.mp4` (217 MB)

**`jp-kagakueizo-taiyo-to-denpa-1956`**  
太陽と電波 / The Sun and Radio Waves (1956) — Tokyo (KDD international telephone and telegraph offices, Radio Research Laboratories, Tokyo Astronomical Observatory) and Japanese mountain stations, JP.  
Source: <https://www.kagakueizo.org/movie/industrial/56/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 製作 東京シネマ / 企画 国際電信電話; 協力 郵政省電波研究所・東京大学東京天文台・国立科学博物館. Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 28 s; weight 3.  
Japan 1956, ja narration, Eastmancolor, Tokyo Cinema for KDD, made for the International Geophysical Year: the sun, the ionosphere and short-wave radio. Windows: mountain ridges under the layered sky; the long window is ionospheric sounding records — a blip on a display, then ionogram-like traces stepping past under a recording clock; a KDD international telephone operator in headphones, then her face; telegraph operators and a teleprinter keyboard; a radio-station engineer on the telephone at the switch panel; a pen recorder tracing the sun's radio noise. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/taiyou-to-denpa.mp4); no caption strip. The print opens with a 1958 award card and an explanatory text card — every window is past them.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-taiyo-to-denpa-1956.mp4` (174 MB)

**`jp-kagakueizo-television-1952`**  
テレビジョン / Television (1952) — Tokyo, NHK 東京放送会館 (Uchisaiwaichō) and its TV studio before the first broadcast, JP.  
Source: <https://www.kagakueizo.org/movie/industrial/347/>  
Licence as found: no terms stated; NPO 科学映像館 free-distribution rescue print. 製作 日映科学映画製作所 / 協力 日本放送協会 (NHK). Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Japan 1952, ja narration, B&W, Nichiei Science Film with NHK's cooperation, made in the months before NHK's first TV broadcast (Feb 1953). Windows: a family round a table watching a set; a facsimile drum turning under a photocell, a portrait being scanned; the scanning demo — one line of light on a CRT, then line after line filling the raster; snow, then the iconoscope and its mosaic plate; the long window is the NHK broadcasting house and the studio, cameras rehearsing the NAKAGAWA TROUPERS children's act before there was a service; the control-room desk. Fetched from the site's own player host (150.videoplayer.jp/users-file/admin/html5/movie/0687/television.mp4); pre-cropped to drop the NPO caption strip ((株)日映科学映画製作所 / 科学映像館) burned across the top of every frame.  
Raw: `~/Media/zankyo-broadcast-src/jp-kagakueizo-television-1952.mp4` (110 MB) + `_crop/jp-kagakueizo-television-1952.mp4`


### Japan — NHK

**`jp-nhk-denshirikkoku-dentaku-1991`**  
NHKスペシャル 電子立国 日本の自叙伝 第4回「電卓戦争」 / The Electronic State: Japan's Autobiography, ep. 4 — The Calculator War (1991) — Tokyo, NHK (studio and 1991 location shooting); archive of Sharp, Osaka and Casio, Tokyo, JP.  
Source: <https://www.nicovideo.jp/watch/sm17985874>  
Licence as found: ユーザー投稿 on niconico of an NHK broadcast (1991); all rights reserved (NHK). Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Japan 1991, NHK broadcast, ja narration: the 1960s desk-calculator war between Sharp and Casio. Windows taken only from the archival and demonstration passages, never the studio conversation or the interviews: a floor paved with hundreds of calculators; 1960s B&W archive of an office and a hand-cranked mechanical calculator; a hand keying Casio's 14-A relay calculator and its relay bank; a lamp-board adder lighting 0 + 1; 1960s B&W office floors, then Prime Minister Ikeda announcing the Income-Doubling Plan (所得倍増計画) in newsreel; the long window is B&W archive of Sharp's engineers drawing and soldering the first transistor calculator's circuit boards. Fetched with yt-dlp from the niconico watch pages (360p HLS; sm17985874 + sm17986742 joined into one file); every window is in part 1.  
Raw: `~/Media/zankyo-broadcast-src/jp-nhk-denshirikkoku-dentaku-1991.mp4` (437 MB) + `_parts/jp-nhk-denshirikkoku-dentaku-1991/`

**`jp-nhk-denshirikkoku-transistor-1991`**  
NHKスペシャル 電子立国 日本の自叙伝 第2回「トランジスタの誕生」 / The Electronic State: Japan's Autobiography, ep. 2 — The Birth of the Transistor (1991) — Tokyo, NHK (studio demonstrations); archive of Bell Labs (US) and Japanese labs in Tokyo and Sendai, JP.  
Source: <https://www.nicovideo.jp/watch/sm17965313>  
Licence as found: ユーザー投稿 on niconico of an NHK broadcast (1991); all rights reserved (NHK). Copyrighted, fair-use posture → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Japan 1991, NHK broadcast, ja narration: how the transistor came from Bell Labs to Japan. Windows taken only from the archival and demonstration passages, never the studio conversation or the interviews: a replica of the 1947 point-contact transistor, the AT&T medallion and old telephone-line archive; the point-contact device rebuilt on the bench, two wires on a germanium crystal; a high-frequency oscillator coil glowing and the zone-refining (ゾーン・リファイニング) of germanium; a B&W photograph of a grown crystal, then a crystal puller loaded by gloved hands; B&W newsreel of the 1956 Nobel physics ceremony and Shockley; the long window is a studio demonstration board — N and P layers, a hand turning the bias and a bulb lighting through the junction transistor. Fetched with yt-dlp from the niconico watch pages (360p HLS; sm17965313 + sm17967188 joined into one file); every window is in part 1.  
Raw: `~/Media/zankyo-broadcast-src/jp-nhk-denshirikkoku-transistor-1991.mp4` (414 MB) + `_parts/jp-nhk-denshirikkoku-transistor-1991/`


### Japan — NFAJ silent prints

**`jp-nfaj-chikatetsu-1938`**  
地下鉃の出來るまで / How the Subway Was Made (1938) — Osaka, Midōsuji subway line (cut-and-cover works and stations), JP.  
Source: <https://filmisadocument.jp/films/view/218>  
Licence as found: 国立映画アーカイブ (NFAJ) portal 「フィルムは記録する」; site policy follows NFAJ's, footage reuse only by application (映像利用申請サイト / fiad@nfaj.go.jp). Copyrighted as found, fair-use posture → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 3.  
Japan 1938, Terada Eiga (テラダ映画) for the City of Osaka, silent, 18 fps, no sound track — a SILENT reel: the Midōsuji line built cut-and-cover. Windows: the original title, a subway car coming at us in its own headlight beam; the animated diagram of steel sheet piling (鋼矢板) driven beside the road surface; the pump diagram, water gushing from pipes, and carts under the timbered roof of the cut; the long window is the street opened up — barrows and labourers among the office blocks, the timbering, a section diagram, steam pile drivers watched by a crowd; a welder's torch flaring in the dark tunnel; a finished station, its vaulted hall and escalator under hanging lamps, then the crowds. Fetched from the NFAJ portal's own HLS (h10.cs.nii.ac.jp/stream/nfc/st167ac570bb1d07b546db73212728f6a4, 480×360); pre-cropped to drop the NFAJ corner bug. The first window starts after the portal's modern title card (0–19 s).  
Raw: `~/Media/zankyo-broadcast-src/jp-nfaj-chikatetsu-1938.mp4` (65 MB) + `_crop/jp-nfaj-chikatetsu-1938.mp4`

**`jp-nfaj-kokusan-hakurankai-1928`**  
大禮記念 国産振興東京博覽会 / Tokyo Exposition for the Promotion of Domestic Industry (1928) — Tokyo, Ueno Park (Tokyo Exposition for the Promotion of Domestic Industry), JP.  
Source: <https://filmisadocument.jp/films/view/159>  
Licence as found: 国立映画アーカイブ (NFAJ) portal 「フィルムは記録する」; site policy follows NFAJ's, footage reuse only by application (映像利用申請サイト / fiad@nfaj.go.jp). Copyrighted as found, fair-use posture → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 4.  
Japan 1928, silent record film (producer unknown), 16 fps, no sound track — a SILENT reel. The enthronement-commemoration industrial exposition in Ueno Park, March–May 1928. Windows: the exposition tower in an iris, opening onto the gate from above with crowds and trams; the long window is the funfair — crowds in coats and kimono, a swing ride of boats going up and down, a man turning to the camera; workmen on ladders painting a winged relief over a pavilion door and the 新天地 amusement hall; a pavilion mobbed at its doors and the long elevated promenade; the 樺太 (Karafuto) pavilion with its giant figure; a biplane's engine and struts inside the 國防館 defence hall. Fetched from the NFAJ portal's own HLS (h10.cs.nii.ac.jp/stream/nfc/st21191aeda3b5761ee3cb357679503bc8, 480×360); pre-cropped to drop the NFAJ corner bug.  
Raw: `~/Media/zankyo-broadcast-src/jp-nfaj-kokusan-hakurankai-1928.mp4` (97 MB) + `_crop/jp-nfaj-kokusan-hakurankai-1928.mp4`

**`jp-nfaj-kotsu-tsushin-1932`**  
交通.通信機関の今昔 / Transport and Communications, Then and Now (1932) — Japan (railways and mountain lines across the country; the communications half in Tokyo: trams, telephone, JOAK radio, phototelegraphy), JP.  
Source: <https://filmisadocument.jp/films/view/248>  
Licence as found: 国立映画アーカイブ (NFAJ) portal 「フィルムは記録する」; site policy follows NFAJ's, footage reuse only by application (映像利用申請サイト / fiad@nfaj.go.jp). Copyrighted as found, fair-use posture → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 4.  
Japan 1932, Taisho Cinema (大尚シネマ商會) silent education film, 18 fps, no sound track — a SILENT reel. Windows: the animated electrical 'Franklin' diagram, a whole grid of lamps lit in lines and wheels; Tokyo trams in the street and a crowd boarding one; a man walking to an office door, then a wireless operator in headphones at his key; a man at a wall telephone, receiver to his ear; the horn loudspeaker of the radio (その他ラヂオ) turning to face us and dissolving into a family listening with the paper; and the long window is 電送寫眞 — phototelegraphy: a portrait put on the drum 'at noon in Tokyo' by a pocket watch, the drum turning, an intertitle (僅か四分間の後には大阪で受信する事が出来る — four minutes later it is received in Osaka), the receiving machine, a wall clock at 12:04, hands lifting the exposed sheet. Fetched from the NFAJ portal's own HLS (h10.cs.nii.ac.jp/stream/nfc/stcd0b914553331fdcf139b379fb7d2ff7, 480×360); pre-cropped to drop the NFAJ corner bug.  
Raw: `~/Media/zankyo-broadcast-src/jp-nfaj-kotsu-tsushin-1932.mp4` (215 MB) + `_crop/jp-nfaj-kotsu-tsushin-1932.mp4`

**`jp-nfaj-toki-to-tokei-1934`**  
時と時計 / Time and Clocks (1934) — Tokyo (Seikosha works, Honjo; Oki Electric, Shibaura; Tokyo Astronomical Observatory, Mitaka), JP.  
Source: <https://filmisadocument.jp/films/view/15>  
Licence as found: 国立映画アーカイブ (NFAJ) portal 「フィルムは記録する」; site policy follows NFAJ's, footage reuse only by application (映像利用申請サイト / fiad@nfaj.go.jp). Copyrighted as found, fair-use posture → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 4.  
Japan 1934, Ministry of Education (文部省製作) silent education film, 18 fps, no sound track — a SILENT reel. Windows: racks of finished alarm clocks under three-day test at Seikosha, a worker among the crates; the animated 親時計/子時計 master-and-slave electric-clock circuit; the long window is Oki Electric's test room — walls of electric clocks marked 試験中, an intertitle (電氣時計 電燈線へ直接に接続する), then rows and rows of clock faces and their movements; the Tokyo Astronomical Observatory's transit instrument and the astronomer at the eyepiece fixing standard time; the animated diagram of the 時報 going out by wireless to ships, stations and homes; a pocket watch, a factory steam whistle and wristwatches set to the signal, then the announcer at the microphone. Fetched from the NFAJ portal's own HLS (h10.cs.nii.ac.jp/stream/nfc/stca01e7e61441cabfa47499ce97700def, 480×360); pre-cropped to drop the NFAJ corner bug. Every window is past the portal's modern disclaimer card at 0 s.  
Raw: `~/Media/zankyo-broadcast-src/jp-nfaj-toki-to-tokei-1934.mp4` (70 MB) + `_crop/jp-nfaj-toki-to-tokei-1934.mp4`

**`jp-nfaj-world-power-conference-1929`**  
萬國工業會議 世界動力會議 / World Engineering Congress, World Power Conference (1929) — Tokyo, Hibiya Public Hall and the delegates' garden visits (Kōrakuen), JP.  
Source: <https://filmisadocument.jp/films/view/7>  
Licence as found: 国立映画アーカイブ (NFAJ) portal 「フィルムは記録する」; site policy follows NFAJ's, footage reuse only by application (映像利用申請サイト / fiad@nfaj.go.jp). Copyrighted as found, fair-use posture → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 3.  
Japan 1929, Ministry of Education (文部省製作) silent record film, 18 fps, no sound track — a SILENT reel. The World Engineering Congress / World Power Conference sectional meeting, Tokyo, October–November 1929: 4,495 delegates, 1,285 from 42 countries. The long window: the hall's clock tower, the banner 萬國工業會議開會式場 WORLD ENGINEERING CONGRESS over umbrellas in the rain, an intertitle on delegates gathering from every country despite the autumn rain, handshakes at the car doors. Also: the delegates massed on the Hibiya Public Hall stage; a lecturer at his board and the sign GENERAL MEETING AND CLOSING CEREMONY W.E.C.; the packed hall from the balcony; the card for ギルブレス女史 — Lillian Gilbreth, the time-and-motion engineer — and her, laughing to camera in a garden; a WELCOME / WEC board at the 後楽園 visit. Fetched from the NFAJ portal's own HLS (h10.cs.nii.ac.jp/stream/nfc/st693f94cd4aaf5d93d6db6bf35ad1ccfa, 480×360); pre-cropped to drop the NFAJ corner bug.  
Raw: `~/Media/zankyo-broadcast-src/jp-nfaj-world-power-conference-1929.mp4` (38 MB) + `_crop/jp-nfaj-world-power-conference-1929.mp4`

**`jp-nfaj-yudo-danmaku-1925`**  
計算準備法ニヨル 誘導彈幕射擊 / Guided Barrage Fire by the Calculation-Preparation Method (1925) — Yotsukaidō, Chiba (Army Field Artillery School ranges, Shimoshizu plain), JP.  
Source: <https://filmisadocument.jp/films/view/96>  
Licence as found: 国立映画アーカイブ (NFAJ) portal 「フィルムは記録する」; site policy follows NFAJ's, footage reuse only by application (映像利用申請サイト / fiad@nfaj.go.jp). Copyrighted as found, fair-use posture → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 30 s; weight 3.  
Japan, November 1925, Army Field Artillery School, Yotsukaidō, with the Army Education Inspectorate and the Land Survey Department — a silent training film, 12 fps, no sound track: a SILENT reel. Windows: the animated 陣地占領要圖, white road-and-rail lines drawing themselves across a map beside the flying school; the long window is the aerial reconnaissance itself, the firing ground seen from an aeroplane with its wing strut in frame (the catalogue calls it among the earliest Japanese aerial film); the barrage map, an animated line of fire creeping forward to H+57 minutes; two gunners filling a meteorological pilot balloon on the grass and letting it rise; a ruled firing table (射擊諸元) held on screen; shells bursting on the plain among bare trees. Fetched from the NFAJ portal's own HLS (h10.cs.nii.ac.jp/stream/nfc/st1b012b3bd6351c5a8b79fd7e5cb763c7, 480×360); pre-cropped to drop the NFAJ corner bug.  
Raw: `~/Media/zankyo-broadcast-src/jp-nfaj-yudo-danmaku-1925.mp4` (166 MB) + `_crop/jp-nfaj-yudo-danmaku-1925.mp4`


### US forces in Vietnam — AFVN

**`us-much-afvn-quangtri-1970`**  
미군 방송 AFVN / AFVN Radio-TV, Quang Tri (US Army Signal Corps 111-LC-55583) (1970) — Quảng Trị, near the DMZ (AFVN Detachment 5, Channel II / 930 kHz), VN.  
Source: <https://archive.much.go.kr/archive/userrecordimage/recordImageView.do?idnbr=2023006551&jobdirSeq=1952>  
Licence as found: PD — US federal work (US Army Signal Corps, NARA 111-LC-55583); site's 저작권처 field names NARA → Tier A. Tone noise; **SILENT PRINT**; 7 windows, longest 38 s; weight 4.  
Vietnam, 11 April 1970: US Army Signal Corps colour footage of the American Forces Vietnam Network's Detachment 5 at Quảng Trị, near the DMZ; mute camera original (the archive lists 사운드: 없음; its track is only hiss) — a SILENT reel. Windows: the AFVN lettering on the roof and the wall sign MACV AFVN Radio·Television QUANGTRI CHANNEL II 930 KC; the long window is the tape room — a soldier at a reel-to-reel deck, hands threading and running the tape, the big reel turning; the second long window goes from a studio monitor with a face on its screen to the NEWS · AFVN RADIO TV · SPORTS desk and its anchors under the lights; the AFVN VIETNAM RADIO TV shield close; the radio DJ's turntable as he drops a record on it; the console's VU meter and faders under his hand; a soldier in the elephant grass tuning a transistor radio. Fetched from the site's own HLS (vod.much.go.kr, movieinfo.gm.jsp cid=6328, 720×480); pre-cropped to the right of frame to drop the NATIONAL ARCHIVES watermark, square-pixel 4:3. Camera slates (SEAPC 3A …) are avoided.  
Raw: `~/Media/zankyo-broadcast-src/us-much-afvn-quangtri-1970.mp4` (137 MB) + `_crop/us-much-afvn-quangtri-1970.mp4`


### Korea — Daehan News

**`kr-daehan-admin-computer-1970`**  
행정부에 전자계산기 등장 / An electronic computer appears in the administration (대한뉴스 제765호) (1970) — Seoul, 경제기획원 / 문화공보부, KR.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=658&mediadtl=5854>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 4 windows, longest 28 s; weight 4.  
Seoul, February 1970, Korean narration (대한뉴스 765호): the government's new large computer — operators at consoles and a line printer, a woman at the tape units, then the Economic Planning Board's budget director Kim Ju-nam interviewed in his own voice at his desk, the spinning tape reels and the machine's spec card between; then officials in a lecture hall learning to use it, a man at the blackboard, printouts passed along the rows. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-admin-computer-1970.mp4` (5 MB) + `_crop/kr-daehan-admin-computer-1970.mp4`

**`kr-daehan-apollo-first-report-1969`**  
사람이 달에 내리다 — 아폴로 11호 제1신 / Man lands on the Moon — Apollo 11, first report (대한뉴스 제736호) (1969) — Kennedy Space Center, Florida, and the Moon (NASA pictures; Korean narration recorded in Seoul), US.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=630&mediadtl=4513>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 6 windows, longest 28 s; weight 4.  
Apollo 11 as Korea's newsreel told it, July 1969, Korean narration over NASA pictures (대한뉴스 736호): the full moon over water; the Saturn V leaving the pad; the long window runs from the lunar module's descent through the ghostly live television of Armstrong on the ladder to the two astronauts at the LM; rock samples scooped; the ascent stage lifting off; the command module falling home through re-entry. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-apollo-first-report-1969.mp4` (30 MB) + `_crop/kr-daehan-apollo-first-report-1969.mp4`

**`kr-daehan-ballot-lots-1967`**  
7대 국회의원 선거 기호 추첨 / Drawing lots for ballot numbers, 7th National Assembly election (대한뉴스 제623호) (1967) — Seoul, 중앙선거관리위원회, KR.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=464&mediadtl=4281>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 4 windows, longest 28 s; weight 3.  
Seoul, May 1967, Korean narration (대한뉴스 623호): at the National Election Commission, party representatives under the newsreel lights take turns drawing slips from a box to fix their ballot numbers; the long window is the result read out — an official with the paper, then party names stacked up one by one on screen as the narrator counts them, 1 to 11, into the finished ballot chart. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-ballot-lots-1967.mp4` (5 MB) + `_crop/kr-daehan-ballot-lots-1967.mp4`

**`kr-daehan-expo-opens-1970`**  
만국 박람회 개막 / The World Exposition opens (대한뉴스 제768호) (1970) — Suita, Osaka — Expo '70 site, Korea pavilion, JP.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=661&mediadtl=5954>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 3 windows, longest 24 s; weight 3.  
Osaka, March 1970, Korean narration (대한뉴스 768호): Expo '70 opens — the Korea pavilion's forest of black pipes, crowds of Korean residents of Japan outside, the opening-ceremony orchestra and dignitaries, ambassador Lee Hu-rak cutting the tape, celadon and a bronze censer inside, a model of the new Korea; then fan dancers in crowns and farmers' music (nongak) with streaming hat-ribbons. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-expo-opens-1970.mp4` (9 MB) + `_crop/kr-daehan-expo-opens-1970.mp4`

**`kr-daehan-kist-robot-1980`**  
한국과학기술연구소, 로보트 개발 / KIST develops a robot (대한뉴스 제1277호) (1980) — Seoul, KIST (Hongneung), KR.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=10273&mediadtl=21471>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 3 windows, longest 26 s; weight 3.  
Seoul, February 1980, colour, Korean narration (대한뉴스 1277호): the Korea Institute of Science and Technology's industrial robot — a yellow arm with a red gripper lifting steel blanks, loading them into a lathe chuck; the lathe cutting, swarf flying; the control panel with its red digit readouts and X/Z counters; the turret tool; the arm working on alone. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-kist-robot-1980.mp4` (6 MB) + `_crop/kr-daehan-kist-robot-1980.mp4`

**`kr-daehan-lottery-draw-1962`**  
복권추첨 / Lottery draw (대한뉴스 제356호) (1962) — Seoul, 서울 사세청 (Seoul regional tax office), KR.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=239&mediadtl=1799>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 2 windows, longest 13 s; weight 3.  
Seoul, March 1962, Korean narration (대한뉴스 356호, the whole 25-second item): at the Seoul tax office the film actress Do Kum-bong draws the February theatre-ticket lottery out of a cloth bag while clerks crowd a table of tickets; then the winning-numbers board — 1st prize 200,000 hwan — is written up by hand, number by number. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-lottery-draw-1962.mp4` (3 MB) + `_crop/kr-daehan-lottery-draw-1962.mp4`

**`kr-daehan-school-lottery-1969`**  
중학교 무시험 추첨 / Middle-school no-exam lottery draw (대한뉴스 제712호) (1969) — Seoul, middle-school lottery halls, KR.  
Source: <https://www.ehistory.go.kr/view/movie?mediasrcgbn=KV&mediagbn=DH&mediaid=606&mediadtl=4021>  
Licence as found: 대한뉴스 (KTV 한국정책방송원) — no 공공누리 badge on the item page; use only by prior arrangement via KTV 나누리 → Tier B. Tone voice; 4 windows, longest 28 s; weight 4.  
Seoul, February 1969, Korean narration (대한뉴스 712호): the first year the middle-school entrance exam was replaced by a lottery. Children snowballing in a schoolyard under new apartment blocks; a crowd under the banner of the third drawing hall; numbered booths; a boy turns the wooden drum by hand (the 뺑뺑이) and a ball drops; his application form with its photo lies in a box; officials at the observers' table; a girl draws; the forms are stamped. fetched from e영상역사관 (ehistory.go.kr) via its WeNMediaPlayer file-info proxy → hdvod.ktv.go.kr 360P HLS; KTV's 16:9 transfer centre-cropped to 4:3.  
Raw: `~/Media/zankyo-broadcast-src/kr-daehan-school-lottery-1969.mp4` (14 MB) + `_crop/kr-daehan-school-lottery-1969.mp4`


### Spain — NO-DO

**`es-nodo-computadora-musical-1976`**  
Computadora musical: la evolución de la música programada en el Museo Van Gogh de Ámsterdam / Musical computer: the evolution of programmed music at the Van Gogh Museum, Amsterdam (1976) — Amsterdam, Van Gogh Museum, NL.  
Source: <https://www.rtve.es/play/videos/no-do/not-1729/1468689/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 5 windows, longest 38 s; weight 4.  
NO-DO NOT N 1729 A, 15/03/1976, item 3 of 5 (247-341 s of the 10:40 reel): an exhibition of programmed music at the Van Gogh Museum, Amsterdam, from pinned cylinder to computer — a music-box disc and a pinned brass drum turning (w1), a man winding an orchestrion, a carved figurehead, a piano roll unspooling above the keys (w2), the violin-playing machine and its paper roll and gears (w3), then a wall of patch cords, a technician at a console and a digital readout, a crowd listening, an old man in a hat at the microphones (long w4), and the gallery with its machines under the skylight (w5). Spanish narration over the machines' music. Spain/Spanish, shot in Amsterdam. Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-computadora-musical-1976.mp4` (65 MB) + `_crop/es-nodo-computadora-musical-1976.mp4`

**`es-nodo-croupiers-1981`**  
Croupiers: cómo se forman los árbitros de los juegos de azar en la Escuela de Formación Profesional de Barcelona / Croupiers: how the referees of games of chance are trained at the Barcelona vocational school (1981) — Barcelona, INEM vocational training centre, ES.  
Source: <https://www.rtve.es/play/videos/no-do/not-1959/1465513/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 7 windows, longest 36 s; weight 4.  
NO-DO NOT N 1959 A, 16/02/1981, item 2 of 3 (204-370 s of the 9:41 reel), in colour: the croupier course at the INEM vocational training centre in Barcelona — the centre's sign, then young men round a practice roulette table (w1), hands squaring stacks of chips as the instructor watches (w2), rakes drawing chips across the baize (w3); a trainee working odds on a blackboard, cards spread into a perfect arc and swept up, hands squaring a deck, blackjack dealt on a green table (long w4); a card shoe, a blonde trainee in a bow tie dealing (w5); a full practice table of dealers and players (w6); a roulette wheel spinning and the last table (w7). Spanish narration. Spain/Spanish, Barcelona. Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-croupiers-1981.mp4` (59 MB) + `_crop/es-nodo-croupiers-1981.mp4`

**`es-nodo-horoscopo-electronico-1969`**  
Horóscopo electrónico: los computadores al servicio de la astrología / Electronic horoscope: computers in the service of astrology (1969) — Spain (computer centre not named; likely Madrid), ES.  
Source: <https://www.rtve.es/play/videos/no-do/not-1408/1487066/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 5 windows, longest 36 s; weight 4.  
NO-DO NOT N 1408 A, 29/12/1969, item 5 of 6 (382-493 s of the 11:05 reel): astrology handed to a computer — Assyrian reliefs (w1), the Sphinx, Egyptian wall paintings and the step pyramid (w2), newspaper horoscope columns and the word HORÓSCOPO, then an office tower's glass grid (w3); disk packs spinning under their lids, a machine room of operators and consoles, tape drives, lamp panels, an IBM keyboard and fanfold printout spilling from the printer (long w4); a radio studio where a woman reads the forecast into the microphone and a man reads his printout and smiles (w5). Spanish narration. Spain/Spanish. Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-horoscopo-electronico-1969.mp4` (67 MB) + `_crop/es-nodo-horoscopo-electronico-1969.mp4`

**`es-nodo-nino-computadoras-1981`**  
El niño, entre el ayer y el mañana: cómo incorporar a la juventud a la civilización de las computadoras / The child between yesterday and tomorrow: bringing the young into the civilisation of computers (1981) — Spain (exhibition venue not named; likely Madrid), ES.  
Source: <https://www.rtve.es/play/videos/no-do/not-1959/1465513/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 6 windows, longest 38 s; weight 4.  
NO-DO NOT N 1959 A, 16/02/1981 — one of the last NO-DO issues, in colour — item 1 of 3 (10-203 s of the 9:41 reel): an exhibition for children that runs from the hand to the screen — children kneading clay (w1), clay pots and girls at hand looms (w2), children at school desks and toddlers with toy trucks and a toy telephone (w3), pictograms, a Ptolemy/Cleopatra cartouche, the Roman alphabet and antique telephones (w4); then a videophone, a videotex INDICE menu, an airliner seat map on a teletext screen, a girl with a remote at a terminal and two boys at a computer (long w5); boys typing and a screen of blue text (w6). Spanish narration. Spain/Spanish; location not stated (Madrid likely). Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-nino-computadoras-1981.mp4` (59 MB) + `_crop/es-nodo-nino-computadoras-1981.mp4`

**`es-nodo-robots-dodecafonica-1965`**  
Robots y música dodecafónica: los berlineses se divierten / Robots and twelve-tone music: Berliners amuse themselves (1965) — West Berlin, DE.  
Source: <https://www.rtve.es/play/videos/no-do/not-1176/1476038/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 4 windows, longest 38 s; weight 4.  
NO-DO NOT N 1176 B, 19/07/1965, item 4 of 8 (240-324 s of the 9:35 reel): a Berlin street happening — a crowd presses round a foil-headed robot on wheels driven from a suitcase control box (w1-w2), a cellist on the pavement and hands on the paving stones (w3), then indoors a woman bows a cello while another is bowed across a bare-backed man, with electronics and a lamp-headed machine among them and listeners' faces between (long w4) — to all appearances Nam June Paik's Robot K-456 and Charlotte Moorman, though NO-DO names no one. Spanish narration over the performance sound. Spain/Spanish, shot in West Berlin. Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-robots-dodecafonica-1965.mp4` (58 MB) + `_crop/es-nodo-robots-dodecafonica-1965.mp4`

**`es-nodo-sintetizador-1973`**  
Sintetizador electrónico: máquina con poder de percepción para captar sonidos inaudibles para el oído humano / Electronic synthesizer: a machine that perceives sounds inaudible to the human ear (1973) — Spain (studio location not stated), ES.  
Source: <https://www.rtve.es/play/videos/no-do/not-1599/1469523/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 6 windows, longest 38 s; weight 4.  
NO-DO NOT N 1599 A, 27/08/1973, item 5 of 6 (369-499 s of the 11:19 reel): a studio synthesiser — a hand with a cigarette, a man at a wall of patch-pin panels, a spectrum display whose single line breaks into a row of dots, a close face, fingers on the pins (long w1); tape reels turning, the operator smiling, smoking, a boy watching (w2); knob panels and a hand turning them (w3); fingers on a small keyboard, then a gull in flight (w4); hens pecking and a boy holding one, a tape reel and the display now peaking with the sound (w5); children in a sunlit garden and a balcony (w6). Spanish narration over electronic sound. Spain/Spanish; shooting location not stated. Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-sintetizador-1973.mp4` (68 MB) + `_crop/es-nodo-sintetizador-1973.mp4`

**`es-nodo-zorita-1965`**  
La primera central nuclear de España: se inicia su construcción en Zorita, Guadalajara / Spain's first nuclear power station: construction begins at Zorita (1965) — Zorita de los Canes, Guadalajara — José Cabrera nuclear plant site, ES.  
Source: <https://www.rtve.es/play/videos/no-do/not-1176/1476038/>  
Licence as found: unknown — NO-DO, Spanish state newsreel; no licence statement on rtve.es → Tier A. Tone voice; 3 windows, longest 26 s; weight 3.  
NO-DO NOT N 1176 B, 19/07/1965, item 2 of 8 (134-185 s of the 9:35 reel): the start of work on the José Cabrera plant at Zorita, Guadalajara — a site plan, an artist's drawing of the reactor dome, the white architect's model turning under the lights, flags over the bare hillside and the parked official cars (long w1); the ceremony under an awning, a minister at the microphones (w2); a plunger pressed and a dynamite charge throwing up the first earth, smoke drifting across the empty site (w3). Spanish narration. Spain/Spanish. Fetched with yt-dlp (rtve.es:alacarta, hls-845); cut from a pre-crop (crop=406:320:130:72) that removes the rtve.es and Filmoteca Española bugs.  
Raw: `~/Media/zankyo-broadcast-src/es-nodo-zorita-1965.mp4` (58 MB) + `_crop/es-nodo-zorita-1965.mp4`


### France — Ciclic and Cinémémoire

**`fr-ciclic-circuit-electronique-1990`**  
Circuit électronique / Electronic circuit (1990) — Bourges, Maison de la Culture scenery workshop, FR.  
Source: <https://memoire.ciclic.fr/4077-circuit-electronique>  
Licence as found: Droits réservés — produced by the video workshop of the Maison de la Culture de Bourges; Ciclic Mémoire → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 28 s; weight 3.  
France, Bourges, c. 1990, Umatic colour; the print is effectively MUTE (the sound track is a blank floor at about -60 LUFS), so the reel is silent. A bearded man at a bench in the Maison de la Culture's scenery workshop wires a board of green and red LEDs by hand: a magnifier lamp over the LED row; the soldering iron at a capacitor; LONG — an analogue multimeter's needle, a meter box, the board, then the issue of 'Électronique pratique' (un télérupteur optique) he is building from; an oscilloscope's knobs and the man bent to his work; his wristwatch and the meter again; last, the finished chassis turned in his hands. Fetched from Ciclic Mémoire's HLS (embed 9410); the circuit film is the second sequence of that deposit, 10:54 onward — the first 11 minutes are a different clown-theatre rehearsal, never used.  
Raw: `~/Media/zankyo-broadcast-src/fr-ciclic-circuit-electronique-1990.mp4` (88 MB) + `_parts/fr-ciclic-circuit-electronique-1990/`

**`fr-ciclic-nancay-cigar-antennas-1970`**  
Antennes cigares à la station de radioastronomie de Nançay (1/2) / 'Cigar' antennas at the Nançay radio astronomy station (1970) — Nançay (Cher), Station de radioastronomie, FR.  
Source: <https://memoire.ciclic.fr/12602-antennes-cigares-a-la-station-de-radioastronomie-de-nancay-1-2>  
Licence as found: Deposit of Christian Couteret at Ciclic Mémoire; rights held by the depositor, no open licence → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 28 s; weight 4.  
France (Nançay, Cher), c. 1970, Super 8 colour, SILENT — shot by the station's own engineer Christian Couteret. Windows: a handwritten sheet, 'Réalisation d'une série de 16 antennes cigares à 169 MHz', then a drill press biting into small brass parts; the line of radioheliograph dishes on the site; a man at a drawing board and the wiring plan of the 16 antennas; a cutting torch throwing sparks along a steel bar; a hexagonal mesh frame lifted on trestles; LONG — winter: the cable reels in the snow, an antenna section loaded into a white Peugeot 404 estate, men at a tented mast in the snow. Fetched from Ciclic Mémoire's HLS (embed 22180); pre-cropped to take off the pillarbox bars.  
Raw: `~/Media/zankyo-broadcast-src/fr-ciclic-nancay-cigar-antennas-1970.mp4` (52 MB) + `_crop/fr-ciclic-nancay-cigar-antennas-1970.mp4`

**`fr-ciclic-nancay-construction-1952`**  
Construction de la station de Radioastronomie de Nançay / Building the Nançay radio astronomy station (1952) — Nançay (Cher), the future radio astronomy station site in the Sologne — with scenes in Paris and Orléans, FR.  
Source: <https://memoire.ciclic.fr/11735-construction-de-la-station-de-radioastronomie-de-nancay>  
Licence as found: Deposit of Jean-Louis Steinberg at Ciclic Mémoire; rights held by the depositor, no open licence → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 28 s; weight 4.  
France (Sologne / Paris / Orléans), 1952, 16 mm black and white, SILENT rushes shot by Jean-Louis Steinberg, founder of French radio astronomy. Windows: men in overcoats reading a map on the bonnet of a car on a birch-lined road, scouting the land; a car through the centre of Nançay from the Vierzon road; a crawler bulldozer clearing the pine wood for the station; the first masonry, a cement mixer, a woman in a headscarf on the site; LONG — the physics laboratory (Observatoire de Paris / ENS): a researcher pins up a sheet, an oscilloscope holds a pulse-shaped trace, then the sun blazing through bare branches; driving into Orléans past the Place du Martroi and Joan of Arc's statue. Fetched from Ciclic Mémoire's HLS (embed 20377); pre-cropped to take off the pillarbox bars.  
Raw: `~/Media/zankyo-broadcast-src/fr-ciclic-nancay-construction-1952.mp4` (42 MB) + `_crop/fr-ciclic-nancay-construction-1952.mp4`

**`fr-ciclic-trajectoire-robots-1988`**  
Trajectoire : la robotisation des industries / Trajectory: the robotisation of industry (1988) — Région Centre — Châteauroux, Tours, Blois, Chartres, Nogent-sur-Vernisson factories, FR.  
Source: <https://memoire.ciclic.fr/8512-trajectoire-la-robotisation-des-industries>  
Licence as found: Droits réservés — deposit of the Union des entreprises de l'Indre, Ciclic Mémoire; no open licence → Tier B. Tone voice; 6 windows, longest 28 s; weight 3.  
France (Centre-Val de Loire), French, 1988: a regional industrial TV magazine on Umatic SP, the print marked 'film très abîmé' by the archive. Windows: the hand-drawn 'Trajectoires' title over a grid horizon and a warped glass building; a green-line CAD plan on a monitor (40-1, 40-2); Bernadette Dominguez, robot operator at Tubauto, on how her job changed; LONG — the Nouvelle République press room in Tours, the claviste Gérard Sarthon at a terminal, green 'ENTREE DE TEXTE' on screen, hands on the keyboard, page proofs; the Flonic Schlumberger foundry robots at Châteauroux handling castings; a Paco Rabanne rotary bottling line. Fetched from Ciclic Mémoire's HLS (memoire.ciclic.fr embed 5310).  
Raw: `~/Media/zankyo-broadcast-src/fr-ciclic-trajectoire-robots-1988.mp4` (50 MB) + `_parts/fr-ciclic-trajectoire-robots-1988/`

**`fr-cinememoire-expo58-bruxelles-1958`**  
Vérone — Milan — Exposition universelle de Bruxelles en 1958 — Lyon / Verona, Milan, the 1958 Brussels World's Fair, Lyon (1958) — Brussels, Heysel — Expo 58, BE.  
Source: <https://cinememoire.net/notice?num_seq=3038>  
Licence as found: Cinémémoire.net archive, anonymous amateur film; all rights reserved → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 28 s; weight 4.  
Belgium (Brussels, Heysel), August 1958, a French family's SILENT colour amateur film of Expo 58. Windows: their own hand-lettered card 'Exposition de Bruxelles — Août 1958', then the Atomium's spheres; LONG — the France pavilion's sign, the fountains, the pavilions' flags and glass, a dark hall, the Atomium's struts; inside the Atomium, reversed lettering on the window glass and the tubes and spheres outside; the cable car gliding over the pavilions above the crowd; a man dressed as a bear and the giant snoring clown; the Cinérama theatre sign and the Atomium again. Fetched as the direct MP4 in cinememoire.net's newvideositemap.xml; pre-cropped to take off the burned-in www.cinememoire.net watermark. The Verona, Milan and Lyon (May 1958) reels of the same film are not used.  
Raw: `~/Media/zankyo-broadcast-src/fr-cinememoire-expo58-bruxelles-1958.mp4` (13 MB) + `_crop/fr-cinememoire-expo58-bruxelles-1958.mp4`

**`fr-cinememoire-mururoa-tir-1960s`**  
Mururoa : Tir + Préparatifs / Mururoa: the shot, and the preparations (1966) — Mururoa atoll, Tuamotu (French nuclear test site), PF.  
Source: <https://cinememoire.net/notice?num_seq=18299>  
Licence as found: Cinémémoire.net archive, anonymous amateur film; all rights reserved → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 26 s; weight 4.  
French Polynesia (Mururoa atoll), late 1960s (catalogue: 'années 60'; the atmospheric tests there began in July 1966), SILENT colour amateur film shot by someone serving with the test fleet. Windows: a yellow airship tethered inside a scaffold on its pad; navy ships moored off the atoll, hull number A637; a helicopter crossing a pale sky; a lattice radar antenna, then the atoll's shore with its tower seen from the sea; a sounding balloon drifting up, then the steel shot tower on its platform; LONG — men at the rail of a ship's deck under a heavy sky, the nuclear test as a flash of light low on the horizon, the glow fading into cloud, and grey waves. Fetched as the direct MP4 in cinememoire.net's newvideositemap.xml; pre-cropped to take off the burned-in www.cinememoire.net watermark.  
Raw: `~/Media/zankyo-broadcast-src/fr-cinememoire-mururoa-tir-1960s.mp4` (14 MB) + `_crop/fr-cinememoire-mururoa-tir-1960s.mp4`

**`fr-cinememoire-nancay-jardin-1960s`**  
Nançay + Jardin / Nançay and the garden (1965) — Nançay (Cher), Station de radioastronomie, FR.  
Source: <https://cinememoire.net/notice?num_seq=13100>  
Licence as found: Cinémémoire.net archive, anonymous amateur film; all rights reserved → Tier B. Tone noise; **SILENT PRINT**; 4 windows, longest 28 s; weight 3.  
France (Nançay, Cher), 1960s (catalogue: 'années 60'), a family's SILENT colour amateur film — the file carries a blank sound track. Windows: two little girls climbing a pine; LONG — the visitors' car park, then the camera drifts off the children onto the great radio telescope's curved mesh reflector wall, the girls on their mother's shoulders beside a Citroën DS, a mesh dish in close-up and the row of dishes over the trees; the line of radioheliograph antennas, then a back garden with a pushchair and a bicycle; the girl turning to the camera and her father in sunglasses. Fetched as the direct MP4 in cinememoire.net's newvideositemap.xml; pre-cropped to take off the burned-in www.cinememoire.net watermark.  
Raw: `~/Media/zankyo-broadcast-src/fr-cinememoire-nancay-jardin-1960s.mp4` (18 MB) + `_crop/fr-cinememoire-nancay-jardin-1960s.mp4`

**`fr-cinememoire-post-atomiques-1982`**  
Chronique des temps post-atomiques — Acte I : Mort au futur simple / Chronicle of post-atomic times, Act I: Death in the simple future (1982) — Istres and the Fos–Martigues shore (Bouches-du-Rhône), FR.  
Source: <https://cinememoire.net/notice?num_seq=13702>  
Licence as found: Cinémémoire.net archive, amateur production (G.E.P.I. cinéma d'Istres, Michel Sciara); all rights reserved → Tier B. Tone music; 6 windows, longest 10 s; weight 3.  
France (Istres / the Fos–Martigues shore, Bouches-du-Rhône), 1982, French amateur fiction by a cine-club with a continuous post-synchronised soundtrack (music and effects, so every window is 10 s and pre-distorted). Windows: the typed title card 'Le G.E.P.I. cinéma d'Istres présente'; the warning card — 'each inhabitant of the planet has four tonnes of explosive suspended over their head'; a mushroom cloud rising behind the tower blocks above the bay and a little girl's face frozen in terror; a young man in a white shirt picking through a fog of rubble and rebar; a silhouette against the rebar; the child's face with the cloud superimposed, then 'A suivre…' — a sequel that may never have come. Fetched as the direct MP4 in cinememoire.net's newvideositemap.xml; pre-cropped to take off the burned-in www.cinememoire.net watermark.  
Raw: `~/Media/zankyo-broadcast-src/fr-cinememoire-post-atomiques-1982.mp4` (100 MB) + `_crop/fr-cinememoire-post-atomiques-1982.mp4`


### Galicia — TVG

**`gl-crtvg-cabo-vilan-xerador-1989`**  
Transporte dun xerador para o parque eólico de Cabo Vilán / Hauling a generator to the Cabo Vilán wind farm (1989) — A Coruña city streets (convoy bound for Cabo Vilán, Camariñas), ES.  
Source: <https://pasouoquepasou.crtvg.gal/content/transporte-dun-xerador-para-o-parque-eolico-de-cabo-vilan>  
Licence as found: CRTVG (TVG) archive, Pasou o que pasou; no open licence shown → Tier B. Tone voice; 6 windows, longest 28 s; weight 3.  
Spain (Galicia — A Coruña's streets, bound for Cabo Vilán, Camariñas), 25 August 1989, TVG news item in Galician: a Unión Fenosa wind-turbine nacelle for the future Cabo Vilán wind farm crosses the city 'before the neighbours' astonishment'. Windows: LONG — the huge cream pod on a yellow Pegaso low-loader creeping through traffic behind a police car, past a Bingo sign; the pod gliding under trees and windows; linemen in a cherry-picker lifting a street lamp out of its way; the crowd around the convoy and a 'Centro de Transformaciones Metálicas' van; workers at the lamp arm with a torch glowing; onlookers packed on a footbridge as it passes under. Fetched from the .m3u8 in the pasouoquepasou.crtvg.gal page (Flumotion HLS, 360p); pre-cropped to take off the TVG corner bug.  
Raw: `~/Media/zankyo-broadcast-src/gl-crtvg-cabo-vilan-xerador-1989.mp4` (19 MB) + `_crop/gl-crtvg-cabo-vilan-xerador-1989.mp4`

**`gl-crtvg-edicios-do-castro-1986`**  
Talleres da editorial Ediciós do Castro en 1986 / The workshops of the Ediciós do Castro press, 1986 (1986) — Sada (A Coruña), Ediciós do Castro printworks, ES.  
Source: <https://pasouoquepasou.crtvg.gal/content/talleres-da-editorial-edicios-do-castro-en-1986>  
Licence as found: CRTVG (TVG) archive, Pasou o que pasou; no open licence shown → Tier B. Tone voice; 6 windows, longest 26 s; weight 3.  
Spain (Galicia — the Ediciós do Castro works at Sada, A Coruña), 1 November 1986, TVG news item in Galician on a traditional printworks whose trades were 'disappearing with the new technologies'. Windows: a compositor's hands picking type from the case; LONG — a linotypist at the keyboard, the matrices dropping, the hot-metal slug cast, then the make-up room; the process camera's lit copyboard; a press's rollers turning and sheets riding the delivery; hands feeding sheets into a platen press; the finished yellow-covered books stacked. Fetched from the .m3u8 in the pasouoquepasou.crtvg.gal page (Flumotion HLS, 360p); pre-cropped to 4:3 to take off the TVG corner bug.  
Raw: `~/Media/zankyo-broadcast-src/gl-crtvg-edicios-do-castro-1986.mp4` (20 MB) + `_crop/gl-crtvg-edicios-do-castro-1986.mp4`

**`gl-crtvg-lotaria-nadal-coruna-1994`**  
Venda de lotaría de Nadal na Coruña en 1994 / Selling Christmas lottery tickets in A Coruña, 1994 (1994) — A Coruña, Administración de Loterías Nº 5 'La Favorita', ES.  
Source: <https://pasouoquepasou.crtvg.gal/content/venda-de-lotaria-de-nadal-na-coruna-en-1994>  
Licence as found: CRTVG (TVG) archive, Pasou o que pasou; no open licence shown → Tier B. Tone voice; 4 windows, longest 17 s; weight 3.  
Spain (Galicia — A Coruña, Administración de Loterías Nº 5 'La Favorita'), 13 December 1994, TVG news item in Galician on buying décimos for the Christmas draw. Windows: the 'Lotería La Favorita Admón Nº 5' signs and the queue under them; the counter clerk counting notes, sheets of green décimos fanned on the counter; tickets passed under the glass, a man's hands checking his number, a drawer of tickets; LONG — the crowd pressing at the booth window and the queue stretching down the street. Fetched from the .m3u8 in the pasouoquepasou.crtvg.gal page (Flumotion HLS, 360p); pre-cropped to 4:3 to take off the TVG corner bug.  
Raw: `~/Media/zankyo-broadcast-src/gl-crtvg-lotaria-nadal-coruna-1994.mp4` (9 MB) + `_crop/gl-crtvg-lotaria-nadal-coruna-1994.mp4`


### Türkiye — state film heritage

**`tr-barajlar-1956`**  
Barajlar / Dams (1956) — Sakarya river dams (Sarıyar dam opening most likely), Türkiye, TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/barajlar>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-4622); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Türkiye, Turkish, 1956: a Basın-Yayın-Turizm film on the dams the state was building, under a Turkish narrator — a river in spate and people standing at a waterfall; a huge crowd and a speaker at a podium under the banner 'İkinci Sakarya Zaferimiz Kutlu Olsun' (most likely the opening of the Sarıyar dam on the Sakarya); the control desk, the spillway and the turbine shaft; a transformer yard, a generator and a man turning a switch at the panel; the long window runs from the spillway and a penstock pipe through a switchyard, a repair workshop and the big transformers; a town lit up at night, minarets and a Ferris wheel in lights. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=642:476:114:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-barajlar-1956.mp4` (74 MB) + `_crop/tr-barajlar-1956.mp4`

**`tr-britanya-sehircilik-1947`**  
Britanya Şehircilik Sergisi / The British Town-Planning Exhibition (1947) — Ankara (British town-planning exhibition visited by İsmet İnönü), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/britanya-sehircilik-sergisi>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-1194); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Türkiye (Ankara), Turkish, 1947: a Basın-Yayın newsreel of the British town-planning exhibition that İsmet İnönü visited, under a Turkish narrator — İnönü and officials arriving among the stands; display screens of British plans and photographs; the long window pans the architect's models, a stadium and a colonnaded civic building under the lights, with visitors bending over them; a regional road-plan model and a crowd round a plan board; a model of the new town's circular neighbourhoods, trees and motorway junctions; a tower-block model under glass. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=650:476:102:2). The ministry's large rosette watermark is burned in over the whole picture and is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-britanya-sehircilik-1947.mp4` (37 MB) + `_crop/tr-britanya-sehircilik-1947.mp4`

**`tr-catalagzi-santrali-1956`**  
Çatalağzı Elektrik Santrali İkinci Kısım Açılış Töreni / Opening of the Second Stage of the Çatalağzı Power Station (1956) — Çatalağzı power station, Zonguldak, TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/atalaz-elektrik-santrali-ikinci-ksm-al-treni>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-4830); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 25 s; weight 3.  
Türkiye (Çatalağzı, Zonguldak), 1956, SILENT PRINT (the file has no sound track): the coal-fired power station's second stage opened — the long window walks the turbine hall, holds on a big pressure gauge and ends on the control-room walls of dials and switches; crowds and a steam train at the station; a locomotive blowing off steam beside the plant; an official speaking into a microphone on the steps; the coal conveyors inside, lit from the roof; village women in headscarves watching. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=662:476:110:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-catalagzi-santrali-1956.mp4` (38 MB) + `_crop/tr-catalagzi-santrali-1956.mp4`

**`tr-eregli-demir-celik-1960s`**  
Bir Görüş Bir Gerçek: Ereğli Demir Çelik Tesisleri / One View, One Reality: the Ereğli Iron and Steel Works (1968) — Karadeniz Ereğli (Ereğli Demir Çelik works), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/bir-gr-bir-gerek-ereli-demir-elik-tesisleri>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-4165); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Türkiye (Karadeniz Ereğli), Turkish, undated (the works opened in 1965; late 1960s by content; year is an estimate): the history and working of the Ereğli iron and steel works, under a Turkish narrator — an animated map closing from Europe onto the Black Sea coast and Ereğli; a skyscraper, a shelf of engineering volumes and draughtsmen at their boards; a crane lowering concrete tetrapods into the harbour breakwater; smoke boiling from the coke ovens; the long window goes into the blast furnace and melt shop — a white-hot tap, the furnace mouth glowing, a converter pouring; the rolling mill, slabs running on the rollers. The transfer is pale and washed out. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=642:476:112:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-eregli-demir-celik-1960s.mp4` (140 MB) + `_crop/tr-eregli-demir-celik-1960s.mp4`

**`tr-istatistik-50-yil-1973`**  
Cumhuriyetin 50'nci Yılında İstatistiki Veriler / Statistical Data in the Republic's 50th Year (1973) — Ankara (Devlet İstatistik Enstitüsü building and library), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/istatistik>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-2315); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 25 s; weight 3.  
Türkiye, 1973, SILENT PRINT (the file has no sound track): a film for the Republic's fiftieth anniversary about looking up the numbers — a schoolgirl at a blackboard reading 'EV ÖDEVİ: Cumhuriyetin 50 yıllık ...' (homework: the Republic's fifty years); the Başbakanlık Devlet İstatistik Enstitüsü signboard and building in Ankara; children in the institute's library; a girl pulling statistical yearbooks off the shelves; the long window is 25 s of a pupil's hands copying tables of figures into an exercise book; a girl at her desk, chin in hand. The picture is dim and flat as transferred. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); no crop needed (the file is already 4:3). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-istatistik-50-yil-1973.mp4` (11 MB)

**`tr-nato-goklerde-1960s`**  
NATO Göklerde / NATO in the Skies (1962) — NATO Information Service, Paris (air-traffic footage from several NATO countries), FR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/nato-gklerde-0>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-4050); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
NATO Information Service (Paris) film with Turkish narration, undated (before NATO left Paris in 1967; year is an estimate): air-traffic control across the alliance — radar controllers in headsets at consoles, one turning a plotting dial on a scope; the long window moves from a control tower and a controller at his desk to the flight-plot table of aircraft markers, the flight-progress board and men working the plot; an animated diagram of radio beacons and stacked airways; pilots and controllers talking into microphones; a radar aerial on its tower, then a radar screen with its sweeping trace and technicians at the scope; runway approach lights at night and a landing. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=654:476:98:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-nato-goklerde-1960s.mp4` (66 MB) + `_crop/tr-nato-goklerde-1960s.mp4`

**`tr-orta-anadolu-rafinerisi-1976`**  
Orta Anadolu Rafinerisi / The Central Anatolia Refinery (1976) — Hacılar, Kırıkkale (Orta Anadolu Rafinerisi foundation ceremony), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/orta-anadolu-rafinerisi>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-3075); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 3.  
Türkiye, Turkish, 1976: an AS Ajans colour newsreel (faded to cyan) for Türkiye Petrolleri — the foundation-stone ceremony of the Central Anatolia Refinery at Hacılar, Kırıkkale, with Prime Minister Süleyman Demirel on 6 October 1976, and other oil works — nodding-donkey oil pumps on a hillside; a drilling derrick, a flare stack and a refinery's columns; Demirel at the microphones and the crowd; Demirel again, gesturing, and the villagers listening; rain on a canal, then the officials' table; the long window is a computer centre (apparently Türkiye Petrolleri's) — the office block, a console keyboard, a tape cabinet, rows of reel-to-reel tape drives with an operator, and a man at his desk. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=688:476:84:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-orta-anadolu-rafinerisi-1976.mp4` (156 MB) + `_crop/tr-orta-anadolu-rafinerisi-1976.mp4`

**`tr-ptt-calismalari-1970s`**  
PTT'nin Çalışmaları / The Work of the PTT (1972) — Türkiye (PTT exchanges and offices; Ankara likely, not stated), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/pttnin-almalar>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-3632); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Türkiye, Turkish, undated (1970s by dress and equipment; year is an estimate): the Posta Telgraf Telefon administration films its own network under a Turkish narrator — a man on the telephone at his desk; a long hall of switchboard operators in headsets; the automatic exchange's relay racks and a technician at a test desk; the long window runs from a control console into an animated diagram of a communications satellite orbiting the globe and back to an engineer at the equipment racks; the exchange clock and a rack of selectors; switchboard women and a microwave-link control room with round meters. Basın-Yayın Genel Müdürlüğü production. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked grey pillarbox (crop=662:476:104:2). The ministry's rosette watermark is left in, faint in the centre.  
Raw: `~/Media/zankyo-broadcast-src/tr-ptt-calismalari-1970s.mp4` (49 MB) + `_crop/tr-ptt-calismalari-1970s.mp4`

**`tr-senfoni-orkestrasi-1959`**  
Cumhurbaşkanlığı Senfoni Orkestrası / The Presidential Symphony Orchestra (1959) — Türkiye (Presidential Symphony Orchestra's 1959 army-garrison tour; towns not named), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/cumhurbakanl-senfoni-orkestras>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-3482); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone noise; **SILENT PRINT**; 6 windows, longest 10 s; weight 3.  
Türkiye, 1959, SILENT PRINT (the archive lists it Sessiz; the file's audio track is blank at -91 dB, so it is cut --silent): the Presidential Symphony Orchestra on its 1959 'Ordu ve Bölge Konserleri' tour under the conductor Hikmet Şimşek, playing in the open air to garrison towns — an orchestra seen from above with a crowd of soldiers and townspeople behind; two cellists; a soloist standing before the audience; violins over the music stands; Şimşek on the podium; the rows of seats and the front table of officers; Şimşek conducting close to camera at dusk. An orchestra with its sound already lost; cut as music (windows of 10 s, --distort 0.5) although nothing is heard. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=640:476:110:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-senfoni-orkestrasi-1959.mp4` (49 MB) + `_crop/tr-senfoni-orkestrasi-1959.mp4`

**`tr-sivil-savunma-siginak-1960s`**  
Sivil Savunma: Ev ve Apartmanlarda Sığınak Yeri Hazırlama / Civil Defence: Preparing a Shelter in Houses and Flats (1968) — Türkiye (İçişleri Bakanlığı Sivil Savunma film; Ankara likely, not stated), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/sivil-savunma-ev-ve-apartmanlarda-snak-yeri-hazrlama>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-3353); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 4.  
Türkiye, Turkish, undated (the Sivil Savunma İdaresi series of SGM-3354, the alarm film, dated 1968; year is an estimate): Turkey's own duck-and-cover, room by room, in a calm instructional voice — a man clearing a cellar corner and fixing a shelf; a man marking up the wall of the shelter room; a mother at the sink and a little girl at the water can and the chemical toilet; the family making up the bunk beds and hanging a storm lantern; the long window runs from a girl on the bed through an animated cut-away of a block of flats to the blast flash whitening the street; the rooftop siren horn, then a man digging and roofing a trench shelter in open ground. Credits: İçişleri Bakanlığı Sivil Savunma (Genel) Başkanlığı sunar. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=648:476:116:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-sivil-savunma-siginak-1960s.mp4` (27 MB) + `_crop/tr-sivil-savunma-siginak-1960s.mp4`

**`tr-su-dost-dusman-1970s`**  
Su: Hem Dost Hem Düşman / Water: Both Friend and Enemy (1974) — Türkiye (a zoo, kitchens and a village well; Ankara likely, not stated), TR.  
Source: <https://filmmirasim.ktb.gov.tr/tr/film/su--hem-dost--hem-dusman>  
Licence as found: T.C. Kültür ve Turizm Bakanlığı film archive (SGM-2471); all rights reserved on the site footer, use governed by the ministry's Süreli Kullanım Yönergesi (request form) → Tier B. Tone voice; 6 windows, longest 30 s; weight 3.  
Türkiye, Turkish, undated (1970s by dress and cars; year is an estimate): a Basın-Yayın Genel Müdürlüğü hygiene film, a calm Turkish narrator over a zoo, a kitchen and a village well — a young woman laughing under the giraffes; a market crowd; a woman in her hallway at the coat rack; a woman in glasses washing greens and cooking at the stove; the long window is an animated cut-away of a well being lined, white on black, then a man cranking a hand-wound well winch and the well-house; a woman walking the zoo's paths. The sound track runs quiet and has long unscored gaps elsewhere. Fetched from the page's 480p HLS manifest (filmmirasim.ktb.gov.tr:8443/WEBTV/...playlist.m3u8); pre-cropped to remove the baked pillarbox (crop=670:476:98:2). The ministry's rosette watermark is left in.  
Raw: `~/Media/zankyo-broadcast-src/tr-su-dost-dusman-1970s.mp4` (79 MB) + `_crop/tr-su-dost-dusman-1970s.mp4`


### Czechoslovakia — ČST via oldradio.cz

**`cz-oldradio-naddopis-1985`**  
Nad dopisy diváků / Over the viewers' letters — ČST (1985) — Prague, Československá televize (Kavčí hory), CZ.  
Source: <https://www.oldradio.cz/cst/naddopis.mpg>  
Licence as found: none stated; off-air recording of Československá televize (ČST) by a private collector, served as a raw .mpg on oldradio.cz (© Martin Hájek covers the site, not the broadcast) → Tier B. Tone music; 1 windows, longest 10 s; weight 3.  
Czechoslovakia, Czech, 1980s (year estimated). The title of ČST's viewers'-letters programme — the signal running the other way: a heap of stamped envelopes, one letter flying out addressed to Československá televize Praha in a looping hand, then the card NAD DOPISY DIVÁKŮ, against a blue ground, after the outline of Czechoslovakia drawn in red, to the programme's signature music. Off-air recording from a private collector's site, https://www.oldradio.cz/cst/naddopis.mpg; no crop — the Č2 bug is the broadcaster's own.  
Raw: `~/Media/zankyo-broadcast-src/cz-oldradio-naddopis-1985.mpg` (0 MB)

**`cz-oldradio-pan-vajicko-1985`**  
Reklama – pan Vajíčko / Advertising – Mr Egg (ČST ad-break bumpers) (1985) — Prague, Československá televize (Kavčí hory), CZ.  
Source: <https://www.oldradio.cz/seznamtv.htm>  
Licence as found: none stated; off-air recording of Československá televize (ČST) by a private collector, served as raw .mpg files on oldradio.cz (© Martin Hájek covers the site, not the broadcast) → Tier B. Tone music; 2 windows, longest 9 s; weight 3.  
Czechoslovakia, Czech, 1980s (year estimated). Mr Egg, the chalk-line cartoon egg who opened and closed ČST's advertising blocks: he floats down on a bunch of balloons and the letters REKLAMA bob up over him, then the short stings he played between spots — an egg in a bow, an egg with a grin full of teeth, an egg with a butterfly net and a fencing foil, an egg turning in a headscarf — and the close, where he floats back up on his balloons and away, all white line on black to the block's jingle. Six separate stings from a private collector's site joined into one source in the site's own order (vejce1 open, 4, 5, 8, 9, vejce10 close), https://www.oldradio.cz/cst/vejce1.mpg … vejce10.mpg; no crop — the Č2 bug is the broadcaster's own.  
Raw: `~/Media/zankyo-broadcast-src/cz-oldradio-pan-vajicko-1985.mp4` (1 MB) + `_parts/cz-oldradio-pan-vajicko-1985/`

**`cz-oldradio-pocasi-1985`**  
Předpověď počasí / Weather forecast — ČST (1985) — Prague, Československá televize (Kavčí hory), CZ.  
Source: <https://www.oldradio.cz/cst/pocasi.mpg>  
Licence as found: none stated; off-air recording of Československá televize (ČST) by a private collector, served as a raw .mpg on oldradio.cz (© Martin Hájek covers the site, not the broadcast) → Tier B. Tone music; 1 windows, longest 9 s; weight 3.  
Czechoslovakia, Czech, 1980s (year estimated). The ČST second programme's weather-forecast title: a colour satellite globe of Europe and Africa turning under cloud while the words PŘEDPOVĚĎ POČASÍ grow out of it to fill the disc, the Č2 channel bug in the corner, to the forecast's signature music. Off-air recording from a private collector's site, https://www.oldradio.cz/cst/pocasi.mpg (linked from seznamtv.htm, 'Různé znělky z Čs. televize 80. let'); no crop — the bug is the broadcaster's own.  
Raw: `~/Media/zankyo-broadcast-src/cz-oldradio-pocasi-1985.mpg` (0 MB)

**`cz-oldradio-tvnoviny-1985`**  
Televizní noviny / Television News — ČST (1985) — Prague, Československá televize (Kavčí hory), CZ.  
Source: <https://www.oldradio.cz/cst/tvnoviny.mpg>  
Licence as found: none stated; off-air recording of Československá televize (ČST) by a private collector, served as a raw .mpg on oldradio.cz (© Martin Hájek covers the site, not the broadcast) → Tier B. Tone music; 2 windows, longest 9 s; weight 4.  
Czechoslovakia, Czech, 1980s (year estimated). The opening titles of ČST's evening news Televizní noviny: the Earth from space, then a porthole travelling over a world map showing a satellite dish, the Prague television tower block, reel-to-reel tape decks, a woman at a computer terminal, a studio of editors, a board of city times (PRAHA, BRATISLAVA, MOSKVA, PAŘÍŽ, BONN, KOŠICE 19:31–19:44), a control desk, and the title TELEVIZNÍ NOVINY closing over a studio camera, to the news signature. Not the same title as the pool's cst-vysilani-znelky 'Zprávy TN' card. Off-air recording from a private collector's site, https://www.oldradio.cz/cst/tvnoviny.mpg; no crop — the Č2 bug is the broadcaster's own.  
Raw: `~/Media/zankyo-broadcast-src/cz-oldradio-tvnoviny-1985.mpg` (1 MB)


### Arctic Canada — IBC via IsumaTV

**`ca-ibc-qaujisaut-weather-1992`**  
Qaujisaut Show 3 — Weather Show (IBC, Iqaluit) (1992) — Iqaluit, Nunavut (IBC Iqaluit production centre and the land around the town), CA.  
Source: <https://www.isuma.tv/ibc/qaujisaut-show-3-weather-show-1992>  
Licence as found: no reuse licence; IBC item page carries only the access note: made available on the Internet for your enjoyment through funding provided by the Government of Canada and the Government of Nunavut → Tier B. Tone voice; 6 windows, longest 30 s; weight 3.  
Canada (Nunavut), Inuktut, no subtitles. Inuit Broadcasting Corporation's youth magazine Qaujisaut, Iqaluit 1992, host Jane Flaherty: the host at her desk beside a computer terminal and a stack of broadcast decks, a monitor on the console cutting to the elder Akeeshuk Joamie with a child on the snow, then Joamie in his fur-ruffed parka at length on reading the weather before going out on the land (a forecast without instruments), a ground blizzard driving across the town and its power lines, the sea-ice horizon, and open water under a grey sky. Fetched from the page's SD source https://s3.amazonaws.com/isuma.video.mp4_sd/qaujisaut_show_3_weather_show_1992.mp4.mp4 (yt-dlp cannot read isuma.tv item pages).  
Raw: `~/Media/zankyo-broadcast-src/ca-ibc-qaujisaut-weather-1992.mp4` (235 MB)


### Re-cut, still on ice (`takedown: true`)

**`tr-sivil-savunma-alarm-1960s`** — re-cut to Tier B (6 windows, longest 25 s). Sivil Savunma: İkaz ve Alarm İşaretleri ve Bu İşaretlerde Yapılacak Hareketler / Civil Defence: Warning and Alarm Signals and What to Do. <https://filmmirasim.ktb.gov.tr/tr/film/sivil-savunma-ikaz-ve-alarm-iaretleri-ve-bu-iaretlerde-yaplacak-hareketler>

**`tr-yasayan-sayilar-1970`** — re-cut to Tier B (6 windows, longest 30 s). Yaşayan Sayılar / Living Numbers. <https://filmmirasim.ktb.gov.tr/tr/film/yaayan-saylar>


### Norway — Nasjonalbiblioteket (nb.no), added in rc.106

Fetched through the web player's own path (the owner's ruling, 2026-09-25). Tiers from each nb.no record's rights field; items with no rights URI are Tier B.

**`no-nb-draugen-control-system-1992`**  
The Draugen control system (ABB promotional film) (1992) — ABB Industry and Offshore workshops, Norway (Draugen platform systems), NO.  
Source: <https://www.nb.no/items/0bd01a5371b30c7a3f0bc2b84bf7d168>  
Licence as found: copyrighted (ABB / Berge Film; nb.no: free access for all, no open licence stated) → Tier B. Tone voice; 6 windows, longest 28 s.  
Norway, English narration (narrator John Shanly); ABB Industry and Offshore promotional video made by Berge Film for Norske Shell's Draugen platform, undated by NB but made before first oil in 1993 (an operator screen's clock reads 1991 or 1992-11-2x). Windows: a flat-shaded 3D model of the platform turning under the narration; a pointer tracing the Draugen field layout drawing; long window: the process screens redrawing, generator enclosure and weather-deck fire zones, a hand on the red-keyed console; the CRITICAL ALARM lamp and the control room; a 3D render of the control room; a tape dropout breaking up into the control room and the plant overview screen. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; the ABB logo cards and end credits avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-draugen-control-system-1992.mp4` (75 MB)

**`no-nb-ekofisk-city-at-sea-1974`**  
Ekofisk: City at Sea (1974) — Ekofisk field, Norwegian North Sea, and Stavanger, NO.  
Source: <https://www.nb.no/items/297c8651c5f64faa13a963392a7e7439>  
Licence as found: copyrighted (Phillips Petroleum Company Norway / ConocoPhillips; nb.no: free access for all, no open licence stated) → Tier B. Tone voice; 6 windows, longest 28 s.  
Norway, English narration, colour; Universal Commercial-Industrial Films with A/S Informasjonsfilm for Phillips Petroleum Company Norway, on the first North Sea oil field. Windows: the title EKOFISK CITY AT SEA in red over a grey sea; a plotter pen tracing sea-floor contours; a loading buoy riding the swell as a tanker takes oil; long window: the concrete storage tank standing in the sea with supply ships, then the platforms bridged into one town on the water; the lay-barge control room paying pipe out toward Teesside and Emden; the animated network of pipelines joining at the field. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; the acknowledgement card and the blank tail avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-ekofisk-city-at-sea-1974.mp4` (270 MB)

**`no-nb-elektrisiteten-lyst-1927`**  
[Elektrisiteten gjør det lyst, rent, sundt og varmt] / [Electricity makes it bright, clean, healthy and warm] (1927) — Oslo (Fram Film studio, Hans Berge), NO.  
Source: <https://www.nb.no/items/df94654d66532e13a32e186bf0e4e6b4>  
Licence as found: copyrighted (nb.no: free access for all, no open licence stated) → Tier B. Tone noise; **SILENT PRINT**; 5 windows, longest 28 s.  
Norway, silent print (no sound). Fram Film advertising film, camera Hans Berge (NB 'Hans Berge nr. 242/1'); NB dates it ca 1915-1930, and the slogan's 'Oslo' puts it after 1925. An image machine: about 17 motor-driven rollers turn to assemble a picture, pause, then turn again. Windows: long window of the slogan board 'Oslo-hjemmene får 1000 watt for 180 kroner' dissolving roller by roller into the pictures (power lines, a city at night, the electric kitchen, the home); the pictures cycling back to the slogan; the machine seen from the side with its electric motor, rollers turning; close on the rollers turning over; the next advertisement on the reel, a young man smoking a Flag cigarette. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; NB's modern title card avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-elektrisiteten-lyst-1927.mp4` (248 MB)

**`no-nb-en-chance-linguaphone-1930`**  
En chance / A Chance (Linguaphone advertising film) (1930) — Bergen, Linguaphone institute office, Strandgaten 16-18, NO.  
Source: <https://www.nb.no/items/271f956a5bbc613a9ad6a8234daf1df8>  
Licence as found: CC BY 4.0 (nb.no IIIF manifest rights); Wilse Film Co for Norsk Linguaphone, via Nasjonalbiblioteket → Tier A. Tone noise; **SILENT PRINT**; 10 windows, longest 40 s.  
Norway, silent print (the file's sound track is blank), Norwegian intertitles; Wilse Film Co advertising film for the Linguaphone institute, Bergen, c. 1930 (year uncertain in NB's catalogue), with Tryggve Larssen. Windows: the boss at his roll-top desk handing out the London assignment; the man reading the Linguaphone advertisement in a magazine, close; walking a tree-lined street in an iris, and the new Kroepelien building; the painted card 'I Kroepeliens nye bygning, Strandgaten 16-18, findes Linguaphone Institutets Bergenskontor'; the institute's office, hat in hand; the man in a dressing gown by a wind-up gramophone, book open, learning English from a record (long window); the record turning on the gramophone, close; a steamer leaving for England; his handwritten letter home thanking the course. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; NB's logo and the digital intertitle cards avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-en-chance-linguaphone-1930.mp4` (71 MB)

**`no-nb-jubileumsutstillingen-1914`**  
Jubileumsutstillingen / The Jubilee Exhibition, Frogner 1914 (1914) — Kristiania (Oslo), Frogner, Jubilee Exhibition grounds, NO.  
Source: <https://www.nb.no/items/3b59b1f982a1d66edef0dfa91f019189>  
Licence as found: Public Domain Mark 1.0 (nb.no IIIF manifest rights) → Tier A. Tone noise; **SILENT PRINT**; 10 windows, longest 40 s.  
Norway, silent print (no sound). Fram Film, camera Hans Berge (NB 'Hans Berge nr. 392'): opening of the centenary-of-the-constitution exhibition at Frogner, Kristiania, 15 May 1914, later the Vigeland park. Windows: a motor car and carriages driving through the 1814-1914 gate; the procession walking a lane through 3-4000 massed spectators; King Haakon's party and uniformed officers on the grounds; the classical exhibition halls; a bronze sculpture with women passing; the long reflecting pool seen from above; visitors by the lake and the twin towers; long window: one unbroken high panorama across the pavilions and the lake. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; NB's modern title card at the head avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-jubileumsutstillingen-1914.mp4` (665 MB)

**`no-nb-maskinhallen-frogner-1914`**  
[Interiør fra maskinhallen, jubileumsutstillingen på Frogner] / [Interior of the machine hall, Jubilee Exhibition at Frogner] (1914) — Kristiania (Oslo), Frogner, Jubilee Exhibition machine hall, NO.  
Source: <https://www.nb.no/items/56c4a7f726c3606ab8e49089e2274603>  
Licence as found: copyrighted per nb.no record (free access for all, no open licence stated) → Tier B. Tone noise; **SILENT PRINT**; 2 windows, longest 20 s.  
Norway, silent print (the file's sound track is blank). Camera Hans Berge, distributed by Fram Film: inside the machine hall of the 1914 centenary exhibition at Frogner, Kristiania. Windows: King Haakon's party in overcoats and top hats walking the carpet past a giant rolling press; then crowds packed among the machines, printing presses and cranes under the hall's painted vault, the camera drifting down the aisle. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; NB's modern title card avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-maskinhallen-frogner-1914.mp4` (9 MB)

**`no-nb-phillipsrevyen-1986`**  
Phillipsrevyen 1-86 / The Phillips Review 1986, no. 1 (1986) — Stavanger (TVP studio) and the Ekofisk field, NO.  
Source: <https://www.nb.no/items/50fdcec59f6b125533a49ad1fb7d0ad2>  
Licence as found: copyrighted (Phillips Petroleum Company Norway / ConocoPhillips; nb.no: free access for all, no open licence stated) → Tier B. Tone voice; 6 windows, longest 30 s.  
Norway, Norwegian and English with the programme's own burned-in subtitles; in-house video newsreel made by TVP Film og Videoproduksjon, Stavanger, for Phillips Petroleum Company Norway's information department, presented by Torunn Mo and Stig Kvendseth. Windows: the title PHILLIPSREVYEN 1-86 over breaking sea, dissolving to the two presenters' welcome; 'Regular TV at Ekofisk, what is happening?' and the Dyvi Beta jack-up beside 2/4 Bravo; the STOPP TENK INFORMER safety sticker on a hard hat; the Phillips 66 net-profit card and the oil-price figures; the cook in the Ekofisk galley stores; long window: 'Phillips is the first operator to get a permit for local TV offshore', then technical chief Thor Aresvik in front of the equipment racks: 'we may transmit our own programs, like the Phillipsrevyen... we may receive NRK from satellite'. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; the end credits avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-phillipsrevyen-1986.mp4` (464 MB)

**`no-nb-var-venn-elektrisiteten-1964`**  
Vår venn elektrisiteten / Our Friend Electricity (1964) — Oslo area (ABC-film), NO.  
Source: <https://www.nb.no/items/a287f75008ed037d93b816e42a4b3a4e>  
Licence as found: copyrighted (ABC-film for Forbrukerrådet / Statens filmsentral; nb.no: free access for all, no open licence stated) → Tier B. Tone voice; 6 windows, longest 28 s.  
Norway, Norwegian, colour; ABC-film information film directed by Sølve Kern for the Consumer Council and the State Film Centre, on electrical appliances in the home. Windows: the kilowatt meter's needle and the fuse board; a woman switching on a lamp and the radio in a 1960s living room; a black-and-white house fire, the warning; long window: the appliance-testing laboratory, a man in a white coat wiring a test bench, cables and plugs, an iron on a test rig; an iron being tested; the stopwatch held over a washing-machine drum. Fetched from the National Library of Norway (nb.no) via its web player's HLS stream; NB's modern title card and the end credit avoided.  
Raw: `~/Media/zankyo-broadcast-src/no-nb-var-venn-elektrisiteten-1964.mp4` (499 MB)


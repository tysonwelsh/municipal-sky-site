<!-- reels round 4 source scout register; scout output verbatim. Index and shortlist: ../SOURCES.md -->

# South Asia — native sources register (`south-asia`)
Scout: Opus 5, 2026-09-14. Languages: Hindi, Urdu, Bengali, Tamil, Telugu, Marathi, Sinhala, Nepali, Punjabi, Assamese, Dzongkha, Dhivehi. Territories: India, Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan, Maldives.

**Headline for the owner:** the region's public broadcasters have almost all
surrendered their archives to YouTube (Doordarshan, PTV, Rupavahini, NTV, BBS —
every one of them). The deep-cut tier here is *not* the broadcasters. It is (a)
India's own repository software — NCAA/DIGITĀLAYA and the Pandora archives
(indiancine.ma, pad.ma), which serve plain HTML5 `<video>` off government and
collective servers, and (b) the university / institute AV repositories
(eGyanKosh, NDLI, ARCE) and the minority-language archives (Noolaham/Aavanaham
for Sri Lankan Tamil, MPP for Nepali). Those are where the tape that never went
to YouTube actually is.

## Register

| url | country | language(s) | type (§2 #) | holdings | era fit | deep-cut 1–5 | access | readable | licence posture | etiquette | native terms | why it fits |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| https://ncaa.gov.in/repository/ (rep. page: `/repository/search/displaySearchRecordPreview/NAI-001-FR/Immersion of Mahatma Gandhi's Ashes in Jabalpur, Madhya Pradesh`) | India | Hindi, Assamese, Bengali, Tamil, Telugu, Marathi, Sanskrit + 20 more | 1, 2, 3, 6, 9 | National Cultural Audiovisual Archives, Ministry of Culture, run by IGNCA. **21,989 digitised records** deposited by ~20 partner institutions: National Archives of India film reels (NAI-…-FR, incl. Gandhi's ashes 1948), IGNCA Betacam documentation (IGNCA-…-BC), IGRMS ethnographic reels, CCRT folk-theatre tapes, Sangeet Natak Akademi, ICCR, Sruti/CVI. Carrier is recorded per item — 78 rpm, spool, VHS, U-matic (UMHB), Betacam (BC), MiniDV, film reel (FR) | most — the deposits are 1940s–1990s field and documentation tapes; a minority post-2000 | **5** | public player, no registration, no geo-block | **generic extractor READS it** — probe on IGNCA-902-BC returned a 2-item playlist; page uses fluidplayer over plain HTML5 `<video>` | "Copyright 2016 © All Rights Reserved"; T&C permit direct linking without permission, silent on reuse. Depositors are all GoI bodies → **Tier B, argue-able A** for the NAI/IGNCA government reels | robots.txt returns 403 (no policy served); C-DAC DIGITĀLAYA stack, ISO 16363 repository; be gentle, single-threaded | अभिलेखागार, राष्ट्रीय सांस्कृतिक श्रव्य-दृश्य अभिलेखागार, वृत्तचित्र | The single best native find of this beat: a government tape library that serves raw documentation footage — a Kumbh Mela reel, a Nautanki singer's face, an ashes-immersion newsreel — off its own server, in carrier-labelled chunks, with nothing on YouTube |
| https://indiancine.ma/ (rep. page: https://indiancine.ma/OR) | India | Hindi, Bengali, Tamil, Telugu, Marathi, Urdu + regional | 2 | CAMP (Mumbai) + Alternative Law Forum (Bangalore) + 0x2620 (Berlin). Unique pages for **60,000+ films, ~15,000 with video**, declared primary focus on **pre-1957 cinema**; runs Pandora, the same software as pad.ma; time-based annotation, frame-accurate cut/colour/camera-movement search | most — the collection is deliberately weighted to early and pre-Independence film | **5** | public player; per-item rights vary (some titles stream only in low-res or as clips) | not read by yt-dlp (SPA; generic → "Unsupported URL"). In-page HTML5 `<video>`; Pandora's direct `/<id>/<res>.mp4` returned **403** on the item probed, so a video scout must go item by item; documented JSON API at `/api/` | mixed — Pandora carries per-item rights; the project is explicitly a fair-dealing/scholarly archive. **Tier B** by default, Tier A for the pre-1930s and government titles | robots.txt: `User-agent: * / Disallow:` (everything allowed) + sitemap index of 3 chunks. The sitemap is the polite way in | भारतीय सिनेमा अभिलेख, indiancine.ma | Pre-1957 Indian film with nobody's YouTube compression on it; title cards, studio logos, the Prabhat and New Theatres idents that open a 1935 print |
| https://pad.ma/ | India | Hindi, Marathi, Bengali, Urdu + English | 2, 6, 7 | Public Access Digital Media Archive — **footage, not finished films**: rushes, unedited documentary material, city and protest footage, interviews, all densely text-annotated. Sister project to indiancine.ma, same Pandora stack, same crew (CAMP/ALF/0x2620) | some — strongest on 1990s–2010s; a real 1930s–1960s seam exists in the deposited collections | 5 | public player, free download declared for non-commercial use | not read by yt-dlp (generic → "Unsupported URL"); in-page HTML5 `<video>`; `/api/` documented; download links exposed per item | project states material is free to download for non-commercial use; per-item rights still vary. **Tier B, with Tier A items** | robots.txt `Disallow:` (open) + sitemap; wiki.pad.ma documents the API — use it rather than scraping | pad.ma, फुटेज संग्रह | Rushes are exactly the station's register: a camera left running, a street, a face that has not been cut into a story yet |
| https://noolaham.media/ (Aavanaham; index at http://aavanaham.org/) | Sri Lanka | Tamil | 6, 8, 2 | Noolaham Foundation's multimedia archive for the Sri Lankan Tamil communities: video, film, **250+ old songs**, old Tamil radio recordings, a couple of old Tamil feature films, research talks, photographs, manuscripts; browsable by material type, location, donor, date, subject; a separate "malaiyaham" (up-country/plantation Tamil) catalogue | some — strong on 1960s–1990s community material, thinner on the 1930s | **5** | public; site is up at `noolaham.media` (200) but the `aavanaham.org` mirror refuses TLS from a US IP | **not probed successfully** — curl from here returns an empty body (JS-rendered or bot filter); WebFetch 403. A video scout should open it in a real browser first | Noolaham publishes under an open-access mission and has CC-licensed its text library; the multimedia terms were not reachable in this pass — **verify; Tier A likely** | the `aavanaham.org` host would not complete TLS from the US; use `noolaham.media`. Small volunteer foundation — do not hammer it | நூலகம், ஆவணகம், பல்லூடக ஆவணகம், பழைய பாடல்கள் | A minority-language archive kept by the community itself: Sri Lankan Tamil voices and pictures that were never going to be re-uploaded anywhere. "As far as a signal gets" |
| https://www.cinemaazi.com/ | India | Hindi, Bengali, Marathi, Tamil, Telugu, Assamese, Punjabi, Gujarati, Konkani, Manipuri, Garhwali, Kannada | 2, 5 | Indian Cinema Heritage Foundation (New Delhi), founders' own memorabilia collection. Encyclopedia + **video and photo essays, filmed interviews, rare clips**, the "Cinema Memory Project" gathering fan memorabilia **up to 1989**; explicitly multi-regional, not Bombay-only | some–most — the editorial cut-off is 1989, so what video there is sits in period | 4 | public player, no registration | **generic extractor READS it** — probe returned a 2-item playlist; site uses Plyr over self-hosted `.mp4` | not-for-profit trust; site carries its own Terms & Conditions page; no open licence declared. **Tier B** | ordinary WordPress-class site, no unusual asks; self-hosted media so bandwidth is theirs — be light | सिनेमा अभिलेख, भारतीय सिनेमा विरासत | Studio logos, song-picturisation fragments and the stills-in-motion of a cinema that predates television — and it serves its own files |
| https://cec.swayam2.ac.in/ and https://cec.nic.in/cec/ | India | Hindi, English + regional | 9 | Consortium for Educational Communication (UGC inter-university centre). **Countrywide Classroom has been transmitted on Doordarshan's national network twice a day since 15 Aug 1984**; CEC's own figures: ~15,000 video programmes / 7,000 hours across 49 subjects, produced by the Media Centres (EMRCs) at Pune, Hyderabad, Calcutta, Roorkee, Ahmedabad, Delhi | most — the 1984–1999 Countrywide Classroom output is the bulk of the back catalogue | **5** | public, no registration on the SWAYAM course pages | self-hosted `.mp4` visible in the page markup; **not probed with yt-dlp** (needs a specific programme page, not the portal root) | Government of India educational content on a `.gov`/`.ac.in` host; SWAYAM material is generally openly licensed but CEC does not declare one on the portal. **Tier B, argue-able A** | nic.in hosts throttle aggressively; single connection, and expect slow TTFB | देशव्यापी कक्षा, शैक्षिक दूरदर्शन, यूजीसी कार्यक्रम | India's school-TV tier, the exact thing the station wants: a 1986 lecturer with a chalkboard and a Doordarshan slate, shot on U-matic, never on YouTube |
| https://nroer.gov.in/ | India | Hindi, English + "all Indian languages" by policy | 9 | National Repository of Open Educational Resources, CIET/NCERT. ~14,527 files: **6,153 videos**, 1,664 audio, 2,586 images, 401 collections. Carries the CIET/NCERT school-television back catalogue alongside modern material | some — CIET has been producing school TV since 1984, but the repository surfaces recent material first | 4 | public, no registration to browse | **not probed** — the portal is a JS app and served no media signature to a plain fetch; a video scout should find one resource page first | **default licence CC BY-SA** declared at launch by NCERT, reusable commercially — the clearest **Tier A** licence found anywhere in this beat | gov.in host; JS-rendered; go through a resource page, not the root | राष्ट्रीय मुक्त शैक्षिक संसाधन भंडार, एनसीईआरटी वीडियो | The one South Asian source where the licence question is already answered: CC BY-SA on school-TV film |
| https://egyankosh.ac.in/ (videos: `/handle/123456789/36084`) | India | Hindi, English | 9 | IGNOU's DSpace repository: course video, **Gyan Darshan** educational-TV recordings, "TV and Video Magazines" units, Swayam Prabha channel archive. IGNOU has been making televised course material since 1991 | some — strongest 1990s–2000s; pre-1990 is out of scope for IGNOU | 3 | public, no registration; DSpace `bitstream/` paths are direct file URLs | **not probed** (the item opened for the probe held a PDF bitstream, not video); DSpace bitstreams are plain files, so generic will read them once a video handle is picked | Government open university repository, no explicit open licence on the item pages. **Tier B** | DSpace — use the OAI-PMH/handle structure rather than crawling; be gentle | ज्ञान दर्शन, ई-ज्ञानकोश, शैक्षिक वीडियो | 1990s Indian educational television as broadcast, with its own idents and clock, sitting in a university repository instead of a channel |
| https://vmis.in/ | India | Hindi, Tamil, Telugu, Bengali + many regional/tribal languages | 6, 9 | Virtual Museum of Images and Sounds, run by the American Institute of Indian Studies, Gurugram, with the Ministry of Culture. Two wings: **ARCE** (Archives and Research Centre for Ethnomusicology — ~25,000 hours of sound and a video collection of performing arts, deposited by scholars since 1982) and **CAA** (Center for Art and Archaeology, photographs and built heritage) | most — the deposits are field recordings from the 1960s–1990s | **5** | public catalogue with "sample recordings as and where possible"; full items likely on request | **not probed** — the site served no media signature to a plain fetch (JS-rendered) | AIIS is a US-registered institute operating in India under a GoI MoU; no open licence declared. **Tier B**; contact-first is the honest route | catalogue-first site; ARCE's mandate is scholarly access — a request email is likely to be answered where scraping will not | ARCE, संगीत अभिलेख, क्षेत्रीय ध्वनि संग्रह | Ethnographic field video: a ritual, a drum, a village crowd looking at the lens, in languages the pool has never carried |
| https://ignca.gov.in/divisionss/kalanidhi/cultural-archive/ | India | Hindi + regional | 6, 9 | Indira Gandhi National Centre for the Arts' own Cultural Archives: **~2,000 video tapes and 1,500 audio spools** of IGNCA's documentation, plus the Media Centre's **8,000+ hours of digitised A-V footage**; national-award films (Yelhou Tagoi, Wangala of the Garos). KALASAMPADA is the online delivery project; NCAA (row 1) is IGNCA's repository arm | most — 1980s–1990s documentation | 4 | mostly catalogue/description on the public site; the actual media is served through NCAA | not readable directly — this is the parent institution's descriptive site; go to NCAA for the files | GoI body; same posture as NCAA. **Tier B, argue-able A** | gov.in; read this to know *what* to search for in NCAA, then search NCAA | इंदिरा गांधी राष्ट्रीय कला केंद्र, कलानिधि, सांस्कृतिक अभिलेखागार | The finding aid for row 1 — it names the collections and the film titles the NCAA search box needs |
| https://www.abhilekh-patal.in/ | India | Hindi, English, Urdu, Persian | 3 | Abhilekh Patal, the National Archives of India's public portal — the digitised record holdings of the Government of India. Predominantly documents, but NAI's film reels are the `NAI-…-FR` deposits that surface in NCAA, and a `.mp4` reference is present in the portal markup | most — the record series run 18th century to the 1970s | 4 | public search; some series need registration for full images | **not probed**; document-first portal, video is incidental | Government of India public records → **Tier A** for anything out of copyright term | gov.in; heavy portal, slow — search narrowly | राष्ट्रीय अभिलेखागार, अभिलेख पटल | The state's own record film — the ashes, the flag, the ceremony — at its source rather than a re-upload |
| https://citizensarchive.org/ | Pakistan | Urdu, English, Punjabi, Sindhi | 6, 2 | Citizens Archive of Pakistan (Karachi/Lahore/Islamabad). Mixed archive: exhibits, photographs, documentary shorts, school programmes, and an oral-history wing. **Self-hosts its own `.mp4` files** (e.g. `/wp-content/uploads/…/Cap-intro.mp4`, `…-short-documentary_480p.mp4`) | some — the material documents 1947–1980s but much of the *footage* is recent production about that period | 3 | public, no registration | self-hosted `.mp4` visible in page markup; **not probed** with yt-dlp; generic will almost certainly read a direct `.mp4` | NGO, all-rights-reserved posture, no open licence. **Tier B** | ordinary WordPress; note per §2 that the oral-history wing (type 11) is **out of scope** — only the archival-footage and exhibit material counts | شہری آرکائیو پاکستان, پرانی تصاویر | The only Pakistani institution found that serves its own video files rather than pointing at YouTube |
| https://pakmag.net/film/ | Pakistan | Urdu, Punjabi | 5, 2 | Pakistan Film Magazine / Pakistan Film Database — the largest Lollywood database: **4,000+ films, ~4,500 artists, ~6,500 film songs** catalogued since 1999, run by a private collector (Mazhar.dk). Stills, posters, song listings, some self-hosted video | most — the database's centre of gravity is 1948–1990s | 4 | public, no registration | one self-hosted `.mp4` seen in the markup; **not probed**; mostly a metadata and stills site | private collector site, all rights reserved, no licence page found. **Tier B** | one-person site on modest hosting — fetch a page at a time, never a crawl | پاکستان فلم میگزین, لالی وڈ, پرانی فلمیں | The finding aid for Pakistani cinema: it tells a video scout which 1962 Urdu title to go looking for, and occasionally holds the clip itself |
| https://www.tune.pk/ | Pakistan | Urdu, Punjabi, Sindhi, Pashto | 4 | Tune.pk, Lahore — Pakistan's own video-sharing platform, founded 2012, and the de-facto national host during the 2012–2016 YouTube ban, when PTV drama and ident rips went here instead. **Inactive since ~2020** but the site still answers 200 | some — user uploads of 1970s–1990s PTV are the reason to go | **5** (anything only ever uploaded here is unreachable elsewhere) | public; site answers 200 but serves no content to a plain fetch — likely a shell or JS-gated | **not readable** from a plain fetch; no yt-dlp extractor (grep of the 1,752-extractor list: nothing for `tune.pk`) | UGC platform, rights are the uploaders'. **Tier B** | dormant host, unknown state — treat as fragile; if it is a shell, the Wayback-era uploads are gone and this row closes | ٹیون پی کے, پرانے ڈرامے, پی ٹی وی | The single highest-value *gamble* in this beat: four years of Pakistani tape rips that were deliberately posted somewhere other than YouTube |
| https://www.dailymotion.com/ (Pakistani centre of gravity, e.g. `/Pakistanidramax`) | Pakistan | Urdu, Punjabi | 4 | Dailymotion is, in practice, Pakistan's archive host: whole PTV drama runs, 1970s–1990s serials, idents and continuity are uploaded there by Pakistani channels and collectors rather than to YouTube. Registered here under the SHARED.md rule that a global host with a native centre of gravity counts | some — the uploads are old tape, the platform is not | 2 (much is also on YouTube) | public player; some titles geo-restricted | **`dailymotion`, `dailymotion:user`, `dailymotion:playlist`, `dailymotion:search` extractors exist** — yt-dlp reads it well | uploader-held rights, platform ToS forbids downloading. **Tier B** | rate-limited; use the user/playlist extractors rather than search sweeps | پی ٹی وی ڈرامے, پرانے اشتہارات, نشریات | The fallback when a PTV moment exists nowhere native — and the one place the Urdu continuity announcer actually survives in quantity |
| https://psmnews.mv/ | Maldives | Dhivehi | 1 | Public Service Media (PSM) — Television Maldives (est. 1978) and Dhivehi Raajjeyge Adu. News site with **its own jwplayer + HLS**, not a YouTube embed; live and recent VOD | little — the online material is current-affairs; the pre-2000 TVM tape is not published | 3 | public page, but the HLS manifest returned **HTTP 401** to an unauthenticated probe | **HLS visible in page, token-gated**: yt-dlp found the m3u8 and was refused (401) | state broadcaster, all rights reserved. **Tier B** | 401 on the manifest means a player token is required — do not try to work around it; the honest route is an archive request | ދިވެހިރާއްޖެ, ޓެލެވިޜަން މޯލްޑިވްސް | The only Dhivehi-language broadcaster online; if TVM's 1980s tape is ever published it will be here, and the pool has no Maldives |
| https://www.bbs.bt/ | Bhutan | Dzongkha, English | 1, 8 | Bhutan Broadcasting Service — the country's only broadcaster (TV since 1999, radio since 1973). News site carrying **video-js** alongside YouTube embeds, so a share of the VOD is self-hosted | little — BBS television only began in 1999, so this beat's 1930s–1990s window is radio-era for Bhutan | 3 | public, no registration | mixed: `video-js` present, but the generic extractor returned "Unsupported URL" on the homepage — a video scout must find a self-hosted article, not the root | state broadcaster, all rights reserved. **Tier B** | small national broadcaster on modest hosting; be very light | འབྲུག་བརྒྱུད་འཕྲིན།, BBS | Dzongkha is a language the pool has never carried; even a 1999 sign-on is at the far edge of the dial, which is what the far tail is for |
| https://archives.gov.lk/film-db and `/index-of-films` | Sri Lanka | Sinhala, Tamil, English | 2 | Department of National Archives, Colombo. A **catalogue of ~234 Sri Lankan films, 1949–2013** (archival number, cast, crew, release date, duration, B&W/colour) — metadata only, no player. The B&W run 1949–1980s is fully listed | most — the catalogue's early half is exactly in period | 2 as a *source* (nothing streams), **5** as a *finding aid* | public web page; films themselves are on-site only, by request | not applicable — no media served | government catalogue; the films themselves are NFC/rights-holder property. **Tier B** | plain government page, no burden; the phone/e-mail contact is the documented route to the reels | ලේඛනාගාරය, ජාතික ලේඛනාගාරය, චිත්‍රපට | Not a video source — the index that tells a video scout exactly which 1956 Sinhala title to hunt, with its archival number |
| https://bfa.gov.bd/ (portal mirror: https://bfa.portal.gov.bd/) | Bangladesh | Bengali | 2 | Bangladesh Film Archive, Agargaon, Dhaka — est. 1978, independent since 1984. National archive for Bangladeshi **films, advertisements and other visual media**; runs weekly public screenings; publishes catalogues (`book.bfa.gov.bd`) | most — it is the national repository for 1950s–1990s Bengali film and TV advertising | **5** | **unreachable from a US IP** — both `bfa.gov.bd` and `bfa.portal.gov.bd` gave connection refused / timeout on 443 | **not probed** (host unreachable from here) | government archive, no online licence statement found. **Tier B** | the whole `*.portal.gov.bd` estate appears to block or drop non-Bangladeshi traffic — a video scout will need a different vantage point, or the catalogue route | বাংলাদেশ ফিল্ম আর্কাইভ, চলচ্চিত্র সংরক্ষণ, পুরনো বিজ্ঞাপন | Its stated mandate explicitly includes **advertisements** — Bengali 1980s ad breaks are one of the purest forms of the thing the station is listening for |
| https://liberationwarbangladesh.org/ (audio-video: `/?page_id=6725`) | Bangladesh | Bengali | 3, 6 | মুক্তিযুদ্ধ ই-আর্কাইভ (Liberation War e-Archive) — a digital public library of the 1971 war and the Language Movement: documents, newspapers, photographs, **an audio-video section**, periodicals | most — the collection is 1948–1971 with later press | 4 | public, optional e-mail registration | **not probed** — a plain fetch returned no media signature; the A-V section needs opening in a browser | non-profit archive, no licence statement surfaced. **Tier B** | small volunteer project; take one page at a time | মুক্তিযুদ্ধ ই-আর্কাইভ, অডিও-ভিডিও, আর্কাইভ | 1971 radio and film: Swadhin Bangla Betar, the announcements, the newsreel of a country starting — none of it in the pool |
| https://www.liberationwarmuseumbd.org/page/audio-visual-archive | Bangladesh | Bengali | 3, 6 | Liberation War Museum, Dhaka (est. 1996, 21,000 artefacts) — a named **Audio Visual Archive** page of war film and documentary | most — 1971 and immediately after | 4 | public page; depth of online streaming unverified | **not probed** | museum, all rights reserved. **Tier B** | institutional site; contact-first for anything beyond what is published | মুক্তিযুদ্ধ জাদুঘর, অডিও ভিজ্যুয়াল আর্কাইভ | Second door to the same 1971 footage, with a museum's cataloguing behind it |
| https://www.archivenepal.org/ (collections: `/digitalCollections`) | Nepal | Nepali, Newari | 6 | Archive Nepal — **~3,000 digitised items** (images, objects, **videos**, books, documents, audio) drawn from 18 national and international sources; the Shyam Chitrakar Collection is 3,168 historic sports photographs, billed as Nepal's first digital sports archive; a *Nepali Times* back-file section | some — the photographic collections are deeply in period; the video library is mixed | 3 | public, no registration | **not probed** — collections page served no media signature to a plain fetch (JS app) | diaspora-run non-profit (Archive Nepal Inc.), Nepal-focused and Nepali-language; aggregates from museums with their own terms. **Tier B** | it re-publishes other institutions' items — always follow a video back to its holding institution before using it | अभिलेख नेपाल, पुरानो तस्बिर, नेपाली अभिलेख | The only general-purpose Nepali digital archive found with a video library at all |
| https://madanpuraskar.org/audio-visuals-collection/ | Nepal | Nepali | 6, 10 | Madan Puraskar Pustakalaya, Patan Dhoka, Lalitpur (est. 1955) — the principal archive of the Nepali language. **~750 audio and visual records**: musical tracks, radio interview recordings, the voices of Nepali writers, oral testimony, an audio corpus; plus manuscripts, periodicals and ephemera | most — the recordings run from the radio era forward | 4 | public description page; the media itself returned **403** to an automated fetch | **not probed** (403 to curl and WebFetch — bot filter, not a paywall; it loads in a browser) | non-profit language library; no open licence declared. **Tier B** | 403s automated agents — open it in a real browser, and note that most of the 750 records are **audio (type 10, deferred)** | मदन पुरस्कार पुस्तकालय, श्रव्यदृश्य संग्रह, अभिलेख | Nepali radio voices and writers' recordings; the visual share is small but it is the country's deepest media archive |
| https://lokvirsa.org.pk/ | Pakistan | Urdu, Punjabi, Sindhi, Pashto, Balochi, Saraiki | 6, 8 | National Institute of Folk and Traditional Heritage (est. 1974), Islamabad. Digitised its **national sound and video library** with the Smithsonian and Lahore's IRC — **50,000+ songs, videos and behind-the-scenes footage** to be published progressively; recordings of Tufail Niazi, Pathany Khan, Iqbal Bano, Ustad Salamat Ali | most — the field recordings are 1974–1990s | 4 as material, **1** as *this host* | public site | the **published** material is pushed to YouTube — the site itself carries YouTube references only | state institute; no open licence. **Tier B** | the digitisation exists and is largely unpublished; a request to Lok Virsa is the real route to the unpublished 50,000 | لوک ورثہ, فوک ورثہ, پرانی ریکارڈنگ | A 50,000-item state folk archive whose *tape* is native and whose *website* is not — flagged so the video round knows to ask rather than scrape |
| https://www.rupavahini.lk/ and https://tv.rupavahini.lk/ | Sri Lanka | Sinhala, Tamil | 1 | Sri Lanka Rupavahini Corporation — national TV since 15 Feb 1982. Live webcast, programme pages, schedule. No archive section found | little — nothing pre-2000 published online | 1 | public live webcast | not probed; the site is a schedule/live-stream front end | state broadcaster, all rights reserved. **Tier B** | nothing unusual | රූපවාහිනී, පැරණි වැඩසටහන්, ලේඛනාගාරය | Registered for completeness and as a negative result: the 1982 sign-on tape is not on Rupavahini's own site — chase it through the National Archives film DB instead |

**Row count:** 25. **Unknown to yt-dlp:** 24 of 25 — only `dailymotion` appears in
`yt-dlp-extractors.txt`. (The 1,752-extractor list holds *nothing* for South Asian
archives: its only Indian entries are commercial OTT — hotstar, SonyLIV, mxplayer,
ShemarooMe, Hungama, Epicon, startv, DiscoveryPlusIndia, ZeeNews/NDTV both marked
BROKEN — and nothing at all for Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan or
the Maldives. This beat is almost entirely new ground for the tooling.)

## Top 5 — scout these for videos first

1. **https://ncaa.gov.in/repository/** — a 21,989-record government tape library that
   **yt-dlp's generic extractor already reads**, serving raw 1940s–1990s documentation
   footage (National Archives film reels, IGNCA Betacam, IGRMS ethnographic tapes) off
   its own server with no login, no geo-block and no YouTube anywhere near it. Nothing
   else in this beat combines that depth, that era fit and that readability. Start here.
2. **https://indiancine.ma/** — 15,000 titles with video, weighted to **pre-1957**
   Indian cinema, robots.txt fully open with a sitemap index, a documented `/api/`.
   Rights vary per item and the direct `.mp4` probe was refused, so the yield needs
   item-by-item work — but this is the only place the studio idents and title cards of
   1930s–1950s India exist outside a YouTube re-encode.
3. **https://cec.swayam2.ac.in/** (with https://cec.nic.in/cec/ as the finding aid) —
   **Countrywide Classroom, broadcast on Doordarshan twice a day since 15 August 1984**,
   ~15,000 programmes / 7,000 hours, self-hosted `.mp4`. School TV with a broadcast
   slate on it is the single most on-brief genre in the whole plan, and this is the
   national holding of it.
4. **https://noolaham.media/** (Aavanaham) — Sri Lankan Tamil, kept by the community
   that speaks it: old Tamil films, 250+ old songs, radio recordings, community video.
   Deep-cut 5, a minority language the pool has never carried, and a foundation with an
   open-access mission. Needs a real browser to open — send a scout who can.
5. **https://www.tune.pk/** — the highest-risk, highest-reward row. Pakistan's own
   video platform, and the host where PTV tape rips went **during the 2012–2016 YouTube
   ban**. Dormant since 2020 and it served nothing to an automated fetch, so the first
   job is simply to find out whether the uploads are still there. If they are, it is the
   only native Pakistani tape seam found in this beat; if not, close the row and fall
   back to Dailymotion.

## Rejected (so nobody re-scouts)

| url | why |
|---|---|
| https://prasarbharati.gov.in/prasar-bharati-archives/ | **Mirrors YouTube.** India's public broadcaster archive page has no player of its own; its "Archives on YouTube" link goes to the DD ARCHIVES channel. The audio side points at `archives.prasarbharati.org` (a purchase portal) and Amazon.in. |
| https://prasarbharati.gov.in/prasar-bharati-archives/dd-archives/ | Same — DD Archives is a YouTube channel with a government landing page in front of it. |
| https://archives.prasarbharati.org/ | Commercial purchase portal for audio releases; audio is type 10 (deferred) and it is a shop, not an archive. |
| https://filmsdivision.nfdcindia.com/ | **Mirrors YouTube and Vimeo.** 8,000+ documentaries/shorts/animation, 1948 onward — the catalogue is genuinely valuable as a finding aid, but every play button is a YouTube or Vimeo embed. Also serves an **expired TLS certificate** (WebFetch and yt-dlp both refuse it; `curl -k` works). |
| https://filmsdivision.org/ | Dead — connection times out. Films Division merged into NFDC on 1 Jan 2023. |
| https://cinemasofindia.com/ | Dead — DNS/connect fails. NFDC's restored Films Division titles moved to an **Amazon Prime Video add-on** in 2025, i.e. a paywall on a non-native host. |
| https://www.sahapedia.org/ | Mirrors YouTube. Large multimedia encyclopedia of Indian arts, but the AV is embedded, not hosted. |
| https://psbt.org/ | Mirrors YouTube and Vimeo. Public Service Broadcasting Trust's documentaries are all embeds. |
| https://www.filmheritagefoundation.co.in/ | Mirrors YouTube and Vimeo (16 YT / 13 Vimeo references on the front page). Restoration body, not an online archive. |
| https://rmrl.in/ | Mirrors YouTube. Roja Muthiah Research Library (Tamil) is a superb print archive; its moving image is not published natively. |
| https://map-india.org/ | Mirrors YouTube. Museum of Art & Photography, Bengaluru — art, not moving image. |
| https://nepaltvonline.com/ | **Mirrors YouTube** — 44 youtube.com references on the front page. Nepal Television (est. 1985) publishes nothing on its own player. |
| https://ntv.org.np/ | Same broadcaster, same posture. |
| https://nfc.gov.lk/ | Mirrors YouTube/Vimeo. National Film Corporation of Sri Lanka (est. 1971) is a regulator's site, not an archive. |
| PTV Flix (app; announced Apr 2023) | **Subscription paywall.** PTV's own OTT for its archive dramas — out of scope by the plan's rule on logins and paywalls. |
| https://ptv.com.pk/ | **403 to every automated agent** (both curl and WebFetch). Cannot be assessed; the archive route for PTV is PTV Flix (paywalled) or Dailymotion. |
| https://www.itnnews.lk/ | 403 to automated agents. Sri Lanka's ITN — not assessable. |
| https://www.slrc.gov.lk/ | Served nothing to a fetch; the live/schedule front end is `tv.rupavahini.lk` (registered above). |
| https://vidpk.com/ | Dead — connection times out. |
| https://www.fdb.gov.np/ | Dead — connection times out. Nepal Film Development Board. |
| https://vigyanprasar.gov.in/ | Dead — **DNS does not resolve.** Vigyan Prasar (India's science-film and science-communication body) was wound into NIScPR; its film catalogue has no live home. |
| https://godrejarchives.com/ | Dead — DNS does not resolve. (Indian corporate/industrial film — worth a re-check under a different domain by a later scout.) |
| https://ndl.iitkgp.ac.in/ | Mirrors YouTube on its own pages; NDLI is a **metadata aggregator** that points at other repositories rather than hosting. Use it to find CEC/IGNOU items, then go to the holding repository. |
| Hotstar / SonyLIV / mxplayer / ShemarooMe / Hungama / Epicon / ZEE5 | Commercial OTT with **DRM and paywalls**. These are the only Indian hosts yt-dlp knows, and every one is out of scope. Noted so the cartographer does not mistake extractor coverage for archive coverage. |
| The 1947 Partition Archive; the oral-history wing of Citizens Archive of Pakistan | **Type 11, dropped by the owner** — a single person speaking at length to camera. (CAP's *non*-oral-history material is registered above; the archive is mixed, so the site itself is not rejected.) |
| Bangladesh Betar (betar.portal.gov.bd) | Audio-only — **type 10, deferred**. Noted in Search notes. |
| https://bfa.portal.gov.bd/ and https://btv.gov.bd/ | Not rejected on merit — **unreachable from a US IP** (connection refused / timeout on 443). See the Bangladesh Film Archive row; this needs a different vantage point, not a different scout. |

## Search notes

### The shape of this region (read this before going in)
South Asia inverts the assumption behind the round. In Europe and East Asia the
public broadcaster *is* the native archive; here, **every public broadcaster in the
beat has outsourced its archive to YouTube**: Doordarshan/Prasar Bharati, PTV,
Rupavahini, Nepal TV, BBS, Lok Virsa, Films Division. Searching in-script for the
broadcaster's archive is therefore a reliable way to waste an hour — it always
terminates in a `/channel/` URL. The native tier is somewhere else entirely:

1. **Repository software, not broadcaster software.** India built its own archival
   stack — C-DAC's **DIGITĀLAYA** (NCAA) and the CAMP/0x2620 **Pandora** (indiancine.ma,
   pad.ma). Both serve plain HTML5 `<video>` off their own servers. This is where the
   deep cuts actually are, and it is invisible to a search for "archive" + broadcaster.
2. **Universities and institutes.** CEC/Countrywide Classroom, IGNOU/eGyanKosh,
   NROER/NCERT, AIIS-ARCE. India ran a national educational-television system from
   1984 and the tapes went to the university consortium, not to the channel.
3. **Minority-language communities.** Noolaham/Aavanaham (Sri Lankan Tamil), Madan
   Puraskar Pustakalaya (Nepali). These keep their own media because nobody else will.

### Terms that worked, per language
- **Hindi:** `अभिलेखागार` (archive) is the word that finds institutions; `आर्काइव` finds
  YouTube channels. `वृत्तचित्र` (documentary), `देशव्यापी कक्षा` (Countrywide Classroom),
  `शैक्षिक दूरदर्शन` (educational TV), `राष्ट्रीय सांस्कृतिक श्रव्य-दृश्य अभिलेखागार` (NCAA's full name).
  `दूरदर्शन पुराना` and `पुराने विज्ञापन` from the brief both dead-ended in YouTube.
- **Tamil:** `ஆவணகம்` (archive) + `நூலகம்` (library) found Noolaham/Aavanaham immediately;
  `காப்பகம்` (the other word for archive) found mostly Indian government pages.
- **Bengali:** `আর্কাইভ` + `চলচ্চিত্র সংরক্ষণ` found the Bangladesh Film Archive; `মুক্তিযুদ্ধ ই-আর্কাইভ`
  is the phrase that finds the 1971 collections, which are the richest Bengali seam.
- **Urdu:** `آرکائیو` mostly returns news sites; `پرانی فلمیں` + `لالی وڈ` found pakmag.net;
  `لوک ورثہ` found the folk institute. Pakistan's institutional web is thin and much of it
  403s automated agents.
- **Nepali:** `अभिलेख` + `श्रव्यदृश्य संग्रह` found MPP; `पुरानो` variants returned YouTube.
- **Sinhala:** `ලේඛනාගාරය` found the Department of National Archives film DB. Sinhala
  returned the least of any language here — the online Sinhala AV web is very small.
- **Dhivehi / Dzongkha:** effectively no archive web. One broadcaster each (PSM, BBS),
  both registered, both thin on pre-2000 material.

### Technical notes a video scout needs
- **NCAA is the surprise.** `yt-dlp -s` on a record-preview page returns a 2-item
  playlist and would download: the page is fluidplayer over a plain `<video>` tag and the
  generic extractor handles it. Item ids are structured — `IGNCA-902-BC`, `NAI-001-FR`,
  `CVI-SUR_R_1992-UMHB` — and the suffix is the **carrier**: `FR` film reel, `BC`
  Betacam, `UMHB` U-matic, `AC` audio cassette, `VCD`. Searching by carrier suffix is the
  fastest way to find the oldest tape. `robots.txt` returns 403 (no policy served), so
  apply the plan's own etiquette: single-threaded, slow, one probe.
- **Pandora sites are open at the crawl layer and closed at the file layer.** Both
  `indiancine.ma` and `pad.ma` serve `robots.txt` with an empty `Disallow:` and a sitemap
  index, but the direct `/<id>/<res>.mp4` path returned **403** on the item probed
  (`indiancine.ma/OR`). Rights are per item. Use the documented `/api/` (see
  `wiki.pad.ma/wiki/HowTo`) rather than guessing file paths, and expect a real yield rate
  well under the 15,000-titles headline.
- **Three hosts 403 automated agents but load in a browser**: `ptv.com.pk`,
  `madanpuraskar.org`, `itnnews.lk`, plus `noolaham.media` which returns 200 with an empty
  body to curl. Send a scout with a real browser, not a fetcher.
- **Bangladesh is IP-blocked from the US.** The whole `*.gov.bd` / `*.portal.gov.bd`
  estate refused connections on 443 (`bfa.gov.bd`, `btv.gov.bd`, `bfa.portal.gov.bd`) while
  the same pages render in search results. This is a vantage-point problem, not a dead
  archive — and the Bangladesh Film Archive's mandate explicitly covers **advertisements**,
  which makes it one of the most on-brief holdings in the region.
- **Expired certificate:** `filmsdivision.nfdcindia.com` serves an expired TLS cert.
  WebFetch and yt-dlp both refuse it outright; `curl -k` reads it fine. Worth knowing
  because it is India's 8,000-title documentary catalogue even though the video is embedded.
- **Extractor coverage is a trap here.** Grepping the 1,752-extractor list for this region
  returns only commercial OTT (hotstar, SonyLIV, mxplayer, ShemarooMe, Hungama, Epicon,
  startv, DiscoveryPlusIndia; NDTV and ZeeNews both marked BROKEN) and **nothing at all**
  for Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan or the Maldives. Readability here has
  to be established page by page, not by extractor name.

### Dead ends worth recording
- Chasing "Doordarshan regional kendra archives" per language (Tamil/Telugu/Marathi/
  Bengali) — Prasar Bharati says the kendras' analogue tape is digitised into an internal
  **Media Asset Management** system and "repackaged for OTT/Social Media platforms". There
  is no public regional-kendra archive site. The MAM system is the thing to ask about, not
  to search for.
- **Type 5 (ident/test-card/sign-off collector sites) barely exists in this region.** No
  native-language equivalent of fernsehmuseum.info or a `заставки` community was found in
  any of the nine languages. South Asian ident collecting happens on YouTube and Dailymotion,
  in English-language comment threads. Treat type 5 as empty for this beat.
- **Type 4 (native video platforms) is nearly empty too.** India never grew a domestic
  YouTube rival that survived; Pakistan's (tune.pk) is dormant; Bangladesh's (Bioscope,
  Toffee, Chorki) and Sri Lanka's are all modern subscription OTT with no archive tier.
  Dailymotion filling Pakistan's gap is the one real exception and is registered as such.
- **Audio (type 10, deferred) is where this region is actually rich** — one line as the
  brief allows: Bangladesh Betar is constitutionally "the national archive of electronic
  media"; Lok Virsa digitised 50,000+ recordings with the Smithsonian; ARCE holds ~25,000
  hours of sound; Madan Puraskar Pustakalaya's 750 records are mostly audio; Prasar
  Bharati's archive shop sells AIR material. When the audio tier opens, **come back to
  this beat first** — the sound archives here are an order of magnitude deeper than the
  moving-image ones.

### What the video round should do with this
Send the first video scout to **NCAA** with a carrier-suffix search strategy and a
week's patience; it is the only source in the beat that is deep, in period, native,
public and machine-readable at once. Send a second, browser-equipped scout to
**indiancine.ma + Noolaham**. Send a third to establish, in one afternoon, whether
**tune.pk** still holds its uploads and whether **bfa.gov.bd** can be reached from a
South Asian vantage point — both are yes/no questions that unlock or close whole seams.

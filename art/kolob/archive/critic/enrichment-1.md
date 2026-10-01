> **Archived 2026-10-01.** A critic's report or brief from the build; every proposal in it was ruled on (see `OWNER-RULINGS.md`). Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# KOLOB 2: enrichment brief after wave 1

*Enrichment critic, 2026-09-27.*

**What I read:**
- the three plans and SCORE;
- the results and critic reports for split, tunes, question, voices and instruments;
- the second look.

**What I could not use:** there are no owner listening notes yet, and there is no `IDEAS.md` backlog. Nothing below gets built until the owner approves it.

## 1. Proposals

**1. Colony composers: every composed hymn has an author with habits.**
- *Idea.* There are about 12 colony hymnists. Each one adds a set of habits on top of the dialect:
  - favourite meters and range;
  - rhythm cells;
  - how often they leap;
  - a signature cadence;
  - a fondness for fuges or refrains.

  The composer's search scores each hymn against its author's weights, instead of aiming at one best tune per dialect. The event log names the author in Deseret. Nothing is printed on the staff.
- *Roots.*
  - Individual composers' styles in the tunebooks Kolob draws on: Billings's rugged fuges, Daniel Read's terse minor (WINDHAM), Jeremiah Ingalls's folk lilt (NORTHFIELD, 1805) and B. F. White.
  - The LDS hymn writers the plan already names: Evan Stephens (bright, dotted, march-like), Beesley and Careless.
  - The tunebooks printed the composer's name above every tune.
- *Heard.* Hymns that sound as if someone wrote them. Two hymns by the same hand in one meeting share a family face, and across visits an author comes back and is almost recognised.
- *Crew.* HYMN, first milestone, because it shapes how the search is built. The 16 transcribed Earth tunes are the reference data for extracting habits (histograms of intervals, rhythm and range).
- *Cost.* Small to medium.
- *Risk.* Low. The habits become pastiche if they are too strong, so they stay weights and never become templates.

**2. Tunes that fit together: the round and the partner hymn.**
- *Idea.* The composer can write two new kinds of tune:
  - *a round:* every line sits over one short repeating chord pattern, so the ward can sing it as a canon with 2–4 entries;
  - *a partner:* the closing hymn is composed on the first hymn's chords and meter. In its last verse the organ, or a cornet, plays the first hymn against it, and the two turn out to be one piece.
- *Roots.* Tallis's Canon (1567); Billings's rounds ("When Jesus Wept", 1770); the quodlibet that ends Bach's *Goldberg Variations*; Ives laying tunes on top of each other (*Washington's Birthday*).
- *Heard.*
  - Rounds on Primary, Shaker and Christmas Sundays. Singers enter one at a time, which is where the ward's 32 individual voices will stand out.
  - The partner in the last verse of the closing hymn, in about one meeting in four: an "oh, they fit" payoff within a single meeting.
- *Crew.*
  - HYMN: a counterpoint term in the scorer, plus a fit check that falls back to not combining the tunes.
  - FORM: never in the same meeting as the cumulative assembly.
- *Cost.* Medium.
- *Risk.* Moderate. A loose fit check turns the moment into mud. The owner hears it in hymn-lab before it ships.

**3. The trombone choir at dawn.**
- *Idea.* A new guest. A four-part trombone choir, far off, plays the day's first hymn as a slow chorale in its own harmony from the Score. A second choir answers from the other side, closer.
- *Roots.* The Moravian trombone choir of Bethlehem, PA, which has played since 1754 and announces news from the belfry; and the Salem Easter sunrise service (since 1772), where brass bands play chorales to each other across the town before dawn.
- *Heard.*
  - In the first minute of the prelude, which is dawn on the arc of light.
  - Weighted toward Easter, funerals, dedications and Christmas.
  - The first hymn is heard before anyone sings it (design law 2).
- *Crew.* GUEST, one agent, W3. It needs a trombone preset on `kolob-voices-band.js` and two distant room sends.
- *Cost.* Small.
- *Risk.* Low. It never shares a meeting with the crossing bands.

**4. The organist between the lines.**
- *Idea.* The organist styles get short fills between the lines and verses of hymns:
  - the plain organist never fills;
  - the Victorian links lines with a suspension;
  - the improviser strays further each verse, until one fill lands in a foreign key and the ward's next entry drags the organ back.

  At most one fill per meeting may be strange.
- *Roots.* The *Zwischenspiele*, organ interludes between chorale lines in Lutheran churches; Bach reprimanded at Arnstadt (1706) for "curious variations" and "strange tones" that confused the congregation; Ives's father training him to sing in one key over an accompaniment in another.
- *Heard.* Between verses of Tabernacle and gospel hymns. It supplies the Ivesian surprise inside the hymns that the voices critic found missing.
- *Crew.* CAST (organist styles), using the motif engine, which the plan already assigns to material around the hymns. W3–W4.
- *Cost.* Small to medium.
- *Risk.* Hymns sag and their shape blurs. Fills are capped in number and length, and kept out of the unaccompanied dialects.

**5. Two small rituals from real practice.**
- *Idea.*
  - *The pitching:* before a Sacred Harp hymn, the keyer hums the tonic, then each section hums its first note. A chord builds out of 32 slightly different people.
  - *The pin drop:* rarely, during a stillness, a pin drops at the pulpit and the tabernacle rings with it.
- *Roots.* Sacred Harp keying, still done at every singing; and the Salt Lake Tabernacle's pin-drop demonstration on Temple Square.
- *Heard.*
  - The pitching: 3–5 s before the hymn, early on fast and brush-arbor Sundays.
  - The pin drop: in about one meeting in eight, during the sacrament hush, in the tabernacle room only. Like the Hosanna, it is not logged and not engraved.
- *Crew.* CAST, together with the chorister's keying, for the pitching; the field crew for the pin drop. W3.
- *Cost.* Small.
- *Risk.* The pin becomes a gimmick if it comes back often, so it stays rare and quiet.

## 2. What this wave revealed

- **Best-of-N search converges.**
  - The Question's generator refused 95 % of its drafts. The ones that survived clustered on one ending (fa′ 56 %) until the ending was drawn first.
  - The composer (§4: 200 candidates, keep the best) will do the same. Draw each line's ending, peak and rhythm cell first, and have hymn-lab report the spread of endings and contours.
- **One comma policy for chords and melody.**
  - The Earth-tunes tuning fixes sour chords but leaves wolf leaps in the melody (KINGSFOLD, 27/20).
  - The Question's chorale still holds 40/27 wolf fifths.
  - One scorer should be shared by the tunes, the chorale and the composer.
- **The instruments need a level table before GUEST adopts them.**
  - Only the organ is calibrated. Against it, the band is +7 LU, the gulls +6 and the fiddle +5.8.
  - The band's range from pp to ff is only 7.7 dB.
  - The live organ has a tremulant click at the end of every chord; the fix is one line.
- **The full ward is not yet proven on phones.**
  - It costs about 1,150 audio nodes, against 390 for desks, and nobody has run it at 4× CPU throttling.
  - Two fixes are needed before the singers sound like people: a late singer's consonants and vowels must be late too, not only his pitch; and single notes must stop honking up to 8 dB louder than their neighbours.
- **The Question needs two owner decisions:**
  - either FORM gives the invocation and postlude about 100 s, or the Question lives in the testimony and sacrament;
  - who asks it: the instruments crew's cornet is ready to be Ives's trumpet.
- **Tunes to add next:**
  - ASSEMBLY ("The Spirit of God"), which the Hosanna requires;
  - DESERET ("High on the Mountain Top");
  - KINGSFOLD's printed Amen.
- **Hygiene:** the engine module list lives in four places and should be one; the two branches collide on the organ file name; melody and harmony still read the meeting's state and the clock, so they must be made pure before HYMN starts.

## 3. Rubric trend (baseline: the first scored wave)

| track | Sophistication | Richness | Variety | Joyful novelty | Kolob-ness |
|---|---|---|---|---|---|
| split (a pure refactor) | n/a (engineering: high) | n/a | n/a | n/a | n/a |
| tunes | 4 | 4 | 4 | 3 | 4 |
| question | 5 | 4 | 4 | 4 | 4 |
| voices | 4 | 4 | 3 | 3 | 4 |
| instruments | 4 | 4 | 4 | 4 | 5 |
| **mean** | **4.25** | **4.0** | **3.75** | **3.5** | **4.25** |

Joyful novelty and variety are the weakest axes. Proposals 1 and 2 target variety; proposals 2 to 5 target joyful novelty. All of these scores are for lab work, since nothing is merged yet. The first scores for a whole meeting will come from the W2 panel.
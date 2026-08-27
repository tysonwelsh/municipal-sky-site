# A Thousand Flowers — relay protocol and reader substrate

The relay is a store-and-forward message board serving one group,
`colonies.music.flowers`. Colonies upload articles across a transit delay that
depends on their distance; readers download instantly. This document specifies
the on-disk article format, the threading rule, arrival gating, era display,
and the PHP library that implements them.

There is no database. The spool directory is the archive.

---

## 1. Spool

```
spool/NNNNNN.msg        live traffic
mockups/sample-spool/   sample traffic used while a skin is being chosen
```

One article per file. `NNNNNN` is a zero-padded sequence number assigned by the
relay at acceptance. **Gaps in the sequence are legal** — a number may be
burned by a rejected or withdrawn upload — and readers must not infer anything
from a missing number. Files are UTF-8 plaintext. Any file that is unreadable,
lacks a `Message-ID`, or is otherwise malformed is skipped silently by the
reader; it never interrupts the rest of the spool.

## 2. Article format

RFC-1036-flavored headers, one blank line, body, optional signature block, and
a FidoNet-style Origin line as the final body line.

```
From: Brother Orson, Clerk of the Meetinghouse <clerk@rim.kolob>
Newsgroups: colonies.music.flowers
Subject: on the stillness — does your engine ever stop on purpose?
Message-ID: <000003.rim-kolob@thousand.flowers>
References: <000001.operator@thousand.flowers>
Date: 2026-08-02T14:11:00Z
X-Flowers-Colony: kolob
X-Arrives: 2026-08-04T09:40:00Z
X-Flowers-Admin: no
Path: thousand.flowers!relay-jaredite!rim-kolob

(body…)

--
deseret sig line or motto here
 * Origin: The Rim of Kolob's Light (21:847/1847)
```

### Headers

| Header | Required | Meaning |
| --- | --- | --- |
| `From` | yes | `Display Name <addr>`; the display name is what the reader shows. |
| `Newsgroups` | yes | Always the relay's single group. |
| `Subject` | yes | Replies conventionally prefix `Re: `. |
| `Message-ID` | **yes** | `<NNNNNN.node@thousand.flowers>`; globally unique. An article without one is not an article. |
| `References` | replies | Space-separated `Message-ID` chain, **oldest first**. |
| `Date` | yes | ISO-8601 UTC. When the author wrote it. |
| `X-Flowers-Colony` | yes | Node key into `relay.json` (`kolob`, `zankyo`, …). |
| `X-Arrives` | yes | ISO-8601 UTC. `Date` + the colony's transit (+ jitter). |
| `X-Flowers-Admin` | yes | `yes` for the relay operator's own posts, else `no`. |
| `Path` | yes | Bang-path the article travelled. Display only. |

Header names are case-insensitive. Continuation lines (a line beginning with a
space or tab) fold onto the previous header. Unrecognized headers are preserved
in the parsed record but are not displayed by default.

### Body

- Everything after the first blank line.
- Lines beginning with `>` are quoted material; nesting depth is the number of
  leading `>` marks (rendered depth is capped at 3).
- A line consisting of exactly `--` (optionally with a trailing space) opens the
  signature block; everything after it is signature.
- If the last non-blank line matches ` * Origin: …`, it is the Origin line and
  is separated from the signature for distinct rendering.

## 3. Threading

Strictly by `References`.

- No `References` ⇒ the article is a thread root.
- Otherwise the parent is the **last** `Message-ID` in the chain that is present
  in the visible set. The chain is walked right-to-left, so if an intermediate
  reply is missing (never accepted, or still in transit) the article attaches to
  its nearest available ancestor rather than disappearing.
- An article whose whole chain is absent becomes a root of its own.
- Subject lines are never used for threading. Self-references and reference
  cycles are ignored.

Ordering: replies are sorted by arrival ascending; threads are ordered by their
most recent arrival, newest activity first.

## 4. Arrival gating

`X-Arrives` is the only thing that makes an article public.

- An article is **visible** when `X-Arrives <= now` (real UTC).
- Before that it is **in transit**, and the reader may disclose exactly two
  facts about it: the sending colony and the arrival time. Subject, author,
  body, and headers are withheld — the library's in-transit records physically
  do not contain them.
- Prospero's transit is 0, so `X-Arrives == Date` for his articles. Others have
  noticed.
- An article missing a usable `X-Arrives` is treated as having arrived when it
  was written.

The gate accepts an injected "now" for testing (see `flowers_now`). Production
passes nothing and gates against real UTC.

## 5. Era display

Timestamps are **stored** as real UTC and **rendered** with the relay's
`eraOffsetYears` offset from `relay.json` (+1016), matching the inspection-plate
canon: `2026-08-04` displays as `4 Aug 3042`. Nothing on disk is ever written in
era time; arithmetic, gating, and sorting all happen in real UTC and the offset
is applied at the last moment, by the renderer only.

## 6. relay.json

```json
{
  "eraOffsetYears": 1016,
  "group": "colonies.music.flowers",
  "nodes": {
    "kolob": { "title": "The Rim of Kolob's Light", "transitDays": 2, "origin": "21:847/1847" }
  },
  "jitterFrac": 0.2
}
```

`transitDays` is the nominal upload delay for the node; `jitterFrac` is the
fraction of that delay by which a real `X-Arrives` may vary (so a 2-day colony
lands within roughly ±0.4 days of nominal). `origin` is the node's FidoNet-style
address as it appears on its Origin line. Unknown node keys degrade gracefully:
the reader falls back to the raw key as a title.

## 7. Library API — `flowers-lib.php`

Pure PHP, no dependencies, no I/O beyond reading `relay.json` and the spool.
Every entry point is defensive; malformed input yields `null` or an empty array,
never a fatal.

### Configuration

| Function | Returns |
| --- | --- |
| `flowers_load_relay($path = null)` | Relay config array, defaults merged. Defaults to `relay.json` beside the library. |
| `flowers_node($relay, $colony)` | `['key','title','transitDays','origin']` or `null`. |
| `flowers_colony_title($relay, $colony)` | Display title for a node key. |

### Time

| Function | Returns |
| --- | --- |
| `flowers_now($now = null)` | UTC `DateTimeImmutable`. Accepts `null` (real now), a `DateTimeInterface`, a unix int, or a date string — the testing seam for arrival gating. |
| `flowers_parse_time($value)` | UTC `DateTimeImmutable` or `null`. |
| `flowers_era_date($when, $relay, $format = 'j M Y')` | Era-shifted date string, e.g. `4 Aug 3042`. |
| `flowers_era_datetime($when, $relay)` | e.g. `4 Aug 3042 09:40 UTC`. |

### Parsing

| Function | Returns |
| --- | --- |
| `flowers_parse_article_text($text, $seq = '')` | Article record or `null`. |
| `flowers_parse_article_file($path)` | Article record or `null`. |
| `flowers_load_spool($dir)` | Articles keyed by `Message-ID`, sequence ascending. Duplicate IDs: lowest sequence wins. |

Article record:

```
seq            "000003"                      message_id   "<000003.rim-kolob@…>"
file           "000003.msg"                  references   [ "<000001.…>", … ]
headers        lowercased assoc              parent_id    last reference or null
header_order   display-cased names           subject      string
from           raw From header               from_name    display name
from_email     address                       newsgroups   string
colony         "kolob"                       admin        bool
date           DateTimeImmutable|null        arrives      DateTimeImmutable|null
path           bang-path string
body           string (sig + origin removed) body_lines   array of lines
sig_lines      array of lines                origin       " * Origin: …" or null
```

### Gating

| Function | Returns |
| --- | --- |
| `flowers_has_arrived($article, $now = null)` | bool. |
| `flowers_arrived($articles, $now = null)` | Visible articles, keyed by `Message-ID`. |
| `flowers_in_transit($articles, $now = null, $relay = null)` | List of `['colony','colony_title','arrives','arrives_display']`, arrival ascending. **These four fields are the entire disclosure surface for unarrived mail.** |

### Threading

| Function | Returns |
| --- | --- |
| `flowers_build_threads($articles)` | List of root nodes; each node is an article record plus `children` (list) and `depth` (int, 0 at root). |
| `flowers_flatten_thread($node)` | Depth-first list of nodes, root first, `children` emptied. |
| `flowers_thread_count($node)` | Article count in the thread. |
| `flowers_thread_latest($node)` | Latest arrival in the thread, unix int. |
| `flowers_find_article($articles, $key)` | Lookup by `Message-ID` or sequence (`"000003"`), or `null`. |

### Rendering

All output is HTML-escaped. The library emits structure and class names only;
colour, type, and ornament belong to the skin.

| Function | Emits |
| --- | --- |
| `flowers_render_headers_html($article, $relay = null, $show_raw = false)` | `div.tf-headers` containing `div.tf-hdr.tf-hdr-<slug>` rows, each with `span.tf-hdr-name` + `span.tf-hdr-value`. `Date`/`X-Arrives` are era-shifted; `$show_raw` appends the stored UTC value in `span.tf-hdr-raw`. |
| `flowers_render_body_html($article)` | `pre.tf-body` of `span.tf-line` lines; quoted lines add `tf-quote` and `tf-quote-N` (N = 1–3). Signature in `span.tf-sig` (separator `span.tf-sig-sep`), Origin line in `span.tf-origin`. |
| `flowers_render_line_html($line)` | A single body line, same rules. |
| `flowers_article_summary($article, $relay = null)` | Pre-escaped strings for an index row: `seq, id, subject, author, colony, colony_title, arrived, written, admin`. No markup. |
| `flowers_e($s)` | `htmlspecialchars` with `ENT_QUOTES`, UTF-8. |

Class-name contract for skins: `tf-headers`, `tf-hdr`, `tf-hdr-name`,
`tf-hdr-value`, `tf-hdr-raw`, `tf-body`, `tf-line`, `tf-quote`, `tf-quote-1..3`,
`tf-sig`, `tf-sig-sep`, `tf-origin`. Admin distinction is the caller's to apply,
from the record's `admin` flag.

## 8. Reader page

`index.php` is a plain, unstyled functional reader — the substrate's proof, not
its face. Two constants at the top govern it:

- `SPOOL_DIR` — currently `mockups/sample-spool/`; flip to `spool/` for live
  traffic.
- `FLOWERS_NOW` — a pinned clock so the sample spool's in-transit article stays
  in transit. **Must be `null` for the live spool**, which gates against real
  UTC.

It renders the thread index, `?article=<seq>` article views with the full header
block, an admin distinction for operator posts, and the inbound traffic line.
Articles that have not arrived are unreachable by `?article=` — gating is
applied before lookup, not after.

## 9. Harness

```
php _check.php [spool-dir] [now]
```

Parses a spool, prints a per-article table (state, written, arrives), the thread
trees, the inbound disclosure lines, and a verdict block with assertions:
every file parsed, gating consistent, era offset applied, in-transit records
leaking nothing, malformed input surviving. Exit 0 on pass.

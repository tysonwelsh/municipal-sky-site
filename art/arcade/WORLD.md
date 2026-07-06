# WORLD.md — the bible

Canon for the (as-yet-unnamed) Appalachian arcade universe: a
Chuck-E-Cheese-esque entertainment complex in the fog of a swampy holler,
presided over by an animatronic possum. It only appears on moonlit nights,
to people who got lost, and sometimes it isn't there at all.

Everything decided *incidentally* while building machines gets written down
here the day it's decided. Ten cabinets stay one building only if the
details stop contradicting each other.

---

## The economy law

- **Tokens** are the play money. Every machine eats tokens. Their in-lore
  name is deliberately open; the save key is `tokens` and stays that way
  regardless of what the marquee painters eventually call them.
- **Scrip** is the pink paper tickets — won at skill games, spent at the
  redemption counter. The name is dead-on historically: company scrip was
  money that's only money inside the company store.
- Skill games (skee ball) convert tokens into scrip.
- The coin pusher is a closed token loop: tokens in, tokens out, and
  sometimes it drops the counter's own merchandise directly.
- In-universe, tokens come from a **changer by the front door** (nickels
  in). Until it's built, a first visit seeds the save with a starter
  pocket of 20 tokens.

## The save document

One localStorage key, `holler.v1`, owned by `arcade-core.js`:
`tokens`, `scrip`, `inventory` (array of prize ids), `games` (per-game
stats bags), `flags` (world memory — see below).

**Flags are story hooks.** Machines journal what the player has witnessed
(`coinpusher.saw-the-snake`, `coinpusher.got-the-eye`). The eventual RPG
reads them; an NPC can already know. Games write flags liberally; the RPG
decides later which ones matter.

## The venue

- **Name:** TBD.
- **Mascot:** an animatronic **possum**. Name TBD — candidates: Pawpaw,
  Burl, Ezekiel "Zeke". Presides over the whole venue (and the skee ball
  machine's backstop).
- Each machine gets its own Appalachian critter, animatronic or costumed.
- Palette of the night: dark blues, bruised purples, black, fog grey;
  electric pink and bone white accents (`arcade-palette.js`).
- **13 is the house number.** Bonuses of 13, labels that say 13. Always 13.
- A scratched-out **coal & land company** predates the arcade; its plaques
  and equipment turn up retrofitted into the machines. Its name is never
  legible. (Leaning: it stays that way forever.)

## The machines

| Machine | Folder | Critter | Eats | Pays |
|---|---|---|---|---|
| HOLLER ROLLER (skee ball) | `/art/skeeball/` | possum | tokens¹ | scrip |
| SCRIP CREEK² (coin pusher) | `/art/coinpusher/` | raccoon (name TBD: Denver, Tarnish, Miss Penny) | tokens | tokens + prizes |

¹ once retrofitted onto arcade-core (coin pusher plan §7, milestone 5);
today it's free to play.
² marquee is a misnomer — the machine pays no scrip. Rename candidates or
keep-it-as-a-lie decision parked (coin pusher plan §8).

Known machine lore: the pusher's raccoon takes exactly one token from
every big payout (the animals get paid). One token in the pusher's tray is
welded down by corrosion and will never move.

## The prize registry

The single catalog of winnable objects. The redemption counter (future),
the pusher's cargo, and the RPG inventory UI all read from this table.
Counter prices are in scrip.

| id | name | counter price | notes |
|---|---|---|---|
| `fortune` | folded paper fortune | 13 | not unique; each is a one-line fortune, vaguely load-bearing |
| `arrowhead` | arrowhead | 55 | dug locally. by whom, it doesn't say |
| `mason-jar` | mason jar | 113 | the label says 13. of what, it doesn't say |
| `glass-eye` | the glass eye | NOT FOR SALE | unique; display case only. the pusher drops it anyway. sets `coinpusher.got-the-eye` |

(Grows as machines and the counter demand. Buffalo-head tokens are coins,
not prizes — worth 5 plain tokens, only ever two in the pusher's field.)

## Open questions

- Venue name; possum name; raccoon name; what tokens are called.
- How players earn tokens before the changer exists (starter pocket of 20
  covers the first sessions; a token in the coin return if you check it?).
- The pusher marquee misnomer (rename vs. lie).
- The 1924 Mercury dime as a once-ever silent collectible.

# MOTHER LODE — the eggs (2026-09-28)

Secret things the machine does. None is announced anywhere on the page, and
none explains itself. Each is canon-safe (see `../arcade/WORLD.md` and
`../arcade/HEART.md`: 13 is the house number; the coal & land company's name
is never legible; the pit mule stays absent; the machine at the end of the
hall is only pointed toward, never duplicated). Each is harmless to the game:
it never costs a marble or changes a score. Each is one switch to remove, in
`EGGS` at the top of `pachinko-main.js`. HOLLER ROLLER's eggs are in
`../skeeball/EGGS.md`; none of these repeats one of them.

| # | Egg | How you find it | What happens | Flag / save |
|---|---|---|---|---|
| 1 | **The knock on the glass** | Play more than one game in a visit. It comes once a visit, in the quiet after a game's last marble: about one game in two until it has happened. Never in a visit's first game, never after a mother lode, never while the mine is up to mischief. | Tobias, the lantern man, stops. He turns round to face the glass, the only time any of the crew is ever seen from the front, and the rest of them play dead. He walks up to the glass and grows as he comes, in the room's own perspective. His lantern hangs low and his face stays dark until he lifts it. He looks out at you and knocks three times on the glass from the inside. His hand opens flat on the pane, and he waits with his head on one side. Then he lowers the lamp, turns his back and walks to his post as if nothing had happened. The crew come round and the payout begins. His knuckle prints stay on the inside of the glass for the rest of the visit. Knock back (click the glass) while he waits, and he gives you one small nod. | `pachinko.knocked-on-the-glass` |
| 2 | **Hung the moon** | In ATTRACT (or while the crew work), tap the painted moon. | The moon is a cut-out on a nail near its top. It swings, then settles crooked, showing the primer the painters left behind it and the pencil line they drew it by. It hangs crooked, through a game if you start one, until Absalom (who takes his cap off to that moon) walks the ridge to it, reaches up and puts it straight. He steps back and doffs his cap to it. | `pachinko.hung-the-moon` |
| 3 | **Two bits** | Tap "shave and a haircut" on the glass: five taps, long, short-short, long, long. | Two beats later, somewhere in the rock, a light comes and goes twice: two knocks, exactly on the beat. Someone in there couldn't help himself. | `pachinko.two-bits` |
| 4 | **The fortune fish** | Hold a finger on the glass over the red cellophane fish in the rock (Fig. 12) for about a second. | It warms and quivers. Then it lies out stiff as a needle and swings round like one, until it points out of the case to the right and a little up: down the back hall, where one machine is still lit after closing. It tells no fortune. Let go and it curls again where it lies. A few seconds later, when nobody's looking, it's as it was. (A hold on the fish isn't a tap on the glass: nobody plays dead or points across it while it swings.) | `pachinko.the-fish-pointed` |
| 5 | **The back of the card** | Watch the legend card when it's lit from behind: Tobias reading it by lantern from a rope ladder, or a marble going down the old drift behind it. | The card was cut from something else first. Through the paper, the wrong way round, a child's crayon drawing shows in the light: a big figure with a light on his cap, holding a small one's hand, and a sun, coloured in hard. Nobody says whose. | `pachinko.saw-the-drawing` |
| 6 | **Welcome back** | Come back another night: open the page with a save that has played MOTHER LODE before. | The first time the lantern man comes out to show you where the token goes, he doesn't. He lifts his lantern to you, up and down twice (on the railroad that means "go ahead"), and holds it up a moment. | `pachinko.welcomed-back` |
| 7 | **For scale** | Play your 13th game on this machine (ever, across visits). | On the legend card, beside the typed man for scale, someone has pencilled in a second little man and corrected the note: `<MAN` now reads `<MEN`. It stays. | `pachinko.for-scale` |
| 8 | **Wave at the train** | In ATTRACT or WORK, tap the little painted train on the middle ridge. | Its headlamp blinks twice, each time with a short puff of steam: two short toots, the railroad's "acknowledged". The engineer waves back, about once every twelve seconds (he's working). | `pachinko.waved-at-the-train` |
| 9 | **Moon nights** | Play on a night of a real full moon (within 12 hours of it, local clock; read once, at mount). | When Absalom goes to look at the moon, he walks to the far end of the ridge, turns his back on the painted one, and takes his cap off toward the room's window, where the real one is. He goes to look more often than usual. | `pachinko.moon-night` |

## Rules for all of them

- **Deterministic.** No `Math.random`, no `Date` in the sim, the mischief,
  the knockers or the render. Egg 9 reads the clock once, in main at mount,
  and passes a flag (HOLLER ROLLER's own reckoning of the full moon); the
  harness never sees it.
- **Misfire-tested.** Three visits of normal play: 68 games in all, with
  novice drops, the drift route, one spot spammed, the pockets and a sweep,
  fast streams and slow, and 74 casual taps anywhere on the glass between
  games. They fire none of the eggs except by their real condition: the knock
  once a visit (games 4, 3 and 3, never in a first game or a lode game), and
  for scale at the 13th game ever. The test is
  `local-dev/pachinko-lab/w6s/misfire.js`; the numbers are in
  `local-dev/pachinko-lab/reports/wave6-secrets.md`.
- **One switch each**, in `EGGS` in `pachinko-main.js`: `glassKnock`,
  `hungTheMoon`, `twoBits`, `fortuneFish`, `crayon`, `welcomeBack`,
  `forScale`, `trainWave`, `moonNight`. The parts read them as `api.eggs`,
  and the art as `view.eggs`.
- **The rare tier is untouched.** `mischief.rare` still returns false. None
  of these hands the player an object: the story objects belong to the
  adventure game.

## Where they live

- `pachinko-main.js`: the switches, the visit's once-only state
  (`visit`), the knock's trigger and hold, where a tap lands (the moon, the
  train), the rhythm, the hold on the fish, the 13th game, the one clock read.
- `pachinko-knockers.js`: the knock's performance (`glassKnock`), the crew
  playing dead around it (`S.hush`), the moon's swing and Absalom's repair,
  the two knocks out of the rock, the welcome, the real moon.
- `pachinko-art-secrets.js`: the close-up of the one at the glass (painted
  again at every size, never a scaled sprite), his shadow, his knuckle
  prints, the moon on its nail, the fish, the crayon, the pencilled man, the
  train's answer.
- `pachinko-mischief.js`: `quiet(t)`, so that the knock never comes during
  mischief.

## The harness (`?harness=1`)

`?force=glassknock` (the knock in the first game), `H.glassKnock()` (the
knock now), `H.press(x, y)` / `H.release()` (taps and the fish's hold),
`?returning=1` (welcome back), `?ever=13` (for scale), `?moon=1` (a moon
night).

## Sound

Every egg emits its own event (`glassknock`, `moon`, `twobits`, `fish`,
`trainwave`, `forscale`, `figure greet`, `figure capoff {real}`). What each
should sound like is in `local-dev/pachinko-lab/requests.md` under "for the
sound designer: secrets".

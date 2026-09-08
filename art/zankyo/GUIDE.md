# ZANKYŌ — the owner's guide to what makes a night

*Plain language. What decides how a playthrough sounds, what the words in
the activity log mean, and which levers you can actually pull. Written
2026-09-07 against 2.1.0-rc.47. The kanji in the log are the same ones used
here, so you can match what you hear to a line in this page.*

---

## 1. How a night is decided, from the top down

Think of it as five decisions, each drawn from the seed, each narrowing the
next.

1. **The seed.** Everything musical comes from one number, shown in the
   address bar and the log. Same seed, same night, forever. Change the seed
   and you get a different night; share the address and someone else hears
   yours.
2. **Home or far.** The seed draws a *distance* from 0 to 1. Four nights in
   five draw under 0.15 and are **home**: the engine exactly as you approved
   it. One in seven goes moderately out; one in twenty goes far (above 0.7);
   one in fifty is *interstellar* (above 0.85), where several departures
   stack and the night gets a name. The hidden switch forces a far night;
   `?far=0.9` in the address does the same from a link.
3. **The cycle.** A night is an unbounded chain of cycles, five to ten
   minutes each. Every cycle draws a **kind** (§3), which voices are
   **seated** (some sit out), a **mode** (one of the four dark pentatonics,
   with the key drifting by sea change every few cycles), and where the slow
   **tide** is, the multi-cycle swell that leans the whole night darker or
   lighter.
4. **Inside the cycle: jo-ha-kyū.** The slow entrance (jo), the scattering
   and building (ha), the rush and the wall (kyū), then the **KIRU** — the
   cut — and a hush. The bargraph shows where you are. The **air** decides
   who may speak: one voice at a time in the jo, more as the kyū builds;
   the drones never claim it. The **motif engine** decides what they say:
   three ideas per cycle, developed, answered, mirrored, ghosted into the
   next cycle.
5. **Guests and signals.** About one cycle in three carries a guest (§4);
   about two broadcasts a cycle arrive from the reel pool (§5). On far
   nights, the **departures** (§2) are layered over all of this.

## 2. Far nights: the departures and the five named nights

A far night unlocks departures past their own distance threshold and draws
a few of them (with rules about which cannot share a night). There are 24,
in five families. The log shows each one's kanji as it fires.

**音律 Tuning** — what pitch means tonight
- 撓 sagging clock (0.15): the octave stretches or shrinks a little; everything stays in tune with itself, not with a piano.
- 耳 koto by ear (0.30): the plucked strings tune to pure intervals while the flute stays tempered — a real ensemble's disagreement.
- 減 meri quarter-tones (0.40): the flute's bent notes split into quarter-tones.
- 双 two modes at once (0.60): one voice in one mode, another a tritone away.
- 螺 the spiral (0.75): the key glides continuously and never arrives.

**時間 Time**
- 遅 dilation (0.25): a cycle at 0.4× (glacial) or 2.5× (frantic).
- 弛 varispeed (0.50): the whole station sags in pitch and time like a dying tape, then crawls back.
- 影 tempo canons (0.60): the same idea in three plucked voices at 3:4:5 speeds — they converge, pass, diverge.

**形 Form**
- 蝕 eroded arc (0.30): the cycle runs backwards from the wall, or never arrives, or peaks twice.
- 未斬 the KIRU fails (0.50): the cut does not come; the wall runs into the next cycle's opening.
- 間 ma inverted (0.40): silence is the material; sound is the interruption.
- 崩 disintegration (0.65): one fragment loops like a locked groove and decays pass by pass until only the room is left.

**合奏 Ensemble**
- 重 heterophony at scale (0.35): all five voices read the same phrase at once, each its own way.
- 多 polymeter (0.40): the three drums in 3 against 4 against 7.
- 継 hocket (0.45): one melody split note by note across every voice.
- 鏡 strict mirror (0.50): every phrase answered by its exact upside-down-backwards.
- 群 swarm (0.55): six to ten entries at short delays — micropolyphony.
- 雲 clouds (0.70): the plucked bodies as clouds of glissandi, hundreds of short notes.

**音色 Spectrum**
- 金 metal (0.35): the shō ring-modulated, the bells and koto through FM — gong-like, still pitched.
- 逆 reverse (0.40): plucks that swell, breaths that end in their attack.
- 凍 freeze (0.50): a shakuhachi note held into a drone for a minute.
- 騒 noise leads (0.60): the noise vocabulary becomes the soloist; the voices become texture.
- 相 phasing (0.60): two copies of a signal drift out of phase (Reich) instead of the normal tune-in.
- 室 the reel as the room (0.70): a two-second slice of a broadcast becomes the reverb the whole station plays through.

**The five named nights** (only above 0.85, named by the strangest thing present):
- 渦 **the vortex** — clouds or swarm on top.
- 崩 **the collapse** — disintegration, the eroded arc, or the failed cut.
- 凍 **the freeze** — the frozen note or inverted ma.
- 鏡 **the mirror** — the mirror, hocket, or heterophony.
- 塵 **the dust** — noise leading, metal, reverse, phasing, or the reel as the room.

Also on far nights: chant and drone reels are bent into the station's key
(同調 in the log), or, past 0.5, the station modulates toward the chant.

## 3. Cycle kinds (every night, home or far)

- 常 **ordinary** — the standard arc.
- 儀式 **rite** — a long ceremonial opening, shō-heavy.
- 漂流 **drift** — ambient-heavy; the kyū barely arrives.
- 嵐 **storm** — a short opening, a noise wall, a taiko wall.
- 沈黙 **silence** — mostly ma; the cut cuts nothing.
- 放送 **broadcast** — comms and PA heavy; static-gated.

Seating is drawn per cycle too: a koto-led cycle, a shakuhachi-only jo, a
taiko-led cycle, or a "dead station" of drones and ambient only. Every voice
rests about one cycle in four.

## 4. Guests (visitations), about one cycle in three

- 祭 **the festival** — the taiko goes to a full matsuri pattern with kakegoe shouts through the broken PA.
- 無 **mu** — a whole cycle of reactor and ambient only; the KIRU then cuts silence. The next cycle has voices by rule.
- 回線 **the line** — the PA and the comms trade a conversation over static; nothing else speaks.
- 鐘 **the tolling** — the temple bell every ~20 s across the whole opening.
- **The lost broadcast** — the synthesized gagaku fallback, heard only when a real reel has not loaded.

## 5. Signals (the broadcasts)

About two per cycle, never during the cut or the hush, never on top of a
guest, at least 90 s apart, about one in five landing in the opening. The
pool is 207 reels from 81 countries; pictures are favored 1.5× over audio-
only reels, so a numbers station or the Buzzer surfaces roughly every fifty
minutes. A reel rests three cycles after it plays. The log line reads
「受信 · title · year」 and 「消失 · signal lost」.

## 6. The levers you can pull

**In the address bar**
- `?seed=N` — pin a night.
- `&far=0.9` — force its distance (0.05 home … 0.95 interstellar).

**On the panel**
- The odd slat in the bottom-left vent — the hidden switch: restart on a far night, seed written to the address.
- The small knob on the CRT-9 chin — scan for a signal while playing; audition a full reel window while stopped.
- The square button beside it — a video reel now, then cold for 45–60 s.
- Console rows — each instrument's volume, mute, rate and character knobs.

**In the code (say the word and I move them)**, the listener-facing constants:
| what | today | what it changes |
|---|---|---|
| far-night frequency | 80 % home / 15 % moderate / 5 % far / 2 % interstellar | how often a night goes strange |
| home lift | 1 night in 12, one cycle, Poisson mean 5 | how often an ordinary night has one strange cycle, and how early |
| broadcasts per cycle | ~2 (1.7 achieved) | how often the set lights up |
| opening share P(jo) | 0.20 | how often a cycle opens with a signal (about 4 in 10 cycles today) |
| video weight | 1.5× | pictures vs audio-only reels |
| reel rest | 3 cycles | how soon a reel can repeat |
| default volumes | hichiriki 0.26, taiko 0.43, ambient 0.96, others as the console shows | the mix at load |
| harshness gate | off above 0.85, loosened 0.7–0.85 | how much "pain" far nights may have |
| loudness ceiling | hard everywhere | nothing gets louder to sound stranger |

## 7. Reading the activity log

Each line is 「kanji · what · detail」. The mode line names the key and the
cycle kind; ◆ marks a motif being developed (with its generation), ⇄ a
voice answering another, ✸ the theme restated before the cut, 残 a ghost
carried across the cut, 斬 the KIRU with its severity, 逸脱 the night's
distance and departures, 受信 / 消失 a signal arriving and lost, 同調 a reel
tuned to the key, 祭 無 回線 鐘 the guests.

## 8. Glossary of the crew's words

- **KIRU** 斬 — the cut at the end of the kyū: the landscape drops, the hush, a bell.
- **ma** 間 — the silence between; structural, not empty.
- **jo / ha / kyū** — slow entrance / scattering and building / the rush.
- **the air** — the rule for who may speak at once.
- **seating** — which voices are present this cycle; also where a broadcast or guest is placed.
- **the tide / meta-tide** — the slow swell across cycles that leans nights dark or light.
- **sea change** — a key change between cycles.
- **distance (d)** — how far a night is from home, 0 to 1.
- **departure** — one of the 24 far-night behaviors above.
- **lift** — one cycle of an ordinary night pulled out, or of a far night pulled back.
- **reel / window** — a stored broadcast source / one 12-second piece of it that the station plays.
- **Tier A / B** — free to use / copyrighted, played under the fair-use posture with the takedown flag.
- **home identity / byte-identical** — the promise that ordinary nights do not change unless we decide they do.
- **re-base** — re-taking that promise's reference after a deliberate change.
- **ceiling / tripwire** — the loudness limit that never moves / the roughness alarm.

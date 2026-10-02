<?php
// ============================================================================
// TROMBONE LAB — audition bench for KOLOB 2's trombone choir at dawn: the
// alto, tenor and bass trombones alone, the four-part choir against the
// organ's level reference, and the whole dawn exchange (a far choir, a near
// one answering) over a chorale in any of Kolob's six modes. UNLINKED dev
// tool (reachable only by its URL, /art/kolob/trombone-lab), like the
// instruments lab. Everything plays through the app's own master chain and
// a limiter, never louder than the app; CHECK renders offline and measures.
// ============================================================================
$page_title = "Trombone Lab — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's trombone choir at dawn.";
function ktl_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />

<style>
/* Scoped to .ktl-* so it never leaks into the rest of the site. */
.ktl {
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.66);
  --ink-faint: rgba(30, 77, 59, 0.26);
  --paper: #f5f0e4;
  --paper-2: #ece5d3;
  --gilt: #8a7a45;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 960px;
  width: 100%;              /* the site's body is a column flex: without a width the card is sized to its widest table, and the page scrolls sideways after a check (the round-2 critic) */
  box-sizing: border-box;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
.ktl * { box-sizing: border-box; }
.ktl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.ktl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.ktl-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.ktl-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }

.ktl-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.7rem 1.1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.8rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem;
  position: sticky; top: 0; z-index: 2;
}
.ktl-controls label, .ktl-row label { display: flex; align-items: center; gap: 0.45rem; }
.ktl input, .ktl select, .ktl button { font-family: inherit; font-size: 0.95rem; color: var(--ink); }
.ktl input[type="number"] { width: 6.5em; padding: 0.2rem 0.35rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; }
.ktl select { padding: 0.2rem 0.3rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; max-width: 100%; min-width: 0; }
.ktl button {
  padding: 0.4rem 1rem; cursor: pointer; min-height: 2.2rem;
  background: var(--paper); border: 1px solid var(--ink-soft); border-radius: 4px;
}
.ktl button:hover { background: #faf6ec; }
.ktl button:disabled { opacity: 0.5; cursor: wait; }
.ktl-play { font-weight: 600; }
.ktl-check { font-style: italic; }
#ktl-meter { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 11em; }

.ktl-card { border-bottom: 1px solid var(--ink-faint); padding: 1rem 0.2rem 1.1rem; }
.ktl-name { font-size: 1.3rem; font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; margin: 0 0 0.15rem; }
.ktl-phrase { margin: 0 0 0.6rem; font-style: italic; color: var(--ink-soft); max-width: 70ch; }
.ktl-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.9rem; }
.ktl-stat { margin: 0.5rem 0 0; font-size: 0.88rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.ktl-report { margin-top: 0.4rem; }
.ktl-meas { font-size: 0.86rem; margin: 0 0 0.4rem; color: var(--ink); font-variant-numeric: tabular-nums; }
.ktl-spec { display: block; width: 100%; max-width: 640px; height: auto; border: 1px solid var(--ink-faint); border-radius: 3px; }
.ktl-plan { font-size: 0.9rem; margin: 0.5rem 0 0; padding-left: 1.2rem; color: var(--ink); }
.ktl-plan li { margin: 0.1rem 0; }
.ktl-plan .far { color: var(--ink-soft); }
.ktl-scroll { overflow-x: auto; max-width: 100%; }
.ktl-table { border-collapse: collapse; font-size: 0.86rem; font-variant-numeric: tabular-nums; margin: 0.5rem 0; }
.ktl-table th, .ktl-table td { border-bottom: 1px solid var(--ink-faint); padding: 0.2rem 0.55rem; text-align: right; white-space: nowrap; }
.ktl-table th:first-child, .ktl-table td:first-child { text-align: left; }
.ktl-table th { font-weight: 600; font-variant: small-caps; letter-spacing: 0.03em; }
.ktl-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.2rem; max-width: 70ch; }
@media (max-width: 560px) {
  .ktl-title { font-size: 1.6rem; }
  .ktl-controls { position: static; }
  .ktl-row label { width: 100%; }
  .ktl-controls label { width: 100%; justify-content: space-between; }
  /* a menu as long as THE PROMISED LAND shrinks to the phone, not the reverse */
  .ktl-controls label > select, .ktl-controls label > input { width: 12.5rem; max-width: 100%; }
}
</style>

<div class="ktl">
  <header class="ktl-head">
    <p class="ktl-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="ktl-title">Trombone Lab</h1>
    <p class="ktl-lede">The trombone choir at dawn, after the Moravians of Bethlehem (1754) and the Salem
    Easter sunrise (1772): a choir far across the settlement plays a line of the day's first hymn as a
    slow chorale, and a nearer choir answers the next line from the other side. Everything plays in just
    intonation through the app's own master chain, in the app's rooms, never louder than the app.
    <strong>check</strong> renders offline and measures.</p>
  </header>

  <div class="ktl-controls">
    <label>seed <input type="number" id="ktl-seed" value="1847" /></label>
    <label>mode
      <select id="ktl-mode">
        <option value="ionian" selected>ionian</option>
        <option value="mixolydian">mixolydian</option>
        <option value="dorian">dorian</option>
        <option value="aeolian">aeolian</option>
        <option value="hexa">hexatonic</option>
        <option value="penta">pentatonic</option>
      </select>
    </label>
    <label>chorale
      <select id="ktl-source">
        <option value="sample" selected>sample hymn · harmonized here</option>
        <option value="engine">sample hymn · the engine's Harmony</option>
      </select>
    </label>
    <label>keynote <input type="number" id="ktl-key" value="260" min="200" max="320" step="1" /></label>
    <label>room
      <select id="ktl-room">
        <option value="wide" selected>tabernacle (St Margaret's)</option>
        <option value="close">meetinghouse (short)</option>
        <option value="dry">dry</option>
      </select>
    </label>
    <button type="button" id="ktl-stop">stop</button>
    <span id="ktl-meter">out —</span>
  </div>

  <div id="ktl-cards"></div>

  <p class="ktl-footnote">The seed moves the performance (how many exchanges, the pace, which side the far
  choir stands on, how far, how loud, whether it joins the last chord) and the players' detune — the chorale
  itself comes from the mode and the source. “The engine's Harmony” is v0.32's own four-part engine
  harmonizing the same sample hymn, captured from the harness: the chords the engine would pass today.
  The Earth tunes play every part their source prints. The level reference is the v0.30 organ as the prelude
  plays it (the instruments lab's, line for line); the four-part choir at <em>mf</em> is calibrated to it.
  <strong>check</strong> reports loudness (LUFS, integrated and the loudest 3&nbsp;s), peak, clipped samples and
  clicks (bursts above 4&nbsp;kHz that stand 21.6&nbsp;dB clear of the 30&nbsp;ms either side, down to
  −100&nbsp;dBFS); for the dawn it also measures each phrase: its loudness, its brightness and which side it
  stands on.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo ktl_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo ktl_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo ktl_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-voices-band.js?v=<?php echo ktl_v('kolob-voices-band.js'); ?>"></script>
<script src="kolob-guest-room.js?v=<?php echo ktl_v('kolob-guest-room.js'); ?>"></script>
<script src="kolob-guest-trombones.js?v=<?php echo ktl_v('kolob-guest-trombones.js'); ?>"></script>
<script src="trombone-lab.js?v=<?php echo ktl_v('trombone-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

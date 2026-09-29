<?php
// ============================================================================
// GUESTS LAB 3c — audition bench for KOLOB 2's round-3c pair: THE SOCIAL
// HALL (KOLOB.GuestSocialHall: after the benediction the benches are pushed
// back, a fiddle, a caller, a reel or a jig made of one of the meeting's own
// hymns) and THE TESTIMONY (KOLOB.Testimony: two or three of the ward rise
// and speak, and the harmonium or the clarinet takes up each speaker's
// speech-melody, so the words become music). Both play hymns and a ward the
// composer and the cast seat here. UNLINKED dev tool (reachable only by its
// URL, /art/kolob/guests3d-lab.php), like the guests lab. Everything plays
// through the app's own master chain and a limiter, never louder than the
// app; CHECK renders offline and measures.
// ============================================================================
$page_title = "Guests Lab 3c — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's Social Hall and testimony-bearers.";
function kg3_v($file)
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
/* Scoped to .kg3-* so it never leaks into the rest of the site. */
.kg3 {
  --ink: #1e4d3b; --ink-soft: rgba(30, 77, 59, 0.66); --ink-faint: rgba(30, 77, 59, 0.26);
  --paper: #f5f0e4; --paper-2: #ece5d3; --gilt: #8a7a45; --rust: #9a4a2a;
  font-family: "EB Garamond", Georgia, serif; color: var(--ink);
  max-width: 960px; width: 100%; box-sizing: border-box; margin: 0 auto; padding: 1.5rem 1rem 4rem; overflow-wrap: anywhere;
}
.kg3 * { box-sizing: border-box; }
.kg3-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.kg3-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.kg3-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.kg3-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }
.kg3-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.8rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem; position: sticky; top: 0; z-index: 2;
}
.kg3-controls label, .kg3-row label { display: flex; align-items: center; gap: 0.45rem; }
.kg3 input, .kg3 select, .kg3 button { font-family: inherit; font-size: 0.95rem; color: var(--ink); }
.kg3 input[type="number"] { width: 6.5em; padding: 0.2rem 0.35rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; }
.kg3 select { padding: 0.2rem 0.3rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; max-width: 100%; min-width: 0; }
.kg3 button { padding: 0.4rem 0.9rem; cursor: pointer; min-height: 2.2rem; background: var(--paper); border: 1px solid var(--ink-soft); border-radius: 4px; }
.kg3 button:hover { background: #faf6ec; }
.kg3 button:disabled { opacity: 0.5; cursor: wait; }
.kg3-play { font-weight: 600; }
.kg3-check { font-style: italic; }
#kg3-meter { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 9em; }
.kg3-card { border-bottom: 1px solid var(--ink-faint); padding: 1rem 0.2rem 1.2rem; }
.kg3-name { font-size: 1.3rem; font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; margin: 0 0 0.15rem; }
.kg3-phrase { margin: 0 0 0.6rem; font-style: italic; color: var(--ink-soft); max-width: 72ch; }
.kg3-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.7rem; margin: 0.35rem 0; }
.kg3-stat { margin: 0.45rem 0 0; font-size: 0.9rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.kg3-meas { font-size: 0.88rem; margin: 0.35rem 0; color: var(--ink); font-variant-numeric: tabular-nums; }
.kg3-plan { font-size: 0.92rem; margin: 0.5rem 0 0; padding-left: 1.2rem; color: var(--ink); }
.kg3-plan li { margin: 0.12rem 0; }
.kg3-scroll { overflow-x: auto; max-width: 100%; }
.kg3-table { border-collapse: collapse; font-size: 0.86rem; font-variant-numeric: tabular-nums; margin: 0.5rem 0; }
.kg3-table th, .kg3-table td { border-bottom: 1px solid var(--ink-faint); padding: 0.2rem 0.5rem; text-align: right; white-space: nowrap; }
.kg3-table th:first-child, .kg3-table td:first-child { text-align: left; }
.kg3-table th { font-weight: 600; font-variant: small-caps; letter-spacing: 0.03em; }
.kg3-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.2rem; max-width: 72ch; }
.kg3-hymn { font-size: 0.95rem; margin: 0 0 0.9rem; color: var(--ink); }
.kg3-hymn b { font-variant: small-caps; letter-spacing: 0.03em; }
.kg3-strain { font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem; line-height: 1.45; margin: 0.3rem 0; white-space: pre-wrap; color: var(--ink); }
.kg3-strain .h { color: var(--rust); font-weight: 600; }
.kg3-now { font-size: 0.95rem; margin: 0.4rem 0; min-height: 1.4em; }
.kg3-now em { color: var(--rust); font-style: normal; font-weight: 600; }
.kg3-plot { width: 100%; height: auto; display: block; margin: 0.4rem 0 0.2rem; background: #fbf8f0; border: 1px solid var(--ink-faint); border-radius: 4px; }
.kg3-legend { font-size: 0.8rem; color: var(--ink-soft); margin: 0 0 0.6rem; }
.kg3-bearer { margin: 0.8rem 0 0.2rem; font-size: 0.98rem; }
.kg3-bearer b { font-variant: small-caps; letter-spacing: 0.03em; }
@media (max-width: 560px) {
  .kg3-title { font-size: 1.6rem; }
  .kg3-controls { position: static; }
  .kg3-controls label { width: 100%; justify-content: space-between; }
  .kg3-controls label > select, .kg3-controls label > input { width: 12.5rem; max-width: 100%; }
  .kg3-strain { font-size: 0.68rem; }
}
</style>

<div class="kg3">
  <header class="kg3-head">
    <p class="kg3-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="kg3-title">The Social Hall &amp; the Testimony</h1>
    <p class="kg3-lede">Round 3c's pair. After the benediction the benches are pushed back: a fiddle, a caller, a reel or a
    jig made of one of the meeting's own hymns (Brigham Young told the Saints to dance). And at the testimony, two or
    three of the ward rise and speak, and the harmonium or the clarinet takes up each one's speech-melody until the
    words are music (after Steve Reich's <i>Different Trains</i>). Hymns and a ward are composed and seated here, in just
    intonation, through the app's own master chain, never louder than the app. <strong>check</strong> renders offline
    and measures.</p>
  </header>

  <div class="kg3-controls">
    <label>seed <input type="number" id="kg3-seed" value="4" /></label>
    <label>the Sunday
      <select id="kg3-sunday">
        <option value="ordinary">an ordinary Sunday</option>
        <option value="pioneer" selected>Pioneer Day</option>
        <option value="wedding">a wedding</option>
        <option value="christmas">Christmas</option>
        <option value="easter">Easter</option>
        <option value="conference">General Conference</option>
        <option value="fast">Fast Sunday</option>
        <option value="funeral">a funeral</option>
      </select>
    </label>
    <label>mode
      <select id="kg3-mode">
        <option value="" selected>as the hymnist likes</option>
        <option value="ionian">ionian</option>
        <option value="mixolydian">mixolydian</option>
        <option value="dorian">dorian</option>
        <option value="aeolian">aeolian</option>
        <option value="hexa">hexatonic</option>
        <option value="penta">pentatonic</option>
      </select>
    </label>
    <label>keynote <input type="number" id="kg3-key" value="262" min="200" max="320" step="1" /></label>
    <label>room
      <select id="kg3-room">
        <option value="seated" selected>as seated (where the engine will put each)</option>
        <option value="wide">tabernacle (St Margaret's)</option>
        <option value="close">meetinghouse (short)</option>
        <option value="dry">dry</option>
      </select>
    </label>
    <button type="button" id="kg3-compose">another Sunday</button>
    <button type="button" id="kg3-stop">stop</button>
    <span id="kg3-meter">out —</span>
  </div>

  <p class="kg3-hymn" id="kg3-hymn">composing…</p>
  <div id="kg3-cards"></div>

  <p class="kg3-footnote">The seed composes the day's hymns (the composer's streams <code>hymn:1:&lt;i&gt;</code>), seats the
  ward (<code>cast:1</code>) and moves each guest's performance (<code>guest:socialhall:1</code>,
  <code>guest:testimony:1</code>). <strong>check</strong> reports loudness (LUFS, integrated and the loudest 3&nbsp;s)
  against the v0.30 organ reference, peak, clipped samples, and clicks — high-frequency bursts that stand 21.6&nbsp;dB
  clear of the 30&nbsp;ms either side, counted only where no footfall, clap, bench, bow-stroke or consonant was
  scheduled. <strong>As seated</strong> plays each guest through both of the app's rooms the way the engine seats a
  layer: the Social Hall at the postlude's balance a step nearer (the benches pushed back, the room a hall), the
  testimony at the testimony's balance, the speaker as near as the still small voice. The odds run each
  <code>plan()</code> over a stand-in for the engine's planner and the calendar's Sundays.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo kg3_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo kg3_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-score.js?v=<?php echo kg3_v('kolob-score.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo kg3_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-melody.js?v=<?php echo kg3_v('kolob-melody.js'); ?>"></script>
<script src="kolob-hymnists.js?v=<?php echo kg3_v('kolob-hymnists.js'); ?>"></script>
<script src="kolob-dialects.js?v=<?php echo kg3_v('kolob-dialects.js'); ?>"></script>
<script src="kolob-composer.js?v=<?php echo kg3_v('kolob-composer.js'); ?>"></script>
<script src="kolob-calendar.js?v=<?php echo kg3_v('kolob-calendar.js'); ?>"></script>
<script src="kolob-voices-folk.js?v=<?php echo kg3_v('kolob-voices-folk.js'); ?>"></script>
<script src="kolob-voices-vocal.js?v=<?php echo kg3_v('kolob-voices-vocal.js'); ?>"></script>
<script src="kolob-cast.js?v=<?php echo kg3_v('kolob-cast.js'); ?>"></script>
<script src="kolob-guest-socialhall.js?v=<?php echo kg3_v('kolob-guest-socialhall.js'); ?>"></script>
<script src="kolob-testimony.js?v=<?php echo kg3_v('kolob-testimony.js'); ?>"></script>
<script src="guests3d-lab.js?v=<?php echo kg3_v('guests3d-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

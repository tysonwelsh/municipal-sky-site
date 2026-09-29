<?php
// ============================================================================
// GUESTS LAB 3a — audition bench for KOLOB 2's round-3c guests: the Nauvoo
// Brass Band going by (KOLOB.GuestBands: a march in strains, from the day's
// hymn, down the road past the meetinghouse), the handcart company
// (KOLOB.GuestHandcart: ALL IS WELL, walking, far off) and the gulls
// (KOLOB.GuestGulls: the first hymn's head, in the flock). Each plays hymns
// the composer writes here. UNLINKED dev tool (reachable only by its URL,
// /art/kolob/guests3a-lab.php). Everything plays through the app's own
// master chain and a limiter, never louder than the app; CHECK renders
// offline and measures.
// ============================================================================
$page_title = "Guests Lab 3a — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's brass band, handcart company and gulls.";
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
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.66);
  --ink-faint: rgba(30, 77, 59, 0.26);
  --paper: #f5f0e4;
  --paper-2: #ece5d3;
  --gilt: #8a7a45;
  --rust: #9a4a2a;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 960px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
  overflow-wrap: anywhere;
  min-width: 0;                 /* a wide table never widens the column (the site's layout is a flex) */
}
.kg3-card, #kg3-cards { min-width: 0; max-width: 100%; }
.kg3-table th { white-space: normal; }
.kg3 * { box-sizing: border-box; }
.kg3-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.kg3-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.kg3-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.kg3-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }

.kg3-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.8rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem;
  position: sticky; top: 0; z-index: 2;
}
.kg3-controls label, .kg3-row label { display: flex; align-items: center; gap: 0.45rem; }
.kg3 input, .kg3 select, .kg3 button { font-family: inherit; font-size: 0.95rem; color: var(--ink); }
.kg3 input[type="number"] { width: 6.5em; padding: 0.2rem 0.35rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; }
.kg3 select { padding: 0.2rem 0.3rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; max-width: 100%; min-width: 0; }
.kg3 button {
  padding: 0.4rem 0.9rem; cursor: pointer; min-height: 2.2rem;
  background: var(--paper); border: 1px solid var(--ink-soft); border-radius: 4px;
}
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
.kg3-badge { display: inline-block; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid var(--rust); color: var(--rust); border-radius: 3px; padding: 0.05rem 0.4rem; margin-left: 0.4rem; vertical-align: middle; font-variant: normal; }
.kg3-badge.off { border-color: var(--ink-faint); color: var(--ink-soft); text-decoration: line-through; }
.kg3-flag { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.8rem; margin: 0.4rem 0 0.2rem; font-size: 0.92rem; }
.kg3-flag code { font-size: 0.82rem; background: var(--paper-2); padding: 0.05rem 0.3rem; border-radius: 3px; }
.kg3-hymn { font-size: 0.95rem; margin: 0 0 0.9rem; color: var(--ink); }
.kg3-hymn b { font-variant: small-caps; letter-spacing: 0.03em; }


@media (max-width: 560px) {
  .kg3-title { font-size: 1.6rem; }
  .kg3-controls { position: static; }
  .kg3-controls label { width: 100%; justify-content: space-between; }
  .kg3-controls label > select, .kg3-controls label > input { width: 12.5rem; max-width: 100%; }
}

/* the road: where a band is along its crossing (a strip, west to east) */
.kg3-road { position: relative; height: 1.6rem; margin: 0.6rem 0 0.2rem; border: 1px solid var(--ink-faint); border-radius: 4px; background: #fbf8f0; overflow: hidden; }
.kg3-road i { position: absolute; top: 0.25rem; width: 0.9rem; height: 0.9rem; margin-left: -0.45rem; border-radius: 50%; background: var(--rust); opacity: 0.2; }
.kg3-road b { position: absolute; top: 0.1rem; font-size: 0.72rem; color: var(--ink-soft); font-weight: 400; }
.kg3-strains { display: flex; gap: 2px; margin: 0.4rem 0; width: 100%; }
.kg3-strains span { flex: 1 1 auto; min-width: 0; text-align: center; font-size: 0.74rem; border: 1px solid var(--ink-faint); border-radius: 3px; padding: 0.1rem 0.15rem; background: #fbf8f0; font-variant-numeric: tabular-nums; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.kg3-strains span.lit { border-color: var(--rust); color: var(--rust); font-weight: 600; }
</style>

<div class="kg3">
  <header class="kg3-head">
    <p class="kg3-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="kg3-title">Guests Lab 3a</h1>
    <p class="kg3-lede">Round 3c's first guests, from outside the windows: the Nauvoo Brass Band marching past with one of the
    day's hymns turned into a quickstep (after Ives's two bands on the Danbury green), a handcart company singing ALL IS WELL
    far across the fields, and a flock of gulls whose loudest bird is quoting the first hymn. Each plays hymns the composer
    writes here, in just intonation, through the app's own master chain, never louder than the app. <strong>check</strong>
    renders offline and measures.</p>
  </header>

  <div class="kg3-controls">
    <label>seed <input type="number" id="kg3-seed" value="2" /></label>
    <label>dialect
      <select id="kg3-dialect">
        <option value="tabernacle" selected>Tabernacle</option>
        <option value="sacredharp">Sacred Harp</option>
        <option value="psalmody">psalmody</option>
        <option value="gospel">gospel</option>
        <option value="shaker">Shaker</option>
        <option value="oldway">the Old Way</option>
      </select>
    </label>
    <label>keynote <input type="number" id="kg3-key" value="260" min="200" max="320" step="1" /></label>
    <label>room
      <select id="kg3-room">
        <option value="wide" selected>as seated (outside the windows: the tabernacle's wide send)</option>
        <option value="close">meetinghouse (short)</option>
        <option value="dry">dry</option>
      </select>
    </label>
    <button type="button" id="kg3-compose">compose another</button>
    <button type="button" id="kg3-stop">stop</button>
    <span id="kg3-meter">out —</span>
  </div>

  <p class="kg3-hymn" id="kg3-hymn">composing…</p>
  <div id="kg3-cards"></div>

  <p class="kg3-footnote">The seed composes the day's first and second hymns (the composer's streams <code>hymn:1:1</code>
  and <code>hymn:1:2</code>) and moves each guest (<code>guest:bands:1</code>, <code>guest:handcart:1</code>,
  <code>guest:gulls:1</code>): the band's key, meter, pace, road, introduction and strains; the company's verses, pace
  and road; the flock. <strong>check</strong> reports loudness (LUFS, integrated and the loudest 3&nbsp;s) against the
  v0.30 organ reference heard in the same room, peak, clipped samples, and clicks — high-frequency bursts that stand
  21.6&nbsp;dB clear of the 30&nbsp;ms either side, counted only where no drum stroke, cry or knock was scheduled.
  <strong>As seated</strong> is how the engine seats a guest from outside: into the tabernacle's wide send (the band,
  the carts and the gulls are all out in the town's air). The odds run each guest's <code>plan()</code> over 20,000
  meetings of a stand-in for the engine's planner — the calendar's Sundays, the order of service, the other guests' own
  dice and seats.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo kg3_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-clock.js?v=<?php echo kg3_v('../prosperos-jukebox-v2/pj2-clock.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo kg3_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-score.js?v=<?php echo kg3_v('kolob-score.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo kg3_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-melody.js?v=<?php echo kg3_v('kolob-melody.js'); ?>"></script>
<script src="kolob-hymnists.js?v=<?php echo kg3_v('kolob-hymnists.js'); ?>"></script>
<script src="kolob-dialects.js?v=<?php echo kg3_v('kolob-dialects.js'); ?>"></script>
<script src="kolob-composer.js?v=<?php echo kg3_v('kolob-composer.js'); ?>"></script>
<script src="kolob-calendar.js?v=<?php echo kg3_v('kolob-calendar.js'); ?>"></script>
<script src="kolob-voices-band.js?v=<?php echo kg3_v('kolob-voices-band.js'); ?>"></script>
<script src="kolob-voices-folk.js?v=<?php echo kg3_v('kolob-voices-folk.js'); ?>"></script>
<script src="kolob-voices-vocal.js?v=<?php echo kg3_v('kolob-voices-vocal.js'); ?>"></script>
<script src="kolob-guest-trombones.js?v=<?php echo kg3_v('kolob-guest-trombones.js'); ?>"></script>
<script src="kolob-guest-bands.js?v=<?php echo kg3_v('kolob-guest-bands.js'); ?>"></script>
<script src="kolob-guest-handcart.js?v=<?php echo kg3_v('kolob-guest-handcart.js'); ?>"></script>
<script src="kolob-guest-gulls.js?v=<?php echo kg3_v('kolob-guest-gulls.js'); ?>"></script>
<script src="guests3a-lab.js?v=<?php echo kg3_v('guests3a-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

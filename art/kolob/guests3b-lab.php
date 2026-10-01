<?php
// ============================================================================
// GUESTS LAB 3B — audition bench for two of KOLOB 2's guests (dev,
// unlinked; reachable only by its URL, /art/kolob/guests3b-lab.php):
//   · VARIATIONS ON A HYMN (KOLOB.GuestVariations, the organist's own
//     Organist.variations): the Sunday's organist takes a hymn the composer
//     writes here through three to five characters on the pipe organ;
//   · CHANGE RINGING (KOLOB.GuestChanges): a far tower's band rings rounds,
//     Plain Hunt or Plain Bob and rounds again — the steeples' variant — with
//     the rows drawn as the ringers draw them (the treble's red line, a
//     working bell's blue line) and verified.
// Everything plays through the app's own master chain and a limiter, the
// organ into the engine's organ layer at the owner's 0.40, never louder than
// the app. CHECK renders offline (silent) and measures the loudness against
// the engine's organ reference, clicks, and the two keys of the interlude.
// ============================================================================
$page_title = "Guests Lab 3B — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's organ variations and far-tower change ringing.";
function k3b_v($file)
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
/* Scoped to .k3b-* so it never leaks into the rest of the site. */
.k3b {
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.66);
  --ink-faint: rgba(30, 77, 59, 0.26);
  --paper: #f5f0e4;
  --paper-2: #ece5d3;
  --gilt: #8a7a45;
  --rust: #9a4a2a;
  --blue: #2b5c9a;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 960px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
  overflow-wrap: anywhere;
}
.k3b * { box-sizing: border-box; }
.k3b-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.k3b-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.k3b-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.k3b-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }
.k3b-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.8rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem; position: sticky; top: 0; z-index: 2;
}
.k3b-controls label, .k3b-row label { display: flex; align-items: center; gap: 0.45rem; }
.k3b input, .k3b select, .k3b button { font-family: inherit; font-size: 0.95rem; color: var(--ink); }
.k3b input[type="number"] { width: 6.5em; padding: 0.2rem 0.35rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; }
.k3b select { padding: 0.2rem 0.3rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; max-width: 100%; min-width: 0; }
.k3b button { padding: 0.4rem 0.9rem; cursor: pointer; min-height: 2.2rem; background: var(--paper); border: 1px solid var(--ink-soft); border-radius: 4px; }
.k3b button:hover { background: #faf6ec; }
.k3b button:disabled { opacity: 0.5; cursor: wait; }
.k3b-play { font-weight: 600; }
.k3b-check { font-style: italic; }
#k3b-meter { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 9em; }
.k3b-card { border-bottom: 1px solid var(--ink-faint); padding: 1rem 0.2rem 1.2rem; }
.k3b-name { font-size: 1.3rem; font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; margin: 0 0 0.15rem; }
.k3b-phrase { margin: 0 0 0.6rem; font-style: italic; color: var(--ink-soft); max-width: 72ch; }
.k3b-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.7rem; margin: 0.35rem 0; }
.k3b-stat { margin: 0.45rem 0 0; font-size: 0.9rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.k3b-plan { font-size: 0.92rem; margin: 0.5rem 0 0; padding-left: 1.2rem; color: var(--ink); }
.k3b-plan li { margin: 0.12rem 0; }
.k3b-plan li.on { color: var(--rust); font-weight: 600; }
.k3b-scroll { overflow-x: auto; max-width: 100%; }
.k3b-table { border-collapse: collapse; font-size: 0.86rem; font-variant-numeric: tabular-nums; margin: 0.5rem 0; }
.k3b-table th, .k3b-table td { border-bottom: 1px solid var(--ink-faint); padding: 0.2rem 0.5rem; text-align: right; white-space: nowrap; }
.k3b-table th:first-child, .k3b-table td:first-child { text-align: left; }
.k3b-table th { font-weight: 600; font-variant: small-caps; letter-spacing: 0.03em; }
.k3b-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.2rem; max-width: 72ch; }
.k3b-hymn { font-size: 0.95rem; margin: 0 0 0.9rem; color: var(--ink); }
.k3b-hymn b { font-variant: small-caps; letter-spacing: 0.03em; }
.k3b-ok { color: var(--ink); font-weight: 600; }
.k3b-bad { color: var(--rust); font-weight: 600; }
/* the ringers' rows: a lead a column, the treble's line red, one bell's blue */
.k3b-leads { display: flex; flex-wrap: wrap; gap: 0.2rem 1.1rem; margin: 0.6rem 0; }
.k3b-lead { position: relative; font-family: "Courier New", monospace; font-size: 0.82rem; line-height: 1.05rem; letter-spacing: 0.35em; }
.k3b-lead svg { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
.k3b-lead .le { border-bottom: 1px solid var(--ink-faint); }
@media (max-width: 560px) {
  .k3b-title { font-size: 1.6rem; }
  .k3b-controls { position: static; }
  .k3b-controls label { width: 100%; justify-content: space-between; }
  .k3b-controls label > select, .k3b-controls label > input { width: 12.5rem; max-width: 100%; }
  .k3b-lead { font-size: 0.74rem; letter-spacing: 0.25em; }
}
</style>

<div class="k3b">
  <header class="k3b-head">
    <p class="k3b-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="k3b-title">Guests Lab 3B</h1>
    <p class="k3b-lede">Round three-c's two guests. The organist's variations on a hymn (after the noon recital, and
    Ives's <i>Variations on "America"</i>, 1891): a plain chorale, a trio with the tune in the pedals, a minuet, a
    polonaise in the minor, a march, a canon, the tune in two keys at once, and the full organ. And change ringing
    from a far tower: rounds, Plain Hunt or Plain Bob on five or six bells, and rounds again — every row generated
    from the method and checked. Both through the app's own master chain, never louder than the app;
    <strong>check</strong> renders offline and measures.</p>
  </header>

  <div class="k3b-controls">
    <label>seed <input type="number" id="k3b-seed" value="4" /></label>
    <label>dialect
      <select id="k3b-dialect">
        <option value="tabernacle" selected>Tabernacle</option>
        <option value="sacredharp">Sacred Harp</option>
        <option value="gospel">gospel</option>
        <option value="psalmody">psalmody</option>
      </select>
    </label>
    <label>keynote <input type="number" id="k3b-key" value="262" min="200" max="320" step="1" /></label>
    <label>room
      <select id="k3b-room">
        <option value="seated" selected>as seated (the organ in both rooms; the tower all tabernacle)</option>
        <option value="wide">tabernacle (St Margaret's)</option>
        <option value="close">meetinghouse (short)</option>
        <option value="dry">dry</option>
      </select>
    </label>
    <button type="button" id="k3b-compose">compose another</button>
    <button type="button" id="k3b-stop">stop</button>
    <span id="k3b-meter">out —</span>
  </div>

  <p class="k3b-hymn" id="k3b-hymn">composing…</p>
  <div id="k3b-cards"></div>

  <p class="k3b-footnote">The seed composes the hymn (the composer's stream <code>hymn:1:1</code>), seats the organist
  (<code>cast:1</code>) and moves each guest (<code>guest:variations:1</code>, <code>guest:changes:1</code>).
  <strong>check</strong> reports loudness (BS.1770: integrated, and the loudest 3&nbsp;s) against two references
  heard in the same room: the engine's organ as the prelude plays it (organChord at the 0.40 organ layer) and, for
  the variations, the same organist's own chorale prelude on the same hymn (the level the meeting already plays the
  organist at); for the ringing, the steeples as the meeting rings them now. Clicks are high-frequency bursts
  21.6&nbsp;dB clear of the 30&nbsp;ms either side, counted only where no stroke of a bell was scheduled. The
  interlude's two keys are measured on the plan: the share of its sounding moments whose pitches fit no single just
  major scale. The odds run each guest's <code>plan()</code> over 20,000 meetings of a stand-in for the engine's
  planner: its Sundays and organists, and the other guests' own dice and seats.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo k3b_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo k3b_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-score.js?v=<?php echo k3b_v('kolob-score.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo k3b_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-melody.js?v=<?php echo k3b_v('kolob-melody.js'); ?>"></script>
<script src="kolob-hymnists.js?v=<?php echo k3b_v('kolob-hymnists.js'); ?>"></script>
<script src="kolob-dialects.js?v=<?php echo k3b_v('kolob-dialects.js'); ?>"></script>
<script src="kolob-composer.js?v=<?php echo k3b_v('kolob-composer.js'); ?>"></script>
<script src="kolob-calendar.js?v=<?php echo k3b_v('kolob-calendar.js'); ?>"></script>
<script src="kolob-organist.js?v=<?php echo k3b_v('kolob-organist.js'); ?>"></script>
<script src="kolob-voices-pipeorgan.js?v=<?php echo k3b_v('kolob-voices-pipeorgan.js'); ?>"></script>
<script src="kolob-guest-variations.js?v=<?php echo k3b_v('kolob-guest-variations.js'); ?>"></script>
<script src="kolob-guest-changes.js?v=<?php echo k3b_v('kolob-guest-changes.js'); ?>"></script>
<script src="guests3b-lab.js?v=<?php echo k3b_v('guests3b-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

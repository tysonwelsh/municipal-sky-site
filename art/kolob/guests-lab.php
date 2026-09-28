<?php
// ============================================================================
// GUESTS LAB — audition bench for KOLOB 2's round-3 guests: the ward's
// handbell choir (KOLOB.GuestHandbells) and the singing school
// (KOLOB.GuestSingingSchool, EXPERIMENTAL — gated by KOLOB.Experimental).
// Each rings or sings a hymn the composer writes here, in any of the three
// dialects it knows (Tabernacle, Sacred Harp, the Old Way). UNLINKED dev
// tool (reachable only by its URL, /art/kolob/guests-lab.php), like the
// trombone lab. Everything plays through the app's own master chain and a
// limiter, never louder than the app; CHECK renders offline and measures.
// ============================================================================
$page_title = "Guests Lab — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's handbell choir and singing school.";
function kgl_v($file)
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
/* Scoped to .kgl-* so it never leaks into the rest of the site. */
.kgl {
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
}
.kgl * { box-sizing: border-box; }
.kgl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.kgl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.kgl-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.kgl-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }

.kgl-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.8rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem;
  position: sticky; top: 0; z-index: 2;
}
.kgl-controls label, .kgl-row label { display: flex; align-items: center; gap: 0.45rem; }
.kgl input, .kgl select, .kgl button { font-family: inherit; font-size: 0.95rem; color: var(--ink); }
.kgl input[type="number"] { width: 6.5em; padding: 0.2rem 0.35rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; }
.kgl select { padding: 0.2rem 0.3rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; max-width: 100%; min-width: 0; }
.kgl button {
  padding: 0.4rem 0.9rem; cursor: pointer; min-height: 2.2rem;
  background: var(--paper); border: 1px solid var(--ink-soft); border-radius: 4px;
}
.kgl button:hover { background: #faf6ec; }
.kgl button:disabled { opacity: 0.5; cursor: wait; }
.kgl-play { font-weight: 600; }
.kgl-check { font-style: italic; }
#kgl-meter { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 9em; }

.kgl-card { border-bottom: 1px solid var(--ink-faint); padding: 1rem 0.2rem 1.2rem; }
.kgl-name { font-size: 1.3rem; font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; margin: 0 0 0.15rem; }
.kgl-phrase { margin: 0 0 0.6rem; font-style: italic; color: var(--ink-soft); max-width: 72ch; }
.kgl-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.7rem; margin: 0.35rem 0; }
.kgl-stat { margin: 0.45rem 0 0; font-size: 0.9rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.kgl-meas { font-size: 0.88rem; margin: 0.35rem 0; color: var(--ink); font-variant-numeric: tabular-nums; }
.kgl-plan { font-size: 0.92rem; margin: 0.5rem 0 0; padding-left: 1.2rem; color: var(--ink); }
.kgl-plan li { margin: 0.12rem 0; }
.kgl-scroll { overflow-x: auto; max-width: 100%; }
.kgl-table { border-collapse: collapse; font-size: 0.86rem; font-variant-numeric: tabular-nums; margin: 0.5rem 0; }
.kgl-table th, .kgl-table td { border-bottom: 1px solid var(--ink-faint); padding: 0.2rem 0.5rem; text-align: right; white-space: nowrap; }
.kgl-table th:first-child, .kgl-table td:first-child { text-align: left; }
.kgl-table th { font-weight: 600; font-variant: small-caps; letter-spacing: 0.03em; }
.kgl-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.2rem; max-width: 72ch; }
.kgl-badge { display: inline-block; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid var(--rust); color: var(--rust); border-radius: 3px; padding: 0.05rem 0.4rem; margin-left: 0.4rem; vertical-align: middle; font-variant: normal; }
.kgl-badge.off { border-color: var(--ink-faint); color: var(--ink-soft); text-decoration: line-through; }
.kgl-flag { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.8rem; margin: 0.4rem 0 0.2rem; font-size: 0.92rem; }
.kgl-flag code { font-size: 0.82rem; background: var(--paper-2); padding: 0.05rem 0.3rem; border-radius: 3px; }
.kgl-hymn { font-size: 0.95rem; margin: 0 0 0.9rem; color: var(--ink); }
.kgl-hymn b { font-variant: small-caps; letter-spacing: 0.03em; }

/* the line of ringers: a row of boxes across the stage, low bells on one side */
.kgl-line { display: flex; gap: 3px; margin: 0.6rem 0 0.2rem; width: 100%; }
.kgl-ringer { flex: 1 1 0; min-width: 0; border: 1px solid var(--ink-faint); border-radius: 4px; background: #fbf8f0; padding: 0.2rem 0.1rem; text-align: center; font-size: 0.72rem; line-height: 1.25; font-variant-numeric: tabular-nums; }
.kgl-ringer b { display: block; font-size: 0.7rem; color: var(--gilt); font-weight: 500; }
.kgl-ringer .lit { color: var(--rust); font-weight: 600; }
.kgl-stage-note { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--ink-soft); }
.kgl-lesson { font-size: 1rem; margin: 0.4rem 0; }
.kgl-lesson em { color: var(--rust); font-style: normal; font-weight: 600; }

@media (max-width: 560px) {
  .kgl-title { font-size: 1.6rem; }
  .kgl-controls { position: static; }
  .kgl-controls label { width: 100%; justify-content: space-between; }
  .kgl-controls label > select, .kgl-controls label > input { width: 12.5rem; max-width: 100%; }
  .kgl-ringer { font-size: 0.6rem; }
  .kgl-ringer b { font-size: 0.58rem; }
}
</style>

<div class="kgl">
  <header class="kgl-head">
    <p class="kgl-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="kgl-title">Guests Lab</h1>
    <p class="kgl-lede">Round three's two guests: the ward's handbell choir, the first guest that stands in the
    room (after Margaret Shurcliff's Beacon Hill ringers, 1923), and the singing school, where the choir is still
    practising the day's first hymn (after Billings's classes, 1770) — the second one experimental, and switchable.
    Each plays a hymn the composer writes here, in just intonation, through the app's own master chain, never louder
    than the app. <strong>check</strong> renders offline and measures.</p>
  </header>

  <div class="kgl-controls">
    <label>seed <input type="number" id="kgl-seed" value="4" /></label>
    <label>dialect
      <select id="kgl-dialect">
        <option value="tabernacle" selected>Tabernacle</option>
        <option value="sacredharp">Sacred Harp</option>
        <option value="oldway">the Old Way</option>
      </select>
    </label>
    <label>mode
      <select id="kgl-mode">
        <option value="" selected>as the hymnist likes</option>
        <option value="ionian">ionian</option>
        <option value="mixolydian">mixolydian</option>
        <option value="dorian">dorian</option>
        <option value="aeolian">aeolian</option>
        <option value="hexa">hexatonic</option>
        <option value="penta">pentatonic</option>
      </select>
    </label>
    <label>keynote <input type="number" id="kgl-key" value="260" min="200" max="320" step="1" /></label>
    <label>room
      <select id="kgl-room">
        <option value="seated" selected>as seated (the bells close, the practice where the choir sits)</option>
        <option value="wide">tabernacle (St Margaret's)</option>
        <option value="close">meetinghouse (short)</option>
        <option value="dry">dry</option>
      </select>
    </label>
    <button type="button" id="kgl-compose">compose another</button>
    <button type="button" id="kgl-stop">stop</button>
    <span id="kgl-meter">out —</span>
  </div>

  <p class="kgl-hymn" id="kgl-hymn">composing…</p>
  <div id="kgl-cards"></div>

  <p class="kgl-footnote">The seed composes the hymn (the composer's stream <code>hymn:1:1</code>) and moves each
  guest's performance (<code>guest:handbells:1</code>, <code>guest:singingschool:1</code>): the handbells' piece,
  ringers, settings and cascade; the singing school's mistake, part and passage. <strong>check</strong> reports
  loudness (LUFS, integrated and the loudest 3&nbsp;s) against the v0.30 organ reference, peak, clipped samples, and
  clicks — high-frequency bursts that stand 21.6&nbsp;dB clear of the 30&nbsp;ms either side, counted only where no
  clapper, knock, consonant or rap was scheduled (every stroke of a bell is a transient by design; a click is one
  nothing asked for). The organ reference is heard in the same room as the guest (as seated: where the prelude
  seats the organ). <strong>As seated</strong> plays each guest through both of the app's rooms the way the engine
  seats a layer — the meetinghouse and the tabernacle crossfaded at the section's balance plus the layer's depth:
  the bells a step nearer than the choir (the handoff asks the engine for exactly this send), the practice where the
  choir sits in the prelude. The odds run each guest's <code>plan()</code> over 20,000 meetings of a stand-in for
  the engine's planner — its calendar, sections, and the other guests' own dice and seats — the practice planned
  first and its seat shown to the bells.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo kgl_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo kgl_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-score.js?v=<?php echo kgl_v('kolob-score.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo kgl_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-melody.js?v=<?php echo kgl_v('kolob-melody.js'); ?>"></script>
<script src="kolob-hymnists.js?v=<?php echo kgl_v('kolob-hymnists.js'); ?>"></script>
<script src="kolob-dialects.js?v=<?php echo kgl_v('kolob-dialects.js'); ?>"></script>
<script src="kolob-composer.js?v=<?php echo kgl_v('kolob-composer.js'); ?>"></script>
<script src="kolob-experimental.js?v=<?php echo kgl_v('kolob-experimental.js'); ?>"></script>
<script src="kolob-voices-folk.js?v=<?php echo kgl_v('kolob-voices-folk.js'); ?>"></script>
<script src="kolob-voices-vocal.js?v=<?php echo kgl_v('kolob-voices-vocal.js'); ?>"></script>
<script src="kolob-guest-handbells.js?v=<?php echo kgl_v('kolob-guest-handbells.js'); ?>"></script>
<script src="kolob-guest-singingschool.js?v=<?php echo kgl_v('kolob-guest-singingschool.js'); ?>"></script>
<script src="guests-lab.js?v=<?php echo kgl_v('guests-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

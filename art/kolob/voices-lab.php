<?php
// ============================================================================
// VOICES LAB — the vocal voices of KOLOB 2 (KOLOB.VoicesVocal), side by side
// with the v0.30 choir they replace.
//
// UNLINKED dev page (like room-lab and tune-lab): reachable only by URL
// (/art/kolob/voices-lab). One short common-metre line, SATB, sung six ways:
// today's quartet; the congregation of desks; the desks with three people
// stepping forward; the precentor lining out and the ward's slow reply; the
// verse on the notes (fa sol la mi) and then on ah and oo; a descant.
// Everything goes through a copy of the app's master chain and a limiter,
// at the app's loudness. The bench below the buttons renders any demo
// offline and measures it: peak, level, clicks, low mud, harshness, the
// flanger test, and the node budget.
// ============================================================================
$page_title = "Voices Lab — KOLOB · Municipal Sky";
$page_description = "A private workbench for the Kolob hymn engine's singing voices.";
function vl_v($file)
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
/* Scoped to .vl-* so it never leaks into the rest of the site. The hymnbook
   palette from kolob.css: cream stock, green ink, restrained gilt. */
.vl {
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.66);
  --ink-faint: rgba(30, 77, 59, 0.28);
  --paper: #f5f0e4;
  --paper-lo: #ece5d3;
  --gilt: #8a7a45;
  --bad: #9a3f2e;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  background: var(--paper);
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.6rem 1.25rem 4rem;
}
.vl * { box-sizing: border-box; }
.vl [hidden] { display: none !important; }
.vl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.8rem; margin-bottom: 1.2rem; }
.vl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.vl-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.vl-lede { font-size: 1.04rem; color: var(--ink-soft); margin: 0; max-width: 68ch; font-style: italic; }
.vl-sec { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--gilt); margin: 1.7rem 0 0.7rem; border-bottom: 1px solid var(--ink-faint); padding-bottom: 0.3rem; }
.vl-controls { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; align-items: center; font-size: 0.92rem; color: var(--ink-soft);
  border: 1px solid var(--ink-faint); border-radius: 8px; padding: 0.8rem 1rem; background: var(--paper-lo); }
.vl-controls label { display: flex; align-items: center; gap: 0.4rem; }
.vl-controls input[type=range] { width: 110px; accent-color: var(--ink); }
.vl-controls input[type=number] { width: 6.5rem; font-family: inherit; font-size: 0.92rem; padding: 0.25rem 0.4rem; border: 1px solid var(--ink-faint); border-radius: 5px; background: var(--paper); color: var(--ink); }
.vl-controls output { min-width: 3.2em; color: var(--ink); }
.vl-demos { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 0.7rem; }
.vl-demo { font-family: inherit; text-align: left; border: 1px solid var(--ink); background: var(--paper); color: var(--ink);
  border-radius: 8px; padding: 0.7rem 0.85rem; cursor: pointer; transition: background 0.12s, color 0.12s; }
.vl-demo:hover { background: var(--paper-lo); }
.vl-demo.is-on { background: var(--ink); color: var(--paper); }
.vl-demo b { display: block; font-size: 1.05rem; font-weight: 600; }
.vl-demo span { display: block; font-size: 0.86rem; opacity: 0.8; margin-top: 0.15rem; line-height: 1.3; }
.vl-demo i { font-style: normal; color: var(--gilt); margin-right: 0.3rem; }
.vl-demo.is-on i { color: #e7d9a8; }
.vl-row { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.vl-btn { font-family: inherit; font-size: 0.93rem; border: 1px solid var(--ink); background: var(--paper); color: var(--ink);
  padding: 0.45rem 0.85rem; border-radius: 6px; cursor: pointer; }
.vl-btn:hover { background: var(--paper-lo); }
.vl-btn.is-on { background: var(--ink); color: var(--paper); }
.vl-status { min-height: 1.4em; margin: 0.9rem 0 0.2rem; font-size: 0.98rem; color: var(--ink-soft); }
.vl-status b { color: var(--ink); }
.vl-err { color: var(--bad); font-size: 0.88rem; white-space: pre-wrap; }
.vl-bench { border: 1px solid var(--ink-faint); border-radius: 8px; padding: 0.9rem 1rem; background: var(--paper-lo); }
.vl-bench table { border-collapse: collapse; font-size: 0.9rem; margin: 0.4rem 0 0.8rem; }
.vl-bench td, .vl-bench th { padding: 0.18rem 0.8rem 0.18rem 0; text-align: left; vertical-align: top; }
.vl-bench th { font-weight: 500; color: var(--ink-soft); }
.vl-ok { color: var(--ink); } .vl-no { color: var(--bad); font-weight: 600; }
.vl-canvas { width: 100%; height: auto; display: block; border: 1px solid var(--ink-faint); border-radius: 4px; background: var(--paper); image-rendering: pixelated; }
.vl-budget { width: 100%; height: 90px; display: block; margin-top: 0.4rem; }
.vl-note { font-size: 0.88rem; color: var(--ink-soft); max-width: 72ch; }
@media (max-width: 560px) { .vl-title { font-size: 1.7rem; } .vl-controls input[type=range] { width: 90px; } }
</style>

<div class="main-wrapper">
  <div class="vl">
    <header class="vl-head">
      <p class="vl-kicker">Kolob 2 · sound lab · unlisted</p>
      <h1 class="vl-title">Voices Lab</h1>
      <p class="vl-lede">One common-metre line, four parts, sung six ways: the quartet Kolob sings today,
        and the ward that replaces it. People in a hall on a bright morning, not a pad.</p>
    </header>

    <p class="vl-err" id="vl-err" hidden></p>

    <div class="vl-controls">
      <label>seed <input type="number" id="vl-seed" value="3107" /></label>
      <label title="the quality knob: how many desks (pews) sing">desks <input type="range" id="vl-desks" min="2" max="8" value="6" step="1" /> <output id="vl-desks-out">6</output></label>
      <label>people per desk <input type="range" id="vl-per" min="2" max="4" value="3" step="1" /> <output id="vl-per-out">3</output></label>
      <label>beat <input type="range" id="vl-beat" min="0.6" max="1.3" value="0.85" step="0.05" /> <output id="vl-beat-out">0.85 s</output></label>
      <label>room <input type="range" id="vl-room" min="0" max="100" value="55" step="1" /> <output id="vl-room-out">55</output></label>
      <label title="alone, today's quartet sits ~16 dB under the app's hymn level; matched, the A/B is about timbre"><input type="checkbox" id="vl-match" checked /> level-match the quartet</label>
      <button type="button" class="vl-btn" id="vl-stop">stop</button>
    </div>

    <p class="vl-sec">The six demonstrations</p>
    <div class="vl-demos" id="vl-demos"></div>

    <p class="vl-sec">One person at a time</p>
    <div class="vl-row" id="vl-people"></div>

    <p class="vl-status" id="vl-status">&nbsp;</p>

    <p class="vl-sec">The bench</p>
    <div class="vl-bench">
      <div class="vl-row">
        <button type="button" class="vl-btn" id="vl-measure">render &amp; measure the last demo</button>
        <button type="button" class="vl-btn" id="vl-flange">flanger test (one desk vs. a naive pair)</button>
        <button type="button" class="vl-btn" id="vl-budget-btn">node budget, 6 desks + 2 soloists</button>
      </div>
      <div id="vl-report"></div>
      <canvas class="vl-canvas" id="vl-spec" width="1000" height="260" hidden></canvas>
      <canvas class="vl-budget" id="vl-budget" width="1000" height="90" hidden></canvas>
      <p class="vl-note">Rendering is offline (an OfflineAudioContext through the same master chain), so it measures exactly
        what you hear, and its speed is a CPU reading. Spectrogram: 50 Hz – 10 kHz, log frequency; the dashed rule is 250 Hz.</p>
    </div>
  </div>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo vl_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-voices-vocal.js?v=<?php echo vl_v('kolob-voices-vocal.js'); ?>"></script>
<script src="voices-lab.js?v=<?php echo vl_v('voices-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

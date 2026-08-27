<?php
// ============================================================================
// SUBSTRATE DEMO — Phase 0 audible smoke test for Prospero's Jukebox v2.
// UNLINKED dev page (tune-lab pattern): reachable only by its URL. Purpose:
// hear the four Phase 0 modules composed — Rand streams driving a random walk
// over a PitchField, two Clock lanes scheduling into a Voice bus + reverb —
// and watch the scheduler's lookahead margins in the telemetry log. This is
// a substrate test, not music: the patches are deliberately trivial.
// ============================================================================
$page_title = "PJ2 substrate demo — Municipal Sky";
$page_description = "Phase 0 smoke-test bench for the Prospero's Jukebox v2 substrate.";
function pj2v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? filemtime($path) : 0;
}
include '../../includes/header.php';
?>

<style>
/* Bare-bones dev styling, scoped to .pj2demo — readable, nothing more. */
.pj2demo {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
  font-family: Georgia, serif;
}
.pj2demo h1 { font-size: 1.6rem; margin: 0 0 0.3rem; }
.pj2demo .pj2-kicker { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.7rem; opacity: 0.6; margin: 0 0 0.3rem; }
.pj2demo .pj2-lede { font-size: 0.95rem; opacity: 0.75; margin: 0 0 1.2rem; max-width: 64ch; }
.pj2demo .pj2-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;
  border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
  padding: 0.8rem 1rem; margin-bottom: 1rem; font-size: 0.95rem;
}
.pj2demo .pj2-controls label { display: flex; align-items: center; gap: 0.45rem; }
.pj2demo .pj2-controls button { font-family: inherit; font-size: 0.92rem; padding: 0.35rem 1rem; cursor: pointer; }
.pj2demo .pj2-controls input[type="number"] { width: 6em; }
.pj2demo .pj2-controls output { min-width: 3.5em; opacity: 0.7; }
.pj2demo #log {
  font-family: Menlo, Consolas, monospace; font-size: 0.78rem; line-height: 1.45;
  background: #111; color: #cfe8cf; border-radius: 6px;
  padding: 0.8rem 1rem; min-height: 14em; max-height: 28em;
  overflow-y: auto; overflow-x: auto; white-space: pre;
}
</style>

<div class="pj2demo">
  <p class="pj2-kicker">Prospero's Jukebox v2 · Phase 0 · dev bench · unlinked</p>
  <h1>PJ2 substrate demo</h1>
  <p class="pj2-lede">Two clock lanes over one pitch field: a slow drone dyad and a plucky
  seeded random walk. <strong>modulate ↑4</strong> moves the tonic up a fourth — notes already
  sounding keep their old pitches and ring across the boundary; only future notes take the new key.
  The log shows each melody note's lookahead margin (scheduled t minus audio-clock now at the
  moment of scheduling) and the running polyphony-budget refusal count.</p>

  <div class="pj2-controls">
    <button type="button" id="pj2-play">Play</button>
    <button type="button" id="pj2-stop">Stop</button>
    <label>seed <input type="number" id="pj2-seed" value="1" min="1" step="1" /></label>
    <label>mode
      <select id="pj2-mode">
        <option value="dorian" selected>dorian (Library, C)</option>
        <option value="sycorax">sycorax (ghosts, Eb)</option>
        <option value="lydian">lydian (Ariel, F)</option>
      </select>
    </label>
    <button type="button" id="pj2-modulate">modulate &#8593;4</button>
    <label>melody rate
      <input type="range" id="pj2-rate" min="0.25" max="4" value="1" step="0.05" />
      <output id="pj2-rate-out">1.00&times;</output>
    </label>
  </div>

  <pre id="log">— idle. Press Play. —</pre>
</div>

<script src="pj2-rand.js?v=<?php echo pj2v('pj2-rand.js'); ?>"></script>
<script src="pj2-pitch.js?v=<?php echo pj2v('pj2-pitch.js'); ?>"></script>
<script src="pj2-clock.js?v=<?php echo pj2v('pj2-clock.js'); ?>"></script>
<script src="pj2-voice.js?v=<?php echo pj2v('pj2-voice.js'); ?>"></script>
<script src="substrate-demo.js?v=<?php echo pj2v('substrate-demo.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

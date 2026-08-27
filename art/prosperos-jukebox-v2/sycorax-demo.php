<?php
// ============================================================================
// SYCORAX DEMO — dev bench for the Sycorax track of Prospero's Jukebox v2.
// UNLINKED dev page (tune-lab pattern): reachable only by its URL. Purpose:
// watch the rite from the treeline — the encirclement dramaturgy (gathering →
// processional → circling → invocation → THE CUT → afterimage), the pinned-i
// pose rotation, the tide ("how near the menace circles"), the anti-groove
// percussion, the noise ceiling riding under the gurdy, the bruise carried
// across evenings, and the rare downward sink. Dev chrome only, no styling
// ambition: the readouts exist so a human can check what the harness checks.
// ============================================================================
$page_title = "PJ2 sycorax demo — Municipal Sky";
$page_description = "Sycorax-track dev bench for Prospero's Jukebox v2.";
function pj2v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? filemtime($path) : 0;
}
include '../../includes/header.php';
?>

<style>
/* Bare-bones dev styling, scoped to .pj2syc — readable, nothing more. */
.pj2syc {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
  font-family: Georgia, serif;
}
.pj2syc h1 { font-size: 1.6rem; margin: 0 0 0.3rem; }
.pj2syc .pj2-kicker { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.7rem; opacity: 0.6; margin: 0 0 0.3rem; }
.pj2syc .pj2-lede { font-size: 0.95rem; opacity: 0.75; margin: 0 0 1.2rem; max-width: 64ch; }
.pj2syc .pj2-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;
  border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
  padding: 0.8rem 1rem; margin-bottom: 1rem; font-size: 0.95rem;
}
.pj2syc .pj2-controls label { display: flex; align-items: center; gap: 0.45rem; }
.pj2syc .pj2-controls button { font-family: inherit; font-size: 0.92rem; padding: 0.35rem 1rem; cursor: pointer; }
.pj2syc .pj2-controls input[type="number"] { width: 8em; }
.pj2syc .pj2-controls output { min-width: 3em; opacity: 0.7; }
.pj2syc .pj2-monitor {
  border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
  padding: 0.8rem 1rem; margin-bottom: 1rem;
  font-size: 0.9rem; line-height: 1.5;
}
.pj2syc .pj2-monitor table { border-collapse: collapse; width: 100%; }
.pj2syc .pj2-monitor th {
  text-align: left; font-weight: normal; opacity: 0.6; white-space: nowrap;
  padding: 0.15rem 1rem 0.15rem 0; vertical-align: middle; width: 8em;
}
.pj2syc .pj2-monitor td { padding: 0.15rem 0; vertical-align: middle; }
.pj2syc .pj2-bar {
  display: inline-block; vertical-align: middle;
  width: 220px; height: 10px; margin-right: 0.6rem;
  border: 1px solid rgba(0,0,0,0.35); border-radius: 3px;
  background: rgba(0,0,0,0.06); overflow: hidden;
}
.pj2syc .pj2-fill { display: block; height: 100%; width: 0%; background: #446; }
.pj2syc #pj2-int-fill { background: #833; }
.pj2syc #pj2-log {
  font-family: Menlo, Consolas, monospace; font-size: 0.78rem; line-height: 1.45;
  background: #0c0c10; color: #cfd4e8; border-radius: 6px;
  padding: 0.8rem 1rem; min-height: 14em; max-height: 28em;
  overflow-y: auto; overflow-x: auto; white-space: pre;
}
</style>

<div class="pj2syc">
  <p class="pj2-kicker">Prospero's Jukebox v2 · Sycorax track · dev bench · unlinked</p>
  <h1>PJ2 sycorax demo</h1>
  <p class="pj2-lede">The dark track: a rite observed from the treeline. The root is pinned to i
  forever — color rotates between authored poses; boundaries darken instead of cadence; the
  invocation ends in THE CUT (the moment the observer is noticed), whose hush is inhabited by the
  proto-drum and one waterphone apparition; the noise bed rides hard-slaved under the gurdy; a
  bruise (last night's cut severity) carries across evenings, and on rare at-the-treeline nights
  the whole rite sinks a half-step at the cut. Same seed, same evening — always. The monitor polls
  <code>getInfo()</code>; the log prints the engine's own narration.</p>

  <div class="pj2-controls">
    <button type="button" id="pj2-play">Play</button>
    <button type="button" id="pj2-stop">Stop</button>
    <label>seed <input type="number" id="pj2-seed" value="1400137155" min="0" step="1" /></label>
    <label>volume
      <input type="range" id="pj2-vol" min="0" max="1" value="0.5" step="0.01" />
      <output id="pj2-vol-out">0.50</output>
    </label>
  </div>

  <div class="pj2-monitor">
    <table>
      <tr><th>state</th>       <td id="pj2-state">idle</td></tr>
      <tr><th>performance</th> <td id="pj2-perf">&mdash;</td></tr>
      <tr><th>tide</th>        <td><span class="pj2-bar"><span class="pj2-fill" id="pj2-tide-fill"></span></span><span id="pj2-tide">&mdash;</span></td></tr>
      <tr><th>scene</th>       <td><span class="pj2-bar"><span class="pj2-fill" id="pj2-scene-fill"></span></span><span id="pj2-scene">&mdash;</span></td></tr>
      <tr><th>intensity</th>   <td><span class="pj2-bar"><span class="pj2-fill" id="pj2-int-fill"></span></span><span id="pj2-int">&mdash;</span></td></tr>
      <tr><th>pose</th>        <td id="pj2-pose">&mdash;</td></tr>
      <tr><th>motif</th>       <td id="pj2-motif">&mdash;</td></tr>
      <tr><th>the air</th>     <td id="pj2-air">&mdash;</td></tr>
      <tr><th>percussion</th>  <td id="pj2-perc">&mdash;</td></tr>
      <tr><th>levels</th>      <td id="pj2-levels">&mdash;</td></tr>
      <tr><th>the rite</th>    <td id="pj2-rite">&mdash;</td></tr>
      <tr><th>budget</th>      <td id="pj2-budget">&mdash;</td></tr>
    </table>
  </div>

  <pre id="pj2-log">&mdash; idle. Press Play. &mdash;</pre>
</div>

<script src="pj2-rand.js?v=<?php echo pj2v('pj2-rand.js'); ?>"></script>
<script src="pj2-pitch.js?v=<?php echo pj2v('pj2-pitch.js'); ?>"></script>
<script src="pj2-clock.js?v=<?php echo pj2v('pj2-clock.js'); ?>"></script>
<script src="pj2-voice.js?v=<?php echo pj2v('pj2-voice.js'); ?>"></script>
<script src="pj2-fx.js?v=<?php echo pj2v('pj2-fx.js'); ?>"></script>
<script src="pj2-air.js?v=<?php echo pj2v('pj2-air.js'); ?>"></script>
<script src="pj2-motif.js?v=<?php echo pj2v('pj2-motif.js'); ?>"></script>
<script src="pj2-harmony.js?v=<?php echo pj2v('pj2-harmony.js'); ?>"></script>
<script src="pj2-conductor.js?v=<?php echo pj2v('pj2-conductor.js'); ?>"></script>
<script src="pj2-sycorax.js?v=<?php echo pj2v('pj2-sycorax.js'); ?>"></script>
<script src="sycorax-demo.js?v=<?php echo pj2v('sycorax-demo.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

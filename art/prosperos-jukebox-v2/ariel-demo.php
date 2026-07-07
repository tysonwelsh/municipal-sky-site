<?php
// ============================================================================
// ARIEL DEMO — dev bench for the Ariel track of Prospero's Jukebox v2.
// UNLINKED dev page (tune-lab pattern): reachable only by its URL. Purpose:
// watch the flights-and-songs dramaturgy fly an evening — the quick
// song/flight alternation, the tide as weather aloft, the Lydian float
// (I↔II planing, cadences that LIFT), the signature motif and its
// promoted-ghost nights, sea changes that only turn upward, and the release's
// ascent out of register into the seam's tonic re-grounding. Dev chrome only,
// no styling ambition: the readouts exist so a human can check what the
// check harness checks.
// ============================================================================
$page_title = "PJ2 Ariel demo — Municipal Sky";
$page_description = "Ariel track dev bench for Prospero's Jukebox v2.";
function pj2v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? filemtime($path) : 0;
}
include '../../includes/header.php';
?>

<style>
/* Bare-bones dev styling, scoped to .pj2ariel — readable, nothing more. */
.pj2ariel {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
  font-family: Georgia, serif;
}
.pj2ariel h1 { font-size: 1.6rem; margin: 0 0 0.3rem; }
.pj2ariel .pj2-kicker { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.7rem; opacity: 0.6; margin: 0 0 0.3rem; }
.pj2ariel .pj2-lede { font-size: 0.95rem; opacity: 0.75; margin: 0 0 1.2rem; max-width: 64ch; }
.pj2ariel .pj2-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;
  border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
  padding: 0.8rem 1rem; margin-bottom: 1rem; font-size: 0.95rem;
}
.pj2ariel .pj2-controls label { display: flex; align-items: center; gap: 0.45rem; }
.pj2ariel .pj2-controls button { font-family: inherit; font-size: 0.92rem; padding: 0.35rem 1rem; cursor: pointer; }
.pj2ariel .pj2-controls input[type="number"] { width: 8em; }
.pj2ariel .pj2-controls output { min-width: 3em; opacity: 0.7; }
.pj2ariel .pj2-monitor {
  border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
  padding: 0.8rem 1rem; margin-bottom: 1rem;
  font-size: 0.9rem; line-height: 1.5;
}
.pj2ariel .pj2-monitor table { border-collapse: collapse; width: 100%; }
.pj2ariel .pj2-monitor th {
  text-align: left; font-weight: normal; opacity: 0.6; white-space: nowrap;
  padding: 0.15rem 1rem 0.15rem 0; vertical-align: middle; width: 8em;
}
.pj2ariel .pj2-monitor td { padding: 0.15rem 0; vertical-align: middle; }
.pj2ariel .pj2-bar {
  display: inline-block; vertical-align: middle;
  width: 220px; height: 10px; margin-right: 0.6rem;
  border: 1px solid rgba(0,0,0,0.35); border-radius: 3px;
  background: rgba(0,0,0,0.06); overflow: hidden;
}
.pj2ariel .pj2-fill { display: block; height: 100%; width: 0%; background: #368; }
.pj2ariel #pj2-int-fill { background: #a53; }
.pj2ariel #pj2-log {
  font-family: Menlo, Consolas, monospace; font-size: 0.78rem; line-height: 1.45;
  background: #101418; color: #cfe0ef; border-radius: 6px;
  padding: 0.8rem 1rem; min-height: 14em; max-height: 28em;
  overflow-y: auto; overflow-x: auto; white-space: pre;
}
</style>

<div class="pj2ariel">
  <p class="pj2-kicker">Prospero's Jukebox v2 · Ariel · dev bench · unlinked</p>
  <h1>PJ2 Ariel demo</h1>
  <p class="pj2-lede">Flights and songs: quick alternation of brief melodic songs and fast
  scattering flights over a Lydian float that never resolves downward — cadences lift, sea
  changes only turn upward, and every evening ends by ascending out of register before the
  seam re-grounds the tonic to F&nbsp;349 under the still-ringing tail. One signature motif
  returns changed all evening; about half the nights it crosses the seam as a promoted ghost.
  Same seed, same evening — always. The monitor polls <code>getInfo()</code>; the log prints
  the engine's own narration.</p>

  <div class="pj2-controls">
    <button type="button" id="pj2-play">Play</button>
    <button type="button" id="pj2-stop">Stop</button>
    <label>seed <input type="number" id="pj2-seed" value="1095911749" min="0" step="1" /></label>
    <label>volume
      <input type="range" id="pj2-vol" min="0" max="1" value="0.5" step="0.01" />
      <output id="pj2-vol-out">0.50</output>
    </label>
  </div>

  <div class="pj2-monitor">
    <table>
      <tr><th>state</th>       <td id="pj2-state">idle</td></tr>
      <tr><th>performance</th> <td id="pj2-perf">&mdash;</td></tr>
      <tr><th>weather aloft</th><td><span class="pj2-bar"><span class="pj2-fill" id="pj2-tide-fill"></span></span><span id="pj2-tide">&mdash;</span></td></tr>
      <tr><th>scene</th>       <td><span class="pj2-bar"><span class="pj2-fill" id="pj2-scene-fill"></span></span><span id="pj2-scene">&mdash;</span></td></tr>
      <tr><th>intensity</th>   <td><span class="pj2-bar"><span class="pj2-fill" id="pj2-int-fill"></span></span><span id="pj2-int">&mdash;</span></td></tr>
      <tr><th>harmony</th>     <td id="pj2-chord">&mdash;</td></tr>
      <tr><th>signature</th>   <td id="pj2-signature">&mdash;</td></tr>
      <tr><th>the air</th>     <td id="pj2-air">&mdash;</td></tr>
      <tr><th>budget</th>      <td id="pj2-budget">&mdash;</td></tr>
      <tr><th>sky</th>         <td id="pj2-sky">&mdash;</td></tr>
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
<script src="pj2-ariel.js?v=<?php echo pj2v('pj2-ariel.js'); ?>"></script>
<script src="ariel-demo.js?v=<?php echo pj2v('ariel-demo.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

<?php
// ============================================================================
// ROOM LAB — an A/B bench for choosing KOLOB's tabernacle.
//
// UNLINKED dev page (like bagpipe-lab and tune-lab): reachable only by URL
// (/art/kolob/room-lab). Runs the REAL engine. Two rooms, A and B, one of
// them lit; play any instrument or a whole meeting and flip between them
// while it plays. The lit room becomes the engine's WIDE room (the
// tabernacle); the CLOSE room stays the engine's own pour. Candidates are
// measured impulse responses from the OpenAIR collection kept under
// ../prosperos-jukebox-v2/ir/ (CC BY-SA 3.0, University of York; provenance
// in that folder's README). When one is right, the owner names it and it
// gets baked into ROOM_WIDE in kolob-audio.js.
// ============================================================================
$page_title = "Room Lab — KOLOB · Municipal Sky";
$page_description = "A private workbench for choosing the rooms the Kolob hymn engine sings in.";
function rml_v($file)
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
/* Scoped to .rml-* so it never leaks into the rest of the site. */
.rml {
  --ink: #2b2416;
  --ink-soft: #6b5f47;
  --paper: #f4ecd8;
  --paper-2: #efe6cf;
  --line: #cbbc98;
  --accent: #7a4a1e;
  --good: #3f6b3a;
  --bad: #9a3f2e;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 1080px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
.rml * { box-sizing: border-box; }
.rml-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.25rem; }
.rml-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--accent); margin: 0 0 0.35rem; }
.rml-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.rml-lede { font-size: 1.02rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }
.rml-tip { font-size: 0.9rem; color: var(--ink-soft); margin: 0.6rem 0 0; max-width: 70ch; }
.rml-transport {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.75rem;
  background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
  padding: 0.9rem 1rem; margin-bottom: 1.1rem;
}
.rml-btn {
  font-family: inherit; font-size: 0.95rem; font-weight: 500;
  border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.12s;
}
.rml-btn:hover { background: var(--ink); color: var(--paper); }
.rml-btn.is-on { background: var(--accent); color: #fff; border-color: var(--accent); }
.rml-btn-small { font-size: 0.85rem; padding: 0.35rem 0.7rem; }
.rml-spacer { flex: 1 1 auto; }
.rml-inline { display: flex; align-items: center; gap: 0.45rem; font-size: 0.88rem; color: var(--ink-soft); }
.rml-inline input[type=range] { width: 120px; accent-color: var(--accent); }
.rml-inline input[type=number] { width: 8.5rem; font-family: inherit; font-size: 0.9rem; padding: 0.3rem 0.4rem; border: 1px solid var(--line); border-radius: 5px; background: #fff8ea; color: var(--ink); }
.rml select { font-family: inherit; font-size: 0.92rem; padding: 0.35rem 0.4rem; border: 1px solid var(--line); border-radius: 5px; background: #fff8ea; color: var(--ink); max-width: 100%; }
.rml-status { font-size: 0.95rem; color: var(--ink-soft); min-height: 1.3em; margin: 0.8rem 0 0.4rem; }
.rml-status b { color: var(--ink); font-weight: 600; }
.rml-sec-title { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 1.6rem 0 0.7rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
.rml-ab { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.rml-card { border: 2px solid var(--line); border-radius: 10px; background: var(--paper); padding: 1rem 1.1rem 1.1rem; transition: border-color 0.15s, box-shadow 0.15s; }
.rml-card.is-lit { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(122, 74, 30, 0.18); background: #fff8ea; }
.rml-card-head { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.5rem; }
.rml-letter { font-size: 1.7rem; font-weight: 600; line-height: 1; color: var(--ink-soft); width: 1.4rem; }
.rml-card.is-lit .rml-letter { color: var(--accent); }
.rml-card select { flex: 1 1 auto; font-size: 1rem; }
.rml-desc { font-size: 0.88rem; color: var(--ink-soft); margin: 0 0 0.2rem; min-height: 1.2em; }
.rml-state { font-size: 0.82rem; margin: 0 0 0.8rem; min-height: 1.2em; }
.rml-state.is-ok { color: var(--good); }
.rml-state.is-bad { color: var(--bad); }
.rml-state.is-wait { color: var(--accent); }
.rml-hear { width: 100%; font-size: 1.05rem; padding: 0.7rem 1rem; }
.rml-card.is-lit .rml-hear { background: var(--accent); color: #fff; border-color: var(--accent); }
.rml-keys { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rml-key {
  font-family: inherit; font-size: 0.95rem; min-width: 5.6rem; padding: 0.7rem 0.8rem;
  border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 6px; cursor: pointer; text-align: center; user-select: none; transition: all 0.08s;
}
.rml-key:hover { background: var(--paper-2); }
.rml-amount { border: 1px solid var(--line); border-radius: 8px; background: var(--paper); padding: 0.9rem 1rem; }
.rml-amount input[type=range] { width: 100%; accent-color: var(--accent); cursor: pointer; }
.rml-amount-ends { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--ink-soft); font-style: italic; margin-top: 0.2rem; }
.rml-foot-link { display: inline-block; margin-top: 1.6rem; font-size: 0.9rem; color: var(--accent); }
.rml-err { color: var(--bad); font-size: 0.85rem; white-space: pre-wrap; margin: 0 0 0.8rem; }
@media (max-width: 560px) {
  .rml-title { font-size: 1.7rem; }
}
</style>

<div class="main-wrapper">
  <div class="rml">
    <header class="rml-head">
      <p class="rml-kicker">Kolob · room workbench · unlisted</p>
      <h1 class="rml-title">Room Lab</h1>
      <p class="rml-lede">Two rooms, A and B. You hear whichever one is lit. Play an instrument, or the whole
        meeting, and flip between them until one of them is right.</p>
      <p class="rml-tip">Flip with the buttons or the <strong>A</strong> and <strong>B</strong> keys &mdash; the music
        keeps going and the room changes under it. When you have a winner, just tell me its name.</p>
    </header>

    <p class="rml-err" id="rml-err" hidden></p>

    <!-- The two rooms -->
    <div class="rml-ab">
      <div class="rml-card" data-card="A">
        <div class="rml-card-head"><span class="rml-letter">A</span><select data-sel="A"></select></div>
        <p class="rml-desc" data-desc="A"></p>
        <p class="rml-state" data-state="A"></p>
        <button type="button" class="rml-btn rml-hear" data-hear="A">hear this one</button>
      </div>
      <div class="rml-card" data-card="B">
        <div class="rml-card-head"><span class="rml-letter">B</span><select data-sel="B"></select></div>
        <p class="rml-desc" data-desc="B"></p>
        <p class="rml-state" data-state="B"></p>
        <button type="button" class="rml-btn rml-hear" data-hear="B">hear this one</button>
      </div>
    </div>
    <p class="rml-status" id="rml-status">&nbsp;</p>

    <!-- What to play -->
    <p class="rml-sec-title">Play one instrument, alone, in the lit room</p>
    <div class="rml-keys" id="rml-keys"></div>

    <p class="rml-sec-title">Or the whole meeting</p>
    <div class="rml-transport">
      <button type="button" class="rml-btn" id="rml-play">Play a meeting</button>
      <button type="button" class="rml-btn" id="rml-stop">Stop</button>
      <span class="rml-inline"><label for="rml-skip">jump to</label>
        <select id="rml-skip">
          <option value="">&mdash;</option>
          <option value="prelude">prelude</option>
          <option value="hymn">hymn</option>
          <option value="testimony">testimony</option>
          <option value="sacrament">sacrament</option>
          <option value="doxology">doxology</option>
          <option value="postlude">postlude</option>
        </select>
      </span>
    </div>

    <p class="rml-sec-title">How much of the room</p>
    <div class="rml-amount">
      <input type="range" id="rml-amount" min="20" max="90" value="60" />
      <div class="rml-amount-ends"><span>near &mdash; mostly the voice</span><span>far &mdash; mostly the room</span></div>
    </div>

    <a class="rml-foot-link" href="/art/kolob/">&larr; back to Kolob</a>
  </div>
</div>

<script src="../prosperos-jukebox-v2/pj2-fx.js?v=<?php echo rml_v('../prosperos-jukebox-v2/pj2-fx.js'); ?>"></script>
<script src="kolob-audio.js?v=<?php echo rml_v('kolob-audio.js'); ?>"></script>
<script src="room-lab.js?v=<?php echo rml_v('room-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

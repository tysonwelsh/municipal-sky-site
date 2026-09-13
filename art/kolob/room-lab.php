<?php
// ============================================================================
// ROOM LAB — the workbench for choosing KOLOB's rooms.
//
// UNLINKED dev page (like bagpipe-lab and tune-lab): reachable only by URL
// (/art/kolob/room-lab). It runs the REAL engine — the same kolob-audio.js
// the front page loads, every voice, the whole order of service — and lets
// the owner swap either of its two rooms (the CLOSE meetinghouse, the WIDE
// tabernacle) for a measured impulse response from the OpenAIR collection
// kept under ../prosperos-jukebox-v2/ir/ (CC BY-SA 3.0, University of York;
// provenance in that folder's README). Also on the bench: each room's wet
// and pre-delay, the pour's decay and brightness, the section balance, and
// every layer's depth. When a room sounds right, COPY SETTINGS and paste
// the JSON back — the numbers go straight into ROOM_CLOSE / ROOM_WIDE /
// ROOM_DEPTH in the engine.
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
.rml-status { font-size: 0.9rem; color: var(--ink-soft); min-height: 1.3em; margin: 0 0 1.2rem; font-variant-numeric: tabular-nums; }
.rml-status b { color: var(--ink); font-weight: 600; }
.rml-sec-title { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 1.6rem 0 0.7rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
.rml-rooms { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
.rml-room { border: 1px solid var(--line); border-radius: 8px; background: var(--paper); padding: 0.9rem 1rem; }
.rml-room h2 { font-size: 1.15rem; margin: 0 0 0.15rem; font-weight: 600; }
.rml-room-sub { font-size: 0.85rem; color: var(--ink-soft); margin: 0 0 0.6rem; font-style: italic; }
.rml-room select { width: 100%; }
.rml-room-desc { font-size: 0.84rem; color: var(--ink-soft); margin: 0.35rem 0 0.2rem; min-height: 1.2em; }
.rml-room-state { font-size: 0.82rem; margin: 0 0 0.7rem; min-height: 1.2em; }
.rml-room-state.is-ok { color: var(--good); }
.rml-room-state.is-bad { color: var(--bad); }
.rml-room-state.is-wait { color: var(--accent); }
.rml-ctl { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.55rem; }
.rml-ctl-top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.rml-ctl-label { font-size: 0.9rem; font-weight: 500; }
.rml-ctl-val { font-size: 0.82rem; color: var(--accent); font-variant-numeric: tabular-nums; font-weight: 600; }
.rml-ctl-hint { font-size: 0.76rem; color: var(--ink-soft); line-height: 1.25; font-style: italic; }
.rml input[type=range] { width: 100%; accent-color: var(--accent); cursor: pointer; }
.rml-ctl.is-dim { opacity: 0.45; }
.rml-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.7rem 1.4rem; }
.rml-keys { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rml-key {
  font-family: inherit; font-size: 0.9rem; min-width: 5.4rem; padding: 0.6rem 0.7rem;
  border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 6px; cursor: pointer; text-align: center; user-select: none; transition: all 0.08s;
}
.rml-key:hover { background: var(--paper-2); }
.rml-balance { border: 1px solid var(--line); border-radius: 8px; background: var(--paper); padding: 0.9rem 1rem; }
.rml-balance-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.rml-balance-row input[type=range] { flex: 1 1 260px; }
.rml-balance-ends { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--ink-soft); font-style: italic; margin-top: 0.2rem; }
.rml-check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; }
.rml-check input { accent-color: var(--accent); }
.rml-copy-block { margin-top: 2.2rem; border: 1px solid var(--ink); border-radius: 8px; background: var(--paper); padding: 1.1rem 1.15rem; }
.rml-copy-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 0.7rem; }
.rml-copy-row h2 { font-size: 1.05rem; margin: 0; font-weight: 600; }
.rml-copy-msg { font-size: 0.85rem; color: var(--good); font-weight: 600; opacity: 0; transition: opacity 0.2s; }
.rml-copy-msg.show { opacity: 1; }
.rml-json {
  width: 100%; min-height: 200px; font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.78rem; line-height: 1.45; color: var(--ink); background: #fbf6e9;
  border: 1px solid var(--line); border-radius: 6px; padding: 0.7rem; resize: vertical;
}
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
      <p class="rml-lede">Choosing the <em>rooms</em> Kolob sings in. The whole engine, unmodified &mdash;
        every voice, the whole order of service &mdash; with its two rooms swappable for real measured spaces.</p>
      <p class="rml-tip">Since v0.27 every instrument sings in <strong>both</strong> rooms at once: the
        <strong>close</strong> room is the meetinghouse, the <strong>wide</strong> room is the tabernacle, and each
        voice sits at its own depth between them. Pick a space for either room from the lists below (the
        <em>pour</em> is the engine&rsquo;s own synthetic room, the default). <strong>Play a meeting</strong>
        to hear the ensemble in it, or touch an instrument under <em>auditions</em> to hear one voice alone.
        Big files take a moment to arrive; the pour plays until they do. When something sounds right,
        <strong>Copy settings</strong> and paste the JSON back &mdash; it goes straight into the engine.</p>
    </header>

    <p class="rml-err" id="rml-err" hidden></p>

    <!-- Transport -->
    <div class="rml-transport">
      <button type="button" class="rml-btn" id="rml-play">Play a meeting</button>
      <button type="button" class="rml-btn" id="rml-stop">Stop</button>
      <button type="button" class="rml-btn rml-btn-small" id="rml-restart" title="stop, and call the same meeting again from its seed">Same meeting again</button>
      <span class="rml-inline"><label for="rml-seed">seed</label><input type="number" id="rml-seed" min="1" step="1" /></span>
      <span class="rml-inline"><label for="rml-skip">jump to</label>
        <select id="rml-skip">
          <option value="">&mdash;</option>
          <option value="prelude">prelude</option>
          <option value="invocation">invocation</option>
          <option value="hymn">hymn</option>
          <option value="testimony">testimony</option>
          <option value="sacrament">sacrament</option>
          <option value="doxology">doxology</option>
          <option value="postlude">postlude</option>
        </select>
      </span>
      <div class="rml-spacer"></div>
      <span class="rml-inline"><label for="rml-master">Volume</label><input type="range" id="rml-master" min="0" max="100" value="60" /></span>
    </div>
    <p class="rml-status" id="rml-status">&nbsp;</p>

    <!-- Rooms -->
    <p class="rml-sec-title">The two rooms</p>
    <div class="rml-rooms">
      <div class="rml-room" id="rml-room-close">
        <h2>Close &mdash; the meetinghouse</h2>
        <p class="rml-room-sub">short and near; its first reflections seat the voices</p>
        <select data-room-sel="close"></select>
        <p class="rml-room-desc" data-room-desc="close"></p>
        <p class="rml-room-state" data-room-state="close"></p>
        <div data-room-ctls="close"></div>
      </div>
      <div class="rml-room" id="rml-room-wide">
        <h2>Wide &mdash; the tabernacle</h2>
        <p class="rml-room-sub">long and breathing; where the gathering goes when the hymn swells</p>
        <select data-room-sel="wide"></select>
        <p class="rml-room-desc" data-room-desc="wide"></p>
        <p class="rml-room-state" data-room-state="wide"></p>
        <div data-room-ctls="wide"></div>
      </div>
    </div>

    <!-- Balance -->
    <p class="rml-sec-title">Where the gathering sits</p>
    <div class="rml-balance">
      <div class="rml-balance-row">
        <input type="range" id="rml-balance" min="0" max="100" value="45" />
        <span class="rml-ctl-val" id="rml-balance-val">0.45</span>
        <label class="rml-check"><input type="checkbox" id="rml-follow" checked /> let the sections move it</label>
      </div>
      <div class="rml-balance-ends"><span>all meetinghouse</span><span>all tabernacle</span></div>
      <p class="rml-ctl-hint" id="rml-balance-plan"></p>
    </div>

    <!-- Auditions -->
    <p class="rml-sec-title">Auditions &mdash; one voice alone in the room</p>
    <div class="rml-keys" id="rml-keys"></div>

    <!-- Depth -->
    <p class="rml-sec-title">Depth &mdash; how far back each voice stands</p>
    <p class="rml-tip" style="margin:0 0 0.7rem">Added to the balance before the crossfade: negative is nearer the ear, positive deeper in the tabernacle.</p>
    <div class="rml-grid" id="rml-depth"></div>

    <!-- Copy panel -->
    <div class="rml-copy-block">
      <div class="rml-copy-row">
        <h2>Share these rooms</h2>
        <button type="button" class="rml-btn" id="rml-copy">Copy settings</button>
        <span class="rml-copy-msg" id="rml-copy-msg">Copied to clipboard!</span>
      </div>
      <textarea class="rml-json" id="rml-json" spellcheck="false" aria-label="room settings as JSON"></textarea>
    </div>

    <a class="rml-foot-link" href="/art/kolob/">&larr; back to Kolob</a>
  </div>
</div>

<script src="../prosperos-jukebox-v2/pj2-fx.js?v=<?php echo rml_v('../prosperos-jukebox-v2/pj2-fx.js'); ?>"></script>
<script src="kolob-audio.js?v=<?php echo rml_v('kolob-audio.js'); ?>"></script>
<script src="room-lab.js?v=<?php echo rml_v('room-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

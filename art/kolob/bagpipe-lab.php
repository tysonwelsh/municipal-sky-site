<?php
// ============================================================================
// BAGPIPE LAB — a timbre workbench for a candidate KOLOB voice.
//
// UNLINKED mockup: not referenced from /art/ or anywhere else. Reachable only
// by its URL (/art/kolob/bagpipe-lab). Purpose: audition and fine-tune a
// reedy, textured "bagpipe" voice to add variety alongside Kolob's smooth
// organs and drones — then COPY the parameters and share them back.
//
// The parameter vocabulary here (detuned saw pairs, bandpass formants, a
// breath-noise layer, a sustained drone bank) is deliberately the same
// vocabulary kolob-audio.js already speaks, so a dialed-in patch translates
// straight into a real KolobAudio voice later.
// ============================================================================
$page_title = "Bagpipe Lab — KOLOB · Municipal Sky";
$page_description = "A private workbench for tuning a bagpipe voice for the Kolob hymn engine.";
function bpl_v($file)
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
/* Scoped to .bpl-* so it never leaks into the rest of the site. */
.bpl {
  --ink: #2b2416;
  --ink-soft: #6b5f47;
  --paper: #f4ecd8;
  --paper-2: #efe6cf;
  --line: #cbbc98;
  --accent: #7a4a1e;
  --accent-2: #a8641f;
  --good: #3f6b3a;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 1080px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
.bpl * { box-sizing: border-box; }
.bpl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.25rem; }
.bpl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--accent); margin: 0 0 0.35rem; }
.bpl-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.bpl-lede { font-size: 1.02rem; color: var(--ink-soft); margin: 0; max-width: 62ch; font-style: italic; }
.bpl-note-tip { font-size: 0.9rem; color: var(--ink-soft); margin: 0.6rem 0 0; max-width: 66ch; }

/* Transport */
.bpl-transport {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
  padding: 0.9rem 1rem; margin-bottom: 1.1rem;
}
.bpl-btn {
  font-family: inherit; font-size: 0.95rem; font-weight: 500;
  border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.12s;
}
.bpl-btn:hover { background: var(--ink); color: var(--paper); }
.bpl-btn.is-on { background: var(--accent); color: #fff; border-color: var(--accent); }
.bpl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bpl-transport-spacer { flex: 1 1 auto; }
.bpl-vol-wrap { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--ink-soft); }
.bpl-vol-wrap input[type=range] { width: 120px; }

/* Presets */
.bpl-presets { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.4rem; }
.bpl-preset {
  flex: 1 1 200px; text-align: left; font-family: inherit; cursor: pointer;
  border: 1px solid var(--line); border-radius: 8px; background: var(--paper);
  padding: 0.7rem 0.85rem; transition: all 0.12s; color: var(--ink);
}
.bpl-preset:hover { border-color: var(--accent); background: #fff8ea; }
.bpl-preset.is-active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); background: #fff8ea; }
.bpl-preset-name { font-weight: 600; font-size: 1.02rem; display: block; }
.bpl-preset-desc { font-size: 0.82rem; color: var(--ink-soft); display: block; margin-top: 0.15rem; line-height: 1.3; }

/* Keyboard / note row */
.bpl-keys-block { margin-bottom: 1.5rem; }
.bpl-keys { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
.bpl-key {
  font-family: inherit; font-size: 0.9rem; min-width: 3.2rem; padding: 0.7rem 0.4rem;
  border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 6px; cursor: pointer; text-align: center; user-select: none; transition: all 0.08s;
}
.bpl-key:hover { background: var(--paper-2); }
.bpl-key.is-playing { background: var(--accent); color: #fff; border-color: var(--accent); }
.bpl-key small { display: block; font-size: 0.68rem; color: var(--ink-soft); }
.bpl-key.is-playing small { color: #f4d9bd; }

/* Controls grid */
.bpl-sec-title { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 1.6rem 0 0.7rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
.bpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 0.9rem 1.4rem; }
.bpl-ctl { display: flex; flex-direction: column; gap: 0.28rem; }
.bpl-ctl-top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.bpl-ctl-label { font-size: 0.92rem; font-weight: 500; }
.bpl-ctl-val { font-size: 0.82rem; color: var(--accent); font-variant-numeric: tabular-nums; font-weight: 600; }
.bpl-ctl-hint { font-size: 0.76rem; color: var(--ink-soft); line-height: 1.25; font-style: italic; }
.bpl input[type=range] { width: 100%; accent-color: var(--accent); cursor: pointer; }
.bpl select { font-family: inherit; font-size: 0.9rem; padding: 0.35rem 0.4rem; border: 1px solid var(--line); border-radius: 5px; background: #fff8ea; color: var(--ink); }

/* Copy panel */
.bpl-copy-block { margin-top: 2.2rem; border: 1px solid var(--ink); border-radius: 8px; background: var(--paper); padding: 1.1rem 1.15rem; }
.bpl-copy-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 0.7rem; }
.bpl-copy-row h2 { font-size: 1.05rem; margin: 0; font-weight: 600; }
.bpl-copy-msg { font-size: 0.85rem; color: var(--good); font-weight: 600; opacity: 0; transition: opacity 0.2s; }
.bpl-copy-msg.show { opacity: 1; }
.bpl-json {
  width: 100%; min-height: 190px; font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.78rem; line-height: 1.45; color: var(--ink); background: #fbf6e9;
  border: 1px solid var(--line); border-radius: 6px; padding: 0.7rem; resize: vertical;
}
.bpl-patch-name { font-family: inherit; font-size: 0.9rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line); border-radius: 5px; background: #fff8ea; color: var(--ink); min-width: 180px; }
.bpl-foot-link { display: inline-block; margin-top: 1.6rem; font-size: 0.9rem; color: var(--accent); }

@media (max-width: 560px) {
  .bpl-title { font-size: 1.7rem; }
  .bpl-grid { grid-template-columns: 1fr 1fr; gap: 0.8rem 1rem; }
}
</style>

<div class="main-wrapper">
  <div class="bpl">

    <header class="bpl-head">
      <p class="bpl-kicker">Kolob · voice workbench · unlisted</p>
      <h1 class="bpl-title">Bagpipe Lab</h1>
      <p class="bpl-lede">A reedy, textured voice to sit against Kolob&rsquo;s smooth organs and
        drones. Start the reed, walk the chanter, dial the timbre, then copy the patch.</p>
      <p class="bpl-note-tip">The reed is <em>continuous</em>, like a real pipe &mdash; press
        <strong>Start reed</strong>, then click the chanter notes to change pitch over the held drones.
        Everything below updates live while it plays. When a sound is dialed in, name it and hit
        <strong>Copy patch</strong> &mdash; then paste it back to me.</p>
    </header>

    <!-- Transport -->
    <div class="bpl-transport">
      <button type="button" class="bpl-btn" id="bpl-reed">Start reed</button>
      <button type="button" class="bpl-btn" id="bpl-drone">Drones: on</button>
      <button type="button" class="bpl-btn" id="bpl-scale">Play a phrase</button>
      <div class="bpl-transport-spacer"></div>
      <div class="bpl-vol-wrap">
        <label for="bpl-master">Volume</label>
        <input type="range" id="bpl-master" min="0" max="100" value="55" />
      </div>
    </div>

    <!-- Presets -->
    <p class="bpl-sec-title">Starting points &mdash; four bagpipe characters</p>
    <div class="bpl-presets" id="bpl-presets"></div>

    <!-- Chanter keys -->
    <div class="bpl-keys-block">
      <p class="bpl-sec-title">The chanter &mdash; nine notes (A&nbsp;Mixolydian)</p>
      <div class="bpl-keys" id="bpl-keys"></div>
    </div>

    <!-- Controls -->
    <div id="bpl-controls"></div>

    <!-- Copy panel -->
    <div class="bpl-copy-block">
      <div class="bpl-copy-row">
        <h2>Share this patch</h2>
        <input type="text" class="bpl-patch-name" id="bpl-patch-name" placeholder="patch name (e.g. Frontier Border)" />
        <button type="button" class="bpl-btn" id="bpl-copy">Copy patch</button>
        <span class="bpl-copy-msg" id="bpl-copy-msg">Copied to clipboard!</span>
      </div>
      <textarea class="bpl-json" id="bpl-json" spellcheck="false" aria-label="patch parameters as JSON"></textarea>
    </div>

    <a class="bpl-foot-link" href="/art/kolob/">&larr; back to KOLOB</a>

  </div>
</div>

<script src="bagpipe-lab.js?v=<?php echo bpl_v('bagpipe-lab.js'); ?>"></script>
<script>if(!window.BagpipeLab)console.error("BAGPIPE LAB FAILED TO LOAD");</script>

<?php include '../../includes/footer.php'; ?>

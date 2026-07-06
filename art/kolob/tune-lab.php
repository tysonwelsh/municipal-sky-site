<?php
// ============================================================================
// TUNE LAB — audition bench for KOLOB's OLD_TUNES pool (the half-remembered
// quotations). UNLINKED dev tool, like the bagpipe lab: reachable only by its
// URL (/art/kolob/tune-lab). Purpose: verify each incipit transcription by
// ear ("plain") and hear the production far-voice treatment ("remembered"),
// across modes, before trusting the pool. The tune data is read live from
// kolob-audio.js — this page holds no copy of it.
// ============================================================================
$page_title = "Tune Lab — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's old-tune pool.";
function otl_v($file)
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
/* Scoped to .otl-* so it never leaks into the rest of the site. */
.otl {
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.62);
  --ink-faint: rgba(30, 77, 59, 0.28);
  --paper: #f5f0e4;
  --paper-2: #ece5d3;
  --gilt: #8a7a45;
  --out: #9a5a3a;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
.otl * { box-sizing: border-box; }
.otl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.otl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.otl-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.otl-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 64ch; font-style: italic; }

.otl-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 1.1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.9rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem;
}
.otl-controls label { display: flex; align-items: center; gap: 0.5rem; }
.otl-controls select, .otl-controls input[type="range"] { font-family: inherit; }
.otl-controls output { min-width: 4.5em; color: var(--ink-soft); }
.otl-controls button {
  font-family: inherit; font-size: 0.92rem; padding: 0.35rem 1rem; cursor: pointer;
  background: var(--paper); color: var(--ink); border: 1px solid var(--ink-soft); border-radius: 4px;
}
.otl-controls button:hover { background: #faf6ec; }

.otl-row {
  display: grid;
  grid-template-columns: 1.3fr 0.8fr 1.2fr auto;
  gap: 0.9rem; align-items: center;
  padding: 0.65rem 0.4rem;
  border-bottom: 1px solid var(--ink-faint);
}
.otl-row-out { opacity: 0.5; }
.otl-names { display: flex; flex-direction: column; }
.otl-tune { font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; font-size: 1.05rem; }
.otl-hymn { font-style: italic; color: var(--ink-soft); font-size: 0.92rem; }
.otl-meta { font-size: 0.85rem; color: var(--ink-soft); }
.otl-verdict { font-size: 0.85rem; }
.otl-verdict.ok { color: var(--ink-soft); }
.otl-verdict.out { color: var(--out); font-style: italic; }
.otl-btns { display: flex; gap: 0.45rem; }
.otl-btns button {
  font-family: inherit; font-size: 0.88rem; padding: 0.3rem 0.85rem; cursor: pointer;
  background: var(--paper); color: var(--ink); border: 1px solid var(--ink-soft); border-radius: 4px;
}
.otl-btns button:hover { background: #faf6ec; }
.otl-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.1rem; max-width: 70ch; }
@media (max-width: 720px) {
  .otl-row { grid-template-columns: 1fr auto; }
  .otl-meta, .otl-verdict { display: none; }
}
</style>

<div class="otl">
  <header class="otl-head">
    <p class="otl-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="otl-title">Tune Lab</h1>
    <p class="otl-lede">The old-tune pool, one incipit at a time. <strong>plain</strong> is the
    transcription check — close, clean, steady; if it sounds wrong here, the degree data is wrong.
    <strong>remembered</strong> is the production treatment — far, worn, +8&cent; flat, at the field's edge.</p>
  </header>

  <div class="otl-controls">
    <label>mode
      <select id="otl-mode">
        <option value="ionian" selected>ionian</option>
        <option value="mixolydian">mixolydian</option>
        <option value="hexa">hexatonic</option>
        <option value="penta">pentatonic</option>
        <option value="aeolian">aeolian</option>
        <option value="dorian">dorian</option>
      </select>
    </label>
    <label>F0 <input type="range" id="otl-f0" min="55" max="80" value="65" step="1" /> <output id="otl-f0-out">65 Hz</output></label>
    <label>beat <input type="range" id="otl-beat" min="0.7" max="1.6" value="1.2" step="0.05" /> <output id="otl-beat-out">1.20 s</output></label>
    <label><input type="checkbox" id="otl-wear" checked /> wear (remembered only)</label>
    <button type="button" id="otl-stop">stop</button>
  </div>

  <div id="otl-tunes"></div>

  <p class="otl-footnote">Grayed rows are tunes the mode law would not quote in the selected mode —
  they still play here (that is the point of a lab), so you can hear <em>why</em> the law exists.
  The two ⚠ tunes were transcribed at medium confidence; verify those against a hymnal first.
  Wear re-rolls on every click of <strong>remembered</strong>.</p>
</div>

<script src="kolob-audio.js?v=<?php echo otl_v('kolob-audio.js'); ?>"></script>
<script src="tune-lab.js?v=<?php echo otl_v('tune-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

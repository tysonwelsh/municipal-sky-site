<?php
// ============================================================================
// EARTH TUNES LAB — the owner's review bench for kolob-tunes.js.
//
// UNLINKED dev page (like tune-lab, room-lab, bagpipe-lab): reachable only by
// URL (/art/kolob/earth-tunes-lab). A menu picks one Earth tune (owner, 2026-09-27),
// and its card shows: its name, the
// public-domain printing it was taken from (with a link to the facsimile),
// the tune engraved part by part the way the source prints it, a player
// (just intonation, a small organ, through a limiter), and the transcriber's
// notes on what is uncertain. The card's player is play, stop and a version
// menu; for the seven tunes v0.30 carried as incipits the menu offers the old
// incipit and "v0.30, then the new first lines", so the two can be compared.
//
// Loads kolob-tunes.js (a pure module), the substrate's PJ2.Clock (the
// lookahead scheduler the organ hands its notes to), and this page's script.
// ============================================================================
$page_title = "Earth Tunes Lab — KOLOB · Municipal Sky";
$page_description = "A private review bench for the Kolob hymn engine's public-domain Earth tunes.";
function etl_v($file)
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
/* Scoped to .etl-* so it never leaks into the rest of the site. */
.etl {
  --ink: #2b2416;
  --ink-soft: #6b5f47;
  --paper: #f4ecd8;
  --paper-2: #efe6cf;
  --sheet: #fbf6ea;
  --line: #cbbc98;
  --accent: #7a4a1e;
  --old: #9a3f2e;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  width: 100%;               /* a flex child with auto margins is sized to its content; on a phone that grows
                                the layout viewport to the widest engraving (the same fix as kolob.css) */
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.5rem 16px 4rem;
}
.etl * { box-sizing: border-box; }
.etl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.etl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--accent); margin: 0 0 0.35rem; }
.etl-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.etl-lede { font-size: 1.02rem; color: var(--ink-soft); margin: 0; max-width: 68ch; font-style: italic; }
.etl-err { color: var(--old); font-size: 0.9rem; white-space: pre-wrap; margin: 0.6rem 0; }

.etl-bar {
  position: sticky; top: 0; z-index: 5;
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1.1rem;
  background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
  padding: 0.7rem 0.9rem; margin-bottom: 1.1rem; font-size: 0.95rem;
}
.etl-bar label { display: flex; align-items: center; gap: 0.45rem; color: var(--ink-soft); }
.etl-bar input[type=range] { width: 130px; accent-color: var(--accent); }
.etl-bar output { min-width: 3.4em; color: var(--ink); }
.etl-now { flex: 1 1 14rem; color: var(--ink-soft); font-style: italic; min-height: 1.3em; }
.etl-btn {
  font-family: inherit; font-size: 0.95rem; font-weight: 500; cursor: pointer;
  border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 5px; padding: 0.4rem 0.85rem; line-height: 1.1;
}
.etl-btn:hover { background: var(--ink); color: var(--paper); }
.etl-btn.is-on { background: var(--accent); border-color: var(--accent); color: #fff; }
.etl-btn.is-old { border-color: var(--old); color: var(--old); }
.etl-btn.is-old:hover, .etl-btn.is-old.is-on { background: var(--old); color: #fff; }

.etl-pickbar { display: flex; align-items: center; gap: 0.7rem; margin: 0 0 0.8rem; }
.etl-pick-label { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); }
.etl-select {
  font-family: inherit; font-size: 1rem; color: var(--ink); background: #fff8ea;
  border: 1px solid var(--ink); border-radius: 5px; padding: 0.35rem 0.6rem; line-height: 1.2; max-width: 100%;
}
.etl-pick { flex: 1 1 auto; min-width: 0; width: 100%; font-size: 1.1rem; font-variant: small-caps; letter-spacing: 0.03em; }
.etl-card, .etl-score { min-width: 0; max-width: 100%; }
.etl-ctl .etl-select { font-size: 0.95rem; }
.etl-ctl .etl-ver-label { font-size: 0.86rem; color: var(--ink-soft); margin-left: 0.3rem; }
.etl-ver { display: inline-flex; align-items: center; gap: 0.45rem; max-width: 100%; }
.etl-now:empty { display: none; }
.etl-sec { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 1.8rem 0 0.7rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }

.etl-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 1rem 1rem 1.1rem; margin: 0 0 1.2rem; }
.etl-card.is-playing { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(122, 74, 30, 0.16); }
.etl-card h2 { font-size: 1.45rem; font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; margin: 0; line-height: 1.1; }
.etl-ds { font-size: 1.05rem; color: var(--ink-soft); margin-left: 0.4rem; font-weight: 400; font-variant: normal; }
.etl-meta { font-size: 0.9rem; color: var(--ink-soft); margin: 0.3rem 0 0.2rem; }
.etl-meta b { color: var(--ink); font-weight: 500; }
.etl-src { font-size: 0.92rem; margin: 0.15rem 0; }
.etl-src a { color: var(--accent); }
.etl-src .etl-x { color: var(--ink-soft); font-size: 0.86rem; }
.etl-lds { margin-top: 0.4rem; padding-left: 0.55rem; border-left: 3px solid var(--line); overflow-wrap: break-word; }
.etl-lds b { font-weight: 600; }
.etl-lds .etl-x a { padding: 0 0.15rem; }
.etl-lds .etl-nw { white-space: nowrap; }
.etl-ctl { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0.7rem 0 0.6rem; align-items: center; }
.etl-ctl .etl-hint { font-size: 0.82rem; color: var(--ink-soft); font-style: italic; }

.etl-score { background: var(--sheet); border: 1px solid var(--line); border-radius: 6px; padding: 0.4rem 0.3rem; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.etl-score svg { display: block; height: auto; max-width: none; }  /* scroll inside the card; never shrink below legibility */
.etl-row + .etl-row { border-top: 1px dashed rgba(107, 95, 71, 0.25); }
.etl-cap { font-size: 0.82rem; font-style: italic; color: var(--accent); margin: 0.35rem 0.4rem 0; max-width: 70ch; }
.etl-tune { font-size: 0.86rem; }
.etl-old { margin-top: 0.6rem; border-color: rgba(154, 63, 46, 0.45); }
.etl-old-cap { font-size: 0.82rem; color: var(--old); margin: 0.1rem 0.4rem 0.2rem; font-style: italic; }

.etl-notes { font-size: 0.93rem; line-height: 1.45; margin: 0.8rem 0 0; color: var(--ink); }
.etl-notes summary { cursor: pointer; color: var(--accent); font-size: 0.9rem; }
.etl-notes p { margin: 0.45rem 0 0; max-width: 78ch; }
.etl-foot { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.6rem; max-width: 72ch; }

/* engraving */
.etl svg .st { stroke: #3a3024; stroke-width: 1; }
.etl svg .bl { stroke: #3a3024; stroke-width: 1.2; }
.etl svg .hd { fill: #1f1a12; stroke: #1f1a12; stroke-width: 1.3; }
.etl svg .hd.op { fill: var(--sheet); }
.etl svg .sm { stroke: #1f1a12; stroke-width: 1.2; }
.etl svg .fl { fill: none; stroke: #1f1a12; stroke-width: 1.4; }
.etl svg .tx { fill: #3a3024; font-family: "EB Garamond", Georgia, serif; }
.etl svg .ac { fill: #1f1a12; font-family: Georgia, serif; }
.etl svg .sl { fill: none; stroke: #4a3d2c; stroke-width: 1; }
.etl svg .cm { fill: var(--accent); font-family: Georgia, serif; font-weight: 600; }
.etl svg .hi .hd { fill: var(--accent); stroke: var(--accent); }
.etl svg .hi .hd.op { fill: #f3d9bd; }

@media (max-width: 640px) {
  .etl-title { font-size: 1.7rem; }
  .etl-bar { position: static; }
  .etl-card { padding: 0.8rem 0.7rem 0.9rem; }
}
</style>

<div class="etl">
  <header class="etl-head">
    <p class="etl-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="etl-title">Earth Tunes Lab</h1>
    <p class="etl-lede">Every Earth tune in <code>kolob-tunes.js</code>, taken down again from a public-domain printing.
    Each card links the facsimile it came from, engraves the parts the book prints (in the book's key and clefs),
    and plays them in just intonation. Choose a tune from the list; for the seven v0.30 carried, the version menu plays
    the old incipit, the new transcription, or one after the other.</p>
    <div class="etl-err" id="etl-err" hidden></div>
  </header>

  <div class="etl-pickbar">
    <label class="etl-pick-label" for="etl-pick">Tune</label>
    <select id="etl-pick" class="etl-select etl-pick"></select>
  </div>
  <div class="etl-bar" id="etl-bar">
    <label>tempo <input type="range" id="etl-tempo" min="0.5" max="1.6" step="0.05" value="1" /> <output id="etl-tempo-out">1.00×</output></label>
    <label><input type="checkbox" id="etl-melody" /> melody only</label>
    <label><input type="checkbox" id="etl-follow" checked /> light the notes</label>
    <label title="Play every degree at its table ratio, without the comma adjustments"><input type="checkbox" id="etl-fixed" /> fixed degrees</label>
    <span class="etl-now" id="etl-now"></span>
  </div>
  <div id="etl-tunes"></div>

  <p class="etl-foot">Pitches are the tunes' own degrees tuned as Kolob tunes them (5-limit just intonation on the
  tune's own do; accidentals as leading tones). Where a chord would sound a sour third, sixth or fifth on the fixed
  degrees, the note that starts there leans a syntonic comma (81/80, about a fifth of a semitone): a small
  <b>+</b> or <b>−</b> beside the head, after Johnston. "Fixed degrees" turns the commas off, to hear what they
  fix. Each part keeps the octave the book writes it in, except that the shape-note tenor, printed in the treble
  clef, sounds an octave down. Rests, fermatas and written-out repeats are the source's; a line's italic caption
  says where the text comes from somewhere other than the cited page. "Light the notes" follows the playing on the
  engraving.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-clock.js?v=<?php echo etl_v('../prosperos-jukebox-v2/pj2-clock.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo etl_v('kolob-tunes.js'); ?>"></script>
<script src="earth-tunes-lab.js?v=<?php echo etl_v('earth-tunes-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

<?php
// ============================================================================
// ORGANIST LAB — the organist's bench.
//
// UNLINKED dev page (like hymn-lab, tune-lab, instruments-lab): reachable only
// by URL (/art/kolob/organist-lab). A seed composes one colony hymn with
// kolob-composer.js; the Sunday's organist is seated (the plain organist, the
// Victorian, the improviser — drawn, or chosen); and the page plays what the
// organist does with it (kolob-organist.js on kolob-voices-pipeorgan.js):
// the chorale prelude on the hymn; then the hymn itself — the tune given out,
// the verses under the ward (thirty-two singers, kolob-voices-vocal.js), the
// fills between the lines, the interludes between the verses, the amen, and
// the modulation to the next hymn's key. Beside it, the engine's own organ
// (organChord, as the meeting plays it today) through the same organ layer
// (0.40), so the two can be heard, and measured, at the same level.
//
// CHECK renders offline (silent) and measures: loudness against the engine's
// organ (the whole hymn, and verse by verse), clicks, the spectrum, the
// organ's chiff, and the engine organ's tremulant as it is and as R1 would
// fix it. OrganistLab.joins() weighs the two breaths at the joins — the
// ward's own and the organ's chiff (the ward's is the larger). COMPARE
// renders all three organists on the same hymn. A MEETING'S WORTH plans four
// hymns with one organist and counts the fills (at most one strange).
//
// Loads the substrate's PJ2.Rand (read-only), the pure rooms in SCORE §1 order
// (pitch, score, tunes, melody, hymnists, dialects, composer), the organist,
// the two voice rooms, and this page's script.
// ============================================================================
$page_title = "Organist Lab — KOLOB · Municipal Sky";
$page_description = "A private bench for the Kolob organist: three organists, the chorale prelude, the hymn given out, accompanied and filled between the lines.";
function kol_v($file)
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
/* Scoped to .kol-* so nothing leaks into the rest of the site. */
.kol {
  --ink: #2b2416;
  --ink-soft: #6b5f47;
  --paper: #f4ecd8;
  --sheet: #fbf6ea;
  --line: #cbbc98;
  --accent: #7a4a1e;
  --ok: #3f6b35;
  --bad: #9a3f2e;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.5rem 16px 4rem;
  box-sizing: border-box;
}
.kol * { box-sizing: border-box; }
.kol-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.kol-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--accent); margin: 0 0 0.35rem; }
.kol-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.kol-lede { font-size: 1.02rem; color: var(--ink-soft); margin: 0; max-width: 70ch; font-style: italic; }
.kol-err { color: var(--bad); font-size: 0.9rem; white-space: pre-wrap; margin: 0.6rem 0; }

.kol-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.6rem 0.9rem; background: var(--paper);
  border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 0.9rem; margin-bottom: 0.8rem; }
.kol-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.78rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.12em; min-width: 0; }
.kol-field select, .kol-field input { font-family: inherit; font-size: 1rem; color: var(--ink); background: #fff8ea; border: 1px solid var(--ink);
  border-radius: 5px; padding: 0.3rem 0.45rem; text-transform: none; letter-spacing: 0; max-width: 100%; }
.kol-field input[type=number] { width: 6.5em; }
.kol-btn { font-family: inherit; font-size: 1rem; font-weight: 500; cursor: pointer; border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 5px; padding: 0.42rem 0.9rem; line-height: 1.1; }
.kol-btn:hover { background: var(--ink); color: var(--paper); }
.kol-btn.is-main { background: var(--accent); border-color: var(--accent); color: #fff; }
.kol-btn.is-main:hover { background: var(--ink); border-color: var(--ink); }
.kol-btn[disabled] { opacity: 0.45; cursor: default; }
.kol-play { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.8rem; margin: 0 0 1rem; font-size: 0.95rem; color: var(--ink-soft); }
.kol-play label { display: inline-flex; align-items: center; gap: 0.35rem; }
.kol-now { flex: 1 1 100%; font-style: italic; min-height: 1.3em; color: var(--ink); }

.kol-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 1rem 1rem 1.1rem; margin: 0 0 1.2rem; min-width: 0; }
.kol-sec { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 0 0 0.6rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
.kol-who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.8rem; }
.kol-name { font-size: 1.6rem; line-height: 1.1; }
.kol-en { font-size: 0.9rem; color: var(--ink-soft); font-variant: small-caps; letter-spacing: 0.05em; }
.kol-meta { font-size: 0.95rem; color: var(--ink-soft); margin: 0.45rem 0 0; overflow-wrap: anywhere; }
.kol-meta b { color: var(--ink); font-weight: 500; }
.kol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 760px) { .kol-grid { grid-template-columns: 1fr; } }
.kol-plan { list-style: none; margin: 0; padding: 0; font-size: 0.92rem; font-variant-numeric: tabular-nums; }
.kol-plan li { padding: 0.12rem 0.3rem; border-radius: 4px; overflow-wrap: anywhere; }
.kol-plan li.on { background: #ecd9b8; }
.kol-plan li .tm { color: var(--ink-soft); margin-right: 0.4rem; }
.kol-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.kol-table th, .kol-table td { text-align: left; padding: 0.22rem 0.35rem; border-bottom: 1px solid rgba(203, 188, 152, 0.6); vertical-align: top; }
.kol-table th { font-weight: 500; color: var(--ink-soft); font-size: 0.8rem; }
.kol-table td.num { font-variant-numeric: tabular-nums; }
.kol-table .in { color: var(--ok); }
.kol-table .out { color: var(--bad); }
.kol-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.kol-note { font-size: 0.95rem; line-height: 1.5; max-width: 76ch; }
.kol-note p { margin: 0 0 0.6rem; }
.kol-cap { font-size: 0.82rem; color: var(--accent); margin: 0.4rem 0 0; font-style: italic; }
.kol-spec { display: block; width: 100%; height: 120px; margin-top: 0.6rem; border: 1px solid var(--line); border-radius: 4px; background: #f5f0e4; }
.kol-spec[hidden] { display: none; }
.kol-table.wide { min-width: 600px; }
@media (max-width: 640px) {
  .kol-title { font-size: 1.7rem; }
  .kol-card { padding: 0.8rem 0.7rem 0.9rem; }
  .kol-name { font-size: 1.3rem; }
}
</style>

<div class="kol">
  <header class="kol-head">
    <p class="kol-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="kol-title">Organist Lab</h1>
    <p class="kol-lede">Every Sunday seats an organist, and every organist plays the same hymn differently. Compose a hymn,
    seat the plain organist, the Victorian or the improviser, and hear the prelude they make of it; then the hymn itself —
    the tune given out, the verses under the ward, what happens between the lines and between the verses, and the walk
    to the next hymn's key. The engine's own organ is here too, at the level the meeting plays it.</p>
    <div class="kol-err" id="kol-err" hidden></div>
  </header>

  <div class="kol-bar">
    <label class="kol-field">seed <input type="number" id="kol-seed" value="1847" min="1" step="1" /></label>
    <label class="kol-field">organist
      <select id="kol-style">
        <option value="">drawn for the Sunday</option>
        <option value="plain">the plain organist</option>
        <option value="victorian">the Victorian</option>
        <option value="improviser">the improviser</option>
      </select></label>
    <label class="kol-field">dialect
      <select id="kol-dialect">
        <option value="tabernacle">C · Tabernacle (organ)</option>
        <option value="sacredharp">A · Sacred Harp (no organ)</option>
        <option value="oldway">F · The Old Way (no organ)</option>
      </select></label>
    <label class="kol-field">verses <select id="kol-verses"><option>1</option><option selected>2</option><option>3</option></select></label>
    <label class="kol-field">hymn of the day <select id="kol-index">
        <option value="0">the first</option><option value="1">the second</option><option value="2">the third</option></select></label>
    <label class="kol-field">next hymn's key <select id="kol-next"></select></label>
    <button class="kol-btn is-main" id="kol-compose" type="button">Compose</button>
    <button class="kol-btn" id="kol-another" type="button">Another</button>
  </div>

  <div class="kol-play">
    <button class="kol-btn is-main" id="kol-play-prelude" type="button" disabled>▶ The prelude</button>
    <button class="kol-btn is-main" id="kol-play-hymn" type="button" disabled>▶ The hymn</button>
    <button class="kol-btn" id="kol-play-ref" type="button" disabled>▶ The engine's organ</button>
    <button class="kol-btn" id="kol-stop" type="button" disabled>■ Stop</button>
    <label><input type="checkbox" id="kol-ward" checked /> the ward sings</label>
    <label title="A diagnostic: the ward's own breath between the notes (VoicesVocal's), which the CAST crew has mended on its branch. Unticked, every singer's breath is 0."><input type="checkbox" id="kol-breath" checked /> the ward's breath</label>
    <span class="kol-now" id="kol-now"></span>
  </div>

  <section class="kol-card" id="kol-who" aria-live="polite"></section>

  <div class="kol-grid">
    <section class="kol-card">
      <h2 class="kol-sec">The prelude, as planned</h2>
      <ul class="kol-plan" id="kol-plan-prelude"></ul>
      <p class="kol-cap" id="kol-cap-prelude"></p>
    </section>
    <section class="kol-card">
      <h2 class="kol-sec">The hymn, as planned</h2>
      <ul class="kol-plan" id="kol-plan-hymn"></ul>
      <p class="kol-cap" id="kol-cap-hymn"></p>
    </section>
  </div>

  <section class="kol-card">
    <h2 class="kol-sec">Check (rendered offline, silent)</h2>
    <p class="kol-note">Renders the organ alone — this organist's prelude and hymn, and the engine's organ as the meeting plays it
    in the prelude and under the singing, all through the same organ layer (0.40) and room — and measures loudness (the
    whole hymn, and verse by verse), clicks, the spectrum, and the organ's own breath (its chiff). <button class="kol-btn" id="kol-check" type="button" disabled>Check</button></p>
    <div class="kol-wrap" id="kol-checkout"></div>
    <canvas class="kol-spec" id="kol-spec" width="960" height="120" hidden></canvas>
  </section>

  <section class="kol-card">
    <h2 class="kol-sec">The three organists, on this hymn</h2>
    <p class="kol-note">Plans and renders the same hymn for each organist and sets what they do side by side: how often they
    fill between the lines, how much they decorate, which stops they draw and what that does to the sound.
    <button class="kol-btn" id="kol-compare" type="button" disabled>Compare</button></p>
    <div class="kol-wrap" id="kol-compareout"></div>
  </section>

  <section class="kol-card">
    <h2 class="kol-sec">A meeting's worth</h2>
    <p class="kol-note">One organist, four hymns (one of them Sacred Harp, sung without the organ), three verses each: the fills
    counted, the strange ones (at most one a meeting) marked. <button class="kol-btn" id="kol-meeting" type="button" disabled>Plan a meeting</button>
    <button class="kol-btn" id="kol-find" type="button" disabled>Find a strange fill</button></p>
    <div class="kol-wrap" id="kol-meetingout"></div>
  </section>

  <section class="kol-card kol-note" id="kol-listen"></section>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo kol_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo kol_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-score.js?v=<?php echo kol_v('kolob-score.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo kol_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-melody.js?v=<?php echo kol_v('kolob-melody.js'); ?>"></script>
<script src="kolob-hymnists.js?v=<?php echo kol_v('kolob-hymnists.js'); ?>"></script>
<script src="kolob-dialects.js?v=<?php echo kol_v('kolob-dialects.js'); ?>"></script>
<script src="kolob-composer.js?v=<?php echo kol_v('kolob-composer.js'); ?>"></script>
<script src="kolob-voices-vocal.js?v=<?php echo kol_v('kolob-voices-vocal.js'); ?>"></script>
<script src="kolob-voices-pipeorgan.js?v=<?php echo kol_v('kolob-voices-pipeorgan.js'); ?>"></script>
<script src="kolob-organist.js?v=<?php echo kol_v('kolob-organist.js'); ?>"></script>
<script src="organist-lab.js?v=<?php echo kol_v('organist-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

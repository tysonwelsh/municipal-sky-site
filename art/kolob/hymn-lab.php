<?php
// ============================================================================
// HYMN LAB — the owner's listening checkpoint for the hymn composer.
//
// UNLINKED dev page (like tune-lab, earth-tunes-lab, voices-lab): reachable
// only by URL (/art/kolob/hymn-lab). A seed, a dialect (all six: the Sacred
// Harp, New England psalmody, the Tabernacle, gospel and barbershop, Shaker
// and Primary, the Old Way), a mode, a meter and a hymnist; "compose" writes
// one colony hymn with kolob-composer.js, engraves it the way its dialect's
// books print it, and plays it with the full ward of thirty-two singers
// (kolob-voices-vocal.js) — with the pipe organ (kolob-voices-pipeorgan.js)
// where the dialect has one — through a limiter at the app's loudness.
// "Compose another" is the next seed. The panel shows what the hymn
// measured and the checks it passed; "the spread" composes two dozen and
// shows whether they all end alike. Below: a round, the partner hymn and the
// wandering refrain (round 3).
//
// Loads the substrate's PJ2.Rand (read-only), the pure rooms in SCORE §1
// order (pitch, score, tunes, melody, hymnists, dialects, composer), the two
// voice rooms, and this page's script.
// ============================================================================
$page_title = "Hymn Lab — KOLOB · Municipal Sky";
$page_description = "A private bench for the Kolob hymn composer: new colony hymns in six dialects, rounds, partner hymns and a wandering refrain, engraved and sung.";
function khl_v($file)
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
/* Scoped to .khl-* so nothing leaks into the rest of the site. */
.khl {
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
.khl * { box-sizing: border-box; }
.khl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.khl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--accent); margin: 0 0 0.35rem; }
.khl-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.khl-lede { font-size: 1.02rem; color: var(--ink-soft); margin: 0; max-width: 70ch; font-style: italic; }
.khl-err { color: var(--bad); font-size: 0.9rem; white-space: pre-wrap; margin: 0.6rem 0; }

.khl-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.6rem 0.9rem; background: var(--paper);
  border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 0.9rem; margin-bottom: 0.8rem; }
.khl-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.78rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.12em; min-width: 0; }
.khl-field select, .khl-field input { font-family: inherit; font-size: 1rem; color: var(--ink); background: #fff8ea; border: 1px solid var(--ink);
  border-radius: 5px; padding: 0.3rem 0.45rem; text-transform: none; letter-spacing: 0; max-width: 100%; }
.khl-field input[type=number] { width: 6.5em; }
.khl-field[hidden] { display: none; }
.khl-btn { font-family: inherit; font-size: 1rem; font-weight: 500; cursor: pointer; border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 5px; padding: 0.42rem 0.9rem; line-height: 1.1; }
.khl-btn:hover { background: var(--ink); color: var(--paper); }
.khl-btn.is-main { background: var(--accent); border-color: var(--accent); color: #fff; }
.khl-btn.is-main:hover { background: var(--ink); border-color: var(--ink); }
.khl-btn[disabled] { opacity: 0.45; cursor: default; }
.khl-play { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin: 0 0 1rem; font-size: 0.95rem; color: var(--ink-soft); }
.khl-play label { display: inline-flex; align-items: center; gap: 0.35rem; }
.khl-play input[type=range] { width: 110px; accent-color: var(--accent); }
.khl-now { flex: 1 1 14rem; font-style: italic; min-height: 1.3em; }

.khl-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 1rem 1rem 1.1rem; margin: 0 0 1.2rem; min-width: 0; }
.khl-board { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.8rem; }
.khl-num { font-size: 2rem; font-weight: 600; line-height: 1; }
.khl-name { font-size: 1.6rem; line-height: 1.1; }
.khl-en { font-size: 0.9rem; color: var(--ink-soft); font-variant: small-caps; letter-spacing: 0.05em; }
.khl-meta { font-size: 0.95rem; color: var(--ink-soft); margin: 0.45rem 0 0; }
.khl-meta b { color: var(--ink); font-weight: 500; }
.khl-about { font-size: 0.92rem; font-style: italic; color: var(--ink-soft); margin: 0.35rem 0 0; max-width: 78ch; }

.khl-score { background: var(--sheet); border: 1px solid var(--line); border-radius: 6px; padding: 0.4rem 0.3rem; margin-top: 0.8rem; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.khl-score svg { display: block; height: auto; max-width: none; }
.khl-row + .khl-row { border-top: 1px dashed rgba(107, 95, 71, 0.25); }
.khl-cap { font-size: 0.8rem; color: var(--accent); margin: 0.3rem 0.4rem 0; font-style: italic; }

.khl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 760px) { .khl-grid { grid-template-columns: 1fr; } }
.khl-sec { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 0 0 0.6rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
.khl-checks { list-style: none; margin: 0; padding: 0; font-size: 0.93rem; }
.khl-checks li { margin: 0 0 0.45rem; padding-left: 1.4em; text-indent: -1.4em; overflow-wrap: anywhere; }
.khl-checks .ok::before { content: "✓ "; color: var(--ok); font-weight: 600; }
.khl-checks .no::before { content: "✗ "; color: var(--bad); font-weight: 600; }
.khl-checks .soft::before { content: "~ "; color: var(--accent); font-weight: 600; }
.khl-checks small { color: var(--ink-soft); }
.khl-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.khl-table th, .khl-table td { text-align: left; padding: 0.22rem 0.35rem; border-bottom: 1px solid rgba(203, 188, 152, 0.6); vertical-align: top; }
.khl-table th { font-weight: 500; color: var(--ink-soft); font-size: 0.8rem; }
.khl-table td.num { font-variant-numeric: tabular-nums; }
.khl-table .in { color: var(--ok); }
.khl-table .out { color: var(--bad); }
.khl-wrap { overflow-x: auto; }
.khl-note { font-size: 0.95rem; line-height: 1.5; max-width: 76ch; }
.khl-note p { margin: 0 0 0.6rem; }
.khl-spread pre { font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem; white-space: pre-wrap; margin: 0.4rem 0 0; color: var(--ink); }

/* engraving */
.khl svg .st { stroke: #3a3024; stroke-width: 1; }
.khl svg .bl { stroke: #3a3024; stroke-width: 1.2; }
.khl svg .hd { fill: #1f1a12; stroke: #1f1a12; stroke-width: 1.2; }
.khl svg .hd.op { fill: var(--sheet); }
.khl svg .sm { stroke: #1f1a12; stroke-width: 1.1; }
.khl svg .fl { fill: none; stroke: #1f1a12; stroke-width: 1.3; }
.khl svg .tx { fill: #3a3024; font-family: "EB Garamond", Georgia, serif; }
.khl svg .ac { fill: #1f1a12; font-family: Georgia, serif; }
.khl svg .sl { fill: none; stroke: #4a3d2c; stroke-width: 1; }
.khl svg .cm { fill: var(--accent); font-family: Georgia, serif; font-weight: 600; }
.khl svg .rn { fill: var(--ink-soft); font-family: "EB Garamond", Georgia, serif; font-style: italic; }
.khl svg .or { fill: var(--accent); font-family: Georgia, serif; }
.khl svg .rn.rg { fill: var(--accent); font-weight: 600; }
.khl svg .hi .hd { fill: var(--accent); stroke: var(--accent); }
.khl svg .hi .hd.op { fill: #f3d9bd; }

@media (max-width: 640px) {
  .khl-title { font-size: 1.7rem; }
  .khl-card { padding: 0.8rem 0.7rem 0.9rem; }
  .khl-name { font-size: 1.3rem; }
}
</style>

<div class="khl">
  <header class="khl-head">
    <p class="khl-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="khl-title">Hymn Lab</h1>
    <p class="khl-lede">New hymns by the colony's own hymnists, in all six of the ward's harmonic languages. Choose a seed and a
    dialect, compose, and the hymn is engraved the way its books print it and sung by the full ward of thirty-two
    — with the organ where the dialect has one. "Compose another" writes the next. Further down: a round, a partner
    hymn written on this one's chords, and the meeting's wandering refrain.</p>
    <div class="khl-err" id="khl-err" hidden></div>
  </header>

  <div class="khl-bar">
    <label class="khl-field">seed <input type="number" id="khl-seed" value="1847" min="1" step="1" /></label>
    <label class="khl-field">dialect
      <select id="khl-dialect">
        <option value="sacredharp">A · Sacred Harp</option>
        <option value="psalmody">B · New England psalmody (the fuging tune)</option>
        <option value="tabernacle" selected>C · Tabernacle</option>
        <option value="gospel">D · Gospel and barbershop</option>
        <option value="shaker">E · Shaker and Primary</option>
        <option value="oldway">F · The Old Way</option>
      </select></label>
    <label class="khl-field" id="khl-kindf">kind <select id="khl-kind"></select></label>
    <label class="khl-field">mode <select id="khl-mode"></select></label>
    <label class="khl-field">meter <select id="khl-meter"></select></label>
    <label class="khl-field">hymnist <select id="khl-hymnist"></select></label>
    <label class="khl-field">key <select id="khl-key"></select></label>
    <button class="khl-btn is-main" id="khl-compose" type="button">Compose</button>
    <button class="khl-btn" id="khl-another" type="button">Compose another</button>
  </div>

  <div class="khl-play">
    <button class="khl-btn is-main" id="khl-playbtn" type="button" disabled>▶ Play</button>
    <button class="khl-btn" id="khl-stop" type="button" disabled>■ Stop</button>
    <label><input type="checkbox" id="khl-organ" checked /> organ</label>
    <label><input type="checkbox" id="khl-lined" checked /> lined out</label>
    <label title="the singers' breath: the aspiration in the tone and the intake between lines"><input type="checkbox" id="khl-breath" checked /> breath</label>
    <label title="the room's reverberation (the church's echo)"><input type="checkbox" id="khl-room" checked /> room</label>
    <label>verses <select id="khl-verses"><option>1</option><option selected>2</option><option>3</option></select></label>
    <label>tempo <input type="range" id="khl-tempo" min="0.6" max="1.4" step="0.05" value="1" /> <output id="khl-tempo-out">1.00×</output></label>
    <span class="khl-now" id="khl-now"></span>
  </div>

  <section class="khl-card" id="khl-hymn" aria-live="polite"></section>

  <div class="khl-grid">
    <section class="khl-card">
      <h2 class="khl-sec">The checks it passed</h2>
      <ul class="khl-checks" id="khl-checks"></ul>
    </section>
    <section class="khl-card">
      <h2 class="khl-sec">What it measured</h2>
      <div class="khl-wrap" id="khl-fp"></div>
    </section>
  </div>
  <section class="khl-card">
    <h2 class="khl-sec">How it was planned (before any note)</h2>
    <div class="khl-wrap" id="khl-plan"></div>
  </section>
  <section class="khl-card khl-spread">
    <h2 class="khl-sec">The spread: do they all end alike?</h2>
    <p class="khl-note">Composes twenty-four hymns in this dialect (the next twenty-four seeds, same settings) and counts how
    they end, where they peak, and what they measure against the Earth tunes. <button class="khl-btn" id="khl-spreadbtn" type="button">Run the spread</button></p>
    <div id="khl-spreadout"></div>
  </section>
  <section class="khl-card khl-note" id="khl-listen"></section>

  <section class="khl-card">
    <h2 class="khl-sec">A round</h2>
    <p class="khl-note">One tune cut into segments over one short repeating ground, so the ward can sing it as a canon: the
    sopranos start, and at each new segment another part comes in at the top. Written segment by segment against the ground and
    against every segment already written; then every pair that ever sounds together is heard, and the round is told how many
    entries it can carry. (The Shakers' and the Primary's; choose the psalmody above for a Billings round.)</p>
    <div class="khl-play">
      <button class="khl-btn" id="khl-roundbtn" type="button">Compose a round</button>
      <button class="khl-btn is-main" id="khl-roundplay" type="button" disabled>▶ Sing it as a round</button>
      <button class="khl-btn" id="khl-roundstop" type="button" disabled>■ Stop</button>
    </div>
    <div id="khl-roundout"></div>
  </section>

  <section class="khl-card">
    <h2 class="khl-sec">The partner hymn</h2>
    <p class="khl-note">A closing hymn written on the chords and the meter of the hymn above, so that in its last verse the
    organ can play the first hymn against it and the two turn out to be one piece. A strict fit check hears the two tunes together
    at every onset; if they do not fit, the closing hymn is its own and they are not combined. Play: the first hymn, the closing
    hymn, then — when they fit — the two together (the first on the organ's trumpet stop, an octave up).</p>
    <div class="khl-play">
      <button class="khl-btn" id="khl-partnerbtn" type="button">Compose the partner</button>
      <button class="khl-btn is-main" id="khl-partnerplay" type="button" disabled>▶ Both, then together</button>
      <button class="khl-btn" id="khl-partnerstop" type="button" disabled>■ Stop</button>
    </div>
    <div id="khl-partnerout"></div>
  </section>

  <section class="khl-card">
    <h2 class="khl-sec">The wandering refrain</h2>
    <p class="khl-note">Two lines in the camp-meeting lilt that belong to the meeting rather than to any one hymn: sung after the
    first hymn, again after a later one in that hymn's key, and in the doxology. Written so its compass and its close sit well in
    every key of the day (here: the lab's key, a fourth up, a fifth down), and set in the hymn above's dialect. Play: the three
    keys in turn — the first time, one enthusiast starts it alone.</p>
    <div class="khl-play">
      <button class="khl-btn" id="khl-refrainbtn" type="button">Compose the refrain</button>
      <button class="khl-btn is-main" id="khl-refrainplay" type="button" disabled>▶ In each key of the day</button>
      <button class="khl-btn" id="khl-refrainstop" type="button" disabled>■ Stop</button>
    </div>
    <div id="khl-refrainout"></div>
  </section>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo khl_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-pitch.js?v=<?php echo khl_v('kolob-pitch.js'); ?>"></script>
<script src="kolob-score.js?v=<?php echo khl_v('kolob-score.js'); ?>"></script>
<script src="kolob-tunes.js?v=<?php echo khl_v('kolob-tunes.js'); ?>"></script>
<script src="kolob-melody.js?v=<?php echo khl_v('kolob-melody.js'); ?>"></script>
<script src="kolob-hymnists.js?v=<?php echo khl_v('kolob-hymnists.js'); ?>"></script>
<script src="kolob-dialects.js?v=<?php echo khl_v('kolob-dialects.js'); ?>"></script>
<script src="kolob-composer.js?v=<?php echo khl_v('kolob-composer.js'); ?>"></script>
<script src="kolob-voices-vocal.js?v=<?php echo khl_v('kolob-voices-vocal.js'); ?>"></script>
<script src="kolob-voices-pipeorgan.js?v=<?php echo khl_v('kolob-voices-pipeorgan.js'); ?>"></script>
<script src="hymn-lab.js?v=<?php echo khl_v('hymn-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

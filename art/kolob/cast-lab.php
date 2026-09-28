<?php
// ============================================================================
// CAST LAB — the Sunday's ward, and the people in it (KOLOB.Cast).
//
// UNLINKED dev page (like hymn-lab, voices-lab): reachable only by URL
// (/art/kolob/cast-lab). A seed seats a ward — thirty-two members in the
// pews, eight to a part, and the eight to twelve people you come to know —
// and composes a hymn (KOLOB.Composer) for them to sing: the chorister's
// keying or the Sacred Harp's pitching first, then the verses, each in its
// practice (sung, on the notes, lined out, hummed, in unison, with a
// descant), with one or two of the people coming forward at a time. The
// seating chart shows who is who, and lights whoever is singing forward.
//
// Loads the engine (_engine.php: for the bench's "a meeting underneath"),
// then the lab rooms this page adds: the vocal voices, the pipe organ and
// the cast. Everything audible goes through the voices lab's master chain
// and a limiter: never louder than the app. The bench renders offline and
// measures (the join hiss, clicks, the node budget, render speed) and runs
// the phone test (real time, a meeting underneath; the CPU throttle is set
// by the headless driver).
// ============================================================================
$page_title = "Cast Lab — KOLOB · Municipal Sky";
$page_description = "A private bench for the Kolob cast: the Sunday's ward, its people, and a hymn sung by them.";
function kcl_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}
$kolob_engine = require __DIR__ . '/_engine.php';
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />

<style>
/* Scoped to .kcl-* so nothing leaks into the rest of the site. The hymnbook
   paper of the other labs; the four parts in four inks. */
.kcl {
  --ink: #2b2416;
  --ink-soft: #6b5f47;
  --paper: #f4ecd8;
  --sheet: #fbf6ea;
  --line: #cbbc98;
  --accent: #7a4a1e;
  --ok: #3f6b35;
  --bad: #9a3f2e;
  --pS: #a8452f;
  --pA: #b07d1f;
  --pT: #2f6b4f;
  --pB: #2d4a6b;
  --pC: #8a5a9a;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.5rem 16px 4rem;
  box-sizing: border-box;
}
.kcl * { box-sizing: border-box; }
.kcl [hidden] { display: none !important; }
.kcl-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.kcl-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--accent); margin: 0 0 0.35rem; }
.kcl-title { font-size: 2.1rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.kcl-lede { font-size: 1.02rem; color: var(--ink-soft); margin: 0; max-width: 70ch; font-style: italic; }
.kcl-err { color: var(--bad); font-size: 0.9rem; white-space: pre-wrap; margin: 0.6rem 0; }

.kcl-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.6rem 0.9rem; background: var(--paper);
  border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 0.9rem; margin-bottom: 0.8rem; }
.kcl-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.78rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.12em; min-width: 0; }
.kcl-field select, .kcl-field input { font-family: inherit; font-size: 1rem; color: var(--ink); background: #fff8ea; border: 1px solid var(--ink);
  border-radius: 5px; padding: 0.3rem 0.45rem; text-transform: none; letter-spacing: 0; max-width: 100%; }
.kcl-field input[type=number] { width: 6.5em; }
.kcl-check { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.95rem; color: var(--ink-soft); }
.kcl-btn { font-family: inherit; font-size: 1rem; font-weight: 500; cursor: pointer; border: 1px solid var(--ink); background: #fff8ea; color: var(--ink);
  border-radius: 5px; padding: 0.42rem 0.9rem; line-height: 1.1; }
.kcl-btn:hover { background: var(--ink); color: var(--paper); }
.kcl-btn.is-main { background: var(--accent); border-color: var(--accent); color: #fff; }
.kcl-btn.is-main:hover { background: var(--ink); border-color: var(--ink); }
.kcl-btn[disabled] { opacity: 0.45; cursor: default; }
.kcl-play { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin: 0 0 1rem; font-size: 0.95rem; color: var(--ink-soft); }
.kcl-now { flex: 1 1 14rem; font-style: italic; min-height: 1.3em; }

.kcl-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 1rem 1rem 1.1rem; margin: 0 0 1.2rem; min-width: 0; }
.kcl-sec { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 0 0 0.6rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
.kcl-board { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.8rem; }
.kcl-num { font-size: 2rem; font-weight: 600; line-height: 1; }
.kcl-name { font-size: 1.6rem; line-height: 1.1; overflow-wrap: anywhere; }
.kcl-en { font-size: 0.9rem; color: var(--ink-soft); font-variant: small-caps; letter-spacing: 0.05em; }
.kcl-meta { font-size: 0.95rem; color: var(--ink-soft); margin: 0.45rem 0 0; }
.kcl-meta b { color: var(--ink); font-weight: 500; }

.kcl-verses { list-style: none; margin: 0.7rem 0 0; padding: 0; display: grid; gap: 0.35rem; }
.kcl-verses li { font-size: 0.95rem; padding: 0.3rem 0.5rem; border-left: 3px solid var(--line); background: var(--sheet); border-radius: 0 5px 5px 0; overflow-wrap: anywhere; }
.kcl-verses li.is-now { border-left-color: var(--accent); background: #f7e5cf; }
.kcl-verses b { font-weight: 600; }
.kcl-verses small { color: var(--ink-soft); }

.kcl-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1rem; }
@media (max-width: 760px) { .kcl-grid { grid-template-columns: minmax(0, 1fr); } }
.kcl-chart { width: 100%; height: auto; display: block; background: var(--sheet); border: 1px solid var(--line); border-radius: 6px; }
.kcl-chart .pew { stroke: #d9ccab; stroke-width: 1; }
.kcl-chart .lbl { fill: var(--ink-soft); font-family: "EB Garamond", Georgia, serif; font-size: 11px; }
.kcl-chart .ds { fill: var(--ink); font-family: "EB Garamond", Georgia, serif; font-size: 12px; }
.kcl-chart .seat { stroke: #fbf6ea; stroke-width: 1.2; opacity: 0.5; transition: opacity 0.15s; }
.kcl-chart .seat.sing { opacity: 1; }
.kcl-chart .ring { fill: none; stroke: var(--ink); stroke-width: 1.4; }
.kcl-chart .glow { fill: none; stroke: var(--accent); stroke-width: 3; opacity: 0; transition: opacity 0.2s; }
.kcl-chart .fwd .glow { opacity: 0.9; }
.kcl-chart .badge { fill: var(--ink); font-family: Georgia, serif; font-size: 10px; font-weight: 600; }
.kcl-chart .pS { fill: var(--pS); } .kcl-chart .pA { fill: var(--pA); } .kcl-chart .pT { fill: var(--pT); } .kcl-chart .pB { fill: var(--pB); } .kcl-chart .pchild { fill: var(--pC); }
.kcl-legend { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; font-size: 0.85rem; color: var(--ink-soft); margin: 0.5rem 0 0; }
.kcl-legend i { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; margin-right: 0.3em; vertical-align: -0.05em; }

.kcl-people { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
.kcl-people li { background: var(--sheet); border: 1px solid var(--line); border-radius: 6px; padding: 0.45rem 0.6rem; font-size: 0.9rem; transition: background 0.2s, border-color 0.2s; }
.kcl-people li.fwd { border-color: var(--accent); background: #f7e5cf; }
.kcl-people .who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.1rem 0.5rem; }
.kcl-people .n { font-family: Georgia, serif; font-weight: 600; font-size: 0.8rem; color: var(--paper); background: var(--ink); border-radius: 50%; width: 1.35em; height: 1.35em; display: inline-flex; align-items: center; justify-content: center; }
.kcl-people .role { font-variant: small-caps; letter-spacing: 0.04em; color: var(--accent); }
.kcl-people .dsn { font-size: 1.12rem; overflow-wrap: anywhere; }
.kcl-people .en { font-size: 0.8rem; color: var(--ink-soft); }
.kcl-people .desc { color: var(--ink-soft); font-style: italic; margin: 0.15rem 0 0; }
.kcl-people .traits, .kcl-people .moments { margin: 0.15rem 0 0; font-size: 0.84rem; color: var(--ink-soft); }
.kcl-people .moments b { color: var(--ink); font-weight: 500; }

.kcl-log { list-style: none; margin: 0; padding: 0; font-size: 0.9rem; max-height: 22rem; overflow-y: auto; }
.kcl-log li { display: grid; grid-template-columns: 3.4em minmax(0, 1fr); gap: 0.5rem; padding: 0.18rem 0.2rem; border-bottom: 1px dashed rgba(203, 188, 152, 0.55); }
.kcl-log li.done { color: var(--ink); } .kcl-log li.todo { color: var(--ink-soft); opacity: 0.7; }
.kcl-log li.is-now { background: #f7e5cf; }
.kcl-log .t { font-variant-numeric: tabular-nums; color: var(--ink-soft); }
.kcl-log span { overflow-wrap: anywhere; }

.kcl-bench { font-size: 0.92rem; }
.kcl-bench table { border-collapse: collapse; width: 100%; font-size: 0.88rem; margin: 0.5rem 0; }
.kcl-bench td, .kcl-bench th { text-align: left; padding: 0.2rem 0.4rem; border-bottom: 1px solid rgba(203, 188, 152, 0.6); vertical-align: top; overflow-wrap: anywhere; }
.kcl-bench th { font-weight: 500; color: var(--ink-soft); }
.kcl-bench .ok { color: var(--ok); } .kcl-bench .no { color: var(--bad); font-weight: 600; }
.kcl-bench canvas { width: 100%; height: auto; display: block; border: 1px solid var(--line); border-radius: 4px; background: #fff; margin-top: 0.5rem; }
.kcl-wrap { overflow-x: auto; }
.kcl-note { font-size: 0.93rem; line-height: 1.5; max-width: 76ch; color: var(--ink-soft); }

@media (max-width: 640px) {
  .kcl-title { font-size: 1.7rem; }
  .kcl-card { padding: 0.8rem 0.7rem 0.9rem; }
  .kcl-name { font-size: 1.3rem; }
}
</style>

<div class="kcl">
  <header class="kcl-head">
    <p class="kcl-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="kcl-title">Cast Lab</h1>
    <p class="kcl-lede">Every visit seats a different ward. A seed seats this Sunday's: thirty-two in the pews, eight to a
    part, and among them the people you come to know — the chorister, the precentor, the soloist, the old bass, the harmony
    alto, the enthusiast, a child, a newcomer, the ones who will bear their testimonies. Compose a hymn and hear them sing it:
    the keying first, then the verses, one or two of them coming forward at a time.</p>
    <div class="kcl-err" id="kcl-err" hidden></div>
  </header>

  <div class="kcl-bar">
    <label class="kcl-field">seed <input type="number" id="kcl-seed" value="3" min="1" step="1" /></label>
    <label class="kcl-field">dialect
      <select id="kcl-dialect">
        <option value="tabernacle">C · Tabernacle</option>
        <option value="sacredharp">A · Sacred Harp</option>
        <option value="oldway">F · The Old Way</option>
      </select></label>
    <label class="kcl-field">mode <select id="kcl-mode"></select></label>
    <label class="kcl-field">verses <select id="kcl-verses"><option value="">as the dialect draws</option><option>2</option><option>3</option><option>4</option></select></label>
    <label class="kcl-check"><input type="checkbox" id="kcl-organ" checked /> organ (Tabernacle)</label>
    <label class="kcl-check"><input type="checkbox" id="kcl-first" checked /> the day's first hymn</label>
    <button class="kcl-btn is-main" id="kcl-build" type="button">Seat the ward &amp; compose</button>
    <button class="kcl-btn" id="kcl-another" type="button">Another Sunday</button>
  </div>

  <div class="kcl-play">
    <button class="kcl-btn is-main" id="kcl-playbtn" type="button" disabled>▶ Play</button>
    <button class="kcl-btn" id="kcl-stop" type="button" disabled>■ Stop</button>
    <span class="kcl-now" id="kcl-now"></span>
  </div>

  <section class="kcl-card" id="kcl-hymn" aria-live="polite"></section>

  <div class="kcl-grid">
    <section class="kcl-card">
      <h2 class="kcl-sec">The ward</h2>
      <div id="kcl-chartbox"></div>
      <p class="kcl-legend" id="kcl-legend"></p>
    </section>
    <section class="kcl-card">
      <h2 class="kcl-sec">Who is who</h2>
      <ul class="kcl-people" id="kcl-people"></ul>
    </section>
  </div>

  <section class="kcl-card">
    <h2 class="kcl-sec">The hymn as it goes (the log, in Deseret as the app will print it)</h2>
    <ul class="kcl-log" id="kcl-log"></ul>
  </section>

  <section class="kcl-card kcl-bench">
    <h2 class="kcl-sec">The bench</h2>
    <p class="kcl-note">Offline renders through the same chain (an OfflineAudioContext), so they measure what you hear, and
    their speed is a CPU reading. The join meter reads the 3–12 kHz band in the 150 ms around every note join (the hiss the
    owner heard lived there), with the singers' folds silenced as well, so the breath and the consonants can be read alone.
    The phone test plays the hymn in real time with a whole meeting underneath (the app's engine, in the same audio
    context) and reports whether the audio clock and the pump kept up; the headless driver sets the CPU throttle, which
    slows this page's main thread, not the audio thread. The headroom test measures the audio thread: how many plain
    probe voices it can still carry alone, under the meeting, and under the meeting and the ward — and so what share a
    phone four times slower would need.</p>
    <div class="kcl-play">
      <button class="kcl-btn" id="kcl-measure" type="button" disabled>Render &amp; measure the joins</button>
      <button class="kcl-btn" id="kcl-stress" type="button" disabled>Phone test (60&nbsp;s)</button>
      <button class="kcl-btn" id="kcl-headroom" type="button" disabled>Headroom test (about 5&nbsp;min)</button>
    </div>
    <div class="kcl-wrap" id="kcl-report"></div>
    <canvas id="kcl-spec" width="1000" height="260" hidden></canvas>
  </section>
</div>

<?php kolob_engine_tags($kolob_engine, 'kcl_v'); ?>
<script src="kolob-voices-vocal.js?v=<?php echo kcl_v('kolob-voices-vocal.js'); ?>"></script>
<script src="kolob-voices-pipeorgan.js?v=<?php echo kcl_v('kolob-voices-pipeorgan.js'); ?>"></script>
<script src="kolob-cast.js?v=<?php echo kcl_v('kolob-cast.js'); ?>"></script>
<script src="cast-lab.js?v=<?php echo kcl_v('cast-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

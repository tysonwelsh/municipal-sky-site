<?php
// ============================================================================
// QUESTION LAB — the audition bench for KOLOB.Question (kolob-question.js),
// the Unanswered Question composed afresh for every seed (PLAN-COMPOSITION
// §8.1). UNLINKED dev page, like tune-lab and room-lab: reachable only by URL
// (/art/kolob/question-lab). Shows a visit's bank of seven questions, spelled
// into the meeting's mode and engraved plainly; which question each of the
// visit's meetings asks; plays each one; performs a meeting's whole event
// (three askings, the answers, the drone or the strings' chorale beneath);
// and measures the generator over 200 visits. It loads only the substrate's
// rand stream and the pure module; the voices it plays are the lab's own
// copies.
// ============================================================================
$page_title = "Question Lab — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's Unanswered Question.";
function oql_v($file)
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
/* Scoped to .oql-* so it never leaks into the rest of the site. */
.oql {
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.66);
  --ink-faint: rgba(30, 77, 59, 0.26);
  --paper: #f5f0e4;
  --paper-2: #ece5d3;
  --gilt: #8a7a45;
  --out: #9a5a3a;
  --lit: #fbf3d9;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 1000px;
  width: 100%;
  min-width: 0;
  margin: 0 auto;
  padding: 1.5rem 16px 4rem;
}
.oql * { box-sizing: border-box; }
.oql-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.oql-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.oql-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.oql-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 68ch; font-style: italic; }

.oql-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.8rem 1.1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.9rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem;
}
.oql-controls label { display: flex; align-items: center; gap: 0.45rem; }
.oql-controls input[type="number"] { width: 7em; }
.oql-controls select, .oql-controls input { font-family: inherit; font-size: 0.95rem; }
.oql button {
  font-family: inherit; font-size: 0.92rem; padding: 0.32rem 0.95rem; cursor: pointer;
  background: var(--paper); color: var(--ink); border: 1px solid var(--ink-soft); border-radius: 4px;
}
.oql button:hover { background: #faf6ec; }
.oql button.oql-go { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.oql button.oql-go:hover { background: #2a6450; }
.oql-now { font-style: italic; color: var(--ink-soft); min-height: 1.3em; flex-basis: 100%; }

.oql-h2 { font-size: 1.2rem; font-weight: 600; margin: 1.6rem 0 0.6rem; font-variant: small-caps; letter-spacing: 0.05em; }
.oql-bank { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap: 0.8rem; }
.oql-card {
  border: 1px solid var(--ink-faint); border-radius: 8px; padding: 0.7rem 0.8rem 0.75rem; background: #fffdf7;
  display: flex; flex-direction: column; gap: 0.35rem;
}
.oql-card.lit { background: var(--lit); border-color: var(--gilt); box-shadow: 0 0 0 1px var(--gilt) inset; }
.oql-card.out { background: var(--paper); border-style: dashed; }
.oql-visit { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.9rem; }
.oql .oql-chip { font-size: 0.8rem; line-height: 1.25; padding: 0.3rem 0.6rem; text-align: left; }
.oql .oql-chip b { font-weight: 600; font-variant: small-caps; }
.oql .oql-chip.on { background: var(--lit); border-color: var(--gilt); box-shadow: 0 0 0 1px var(--gilt) inset; }
.oql-card-top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.oql-card-name { font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; }
.oql-card-tag { font-size: 0.8rem; color: var(--gilt); font-style: italic; }
.oql-staff { width: 100%; height: auto; display: block; }
.oql-sol { font-size: 0.92rem; letter-spacing: 0.02em; }
.oql-meta { font-size: 0.8rem; color: var(--ink-soft); }
.oql-meta .bad { color: var(--out); }
.oql-card-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.oql-card-btns button { font-size: 0.85rem; padding: 0.22rem 0.7rem; }

.oql-event { border: 1px solid var(--ink-faint); border-radius: 8px; padding: 0.9rem 1rem; background: var(--paper); }
.oql-event p { margin: 0.2rem 0; }
.oql-tl { position: relative; height: 34px; margin: 0.8rem 0 0.3rem; border-radius: 4px; background: var(--paper-2); overflow: hidden; }
.oql-tl span { position: absolute; top: 0; bottom: 0; font-size: 0.72rem; color: var(--paper); padding: 0 3px; line-height: 34px; white-space: nowrap; overflow: hidden; }
.oql-tl .ask { background: var(--ink); }
.oql-tl .ans { background: var(--gilt); }
.oql-tl .tail { background: rgba(30, 77, 59, 0.18); color: var(--ink); }
.oql-tl .head { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--out); left: 0; display: none; }
.oql-tl-scale { font-size: 0.75rem; color: var(--ink-soft); display: flex; justify-content: space-between; }
.oql-answers { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap: 0.6rem; margin-top: 0.6rem; }
.oql-answers .oql-card { background: #fffdf7; }

.oql-stats { max-width: 100%; border: 1px solid var(--ink-faint); border-radius: 8px; padding: 0.8rem 1rem; background: #fffdf7; }
.oql-modes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); gap: 0.8rem; }
.oql-mode { border: 1px solid var(--ink-faint); border-radius: 6px; padding: 0.6rem 0.75rem; min-width: 0; }
.oql-mode h3 { margin: 0 0 0.35rem; font-size: 1.05rem; font-variant: small-caps; letter-spacing: 0.04em; }
.oql-mode dl { display: grid; grid-template-columns: 7.5em minmax(0, 1fr); gap: 0.2rem 0.6rem; margin: 0; font-size: 0.86rem; }
.oql-mode dt { font-variant: small-caps; color: var(--ink-soft); }
.oql-mode dd { margin: 0; overflow-wrap: anywhere; }
.oql-mode dd b { font-weight: 600; }
.oql-mode .ok { color: var(--ink); font-weight: 600; }
.oql-mode .bad { color: var(--out); font-weight: 600; }
@media (max-width: 480px) { .oql-mode dl { grid-template-columns: minmax(0, 1fr); } .oql-mode dt { margin-top: 0.3rem; } }
.oql-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.1rem; max-width: 72ch; }
</style>

<div class="oql">
  <header class="oql-head">
    <p class="oql-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="oql-title">Question Lab</h1>
    <p class="oql-lede">Every visit (a seed) writes seven questions, once: the old one (sol–la–re′–ti–re′) and six
    more in its spirit — rising, angular, a sixth or seventh in them that isn't a bugle's, ending high on
    something that isn't home. Each meeting of the visit draws one, spelled into that meeting's mode; the one
    just heard steps aside. It is asked three times, the second asking bent. The answerers argue in the
    meeting's own hymns, faster, higher and louder each time. The last asking gets no answer.</p>
  </header>

  <div class="oql-controls">
    <label>seed <input type="number" id="oql-seed" value="1" min="0" step="1" /></label>
    <button type="button" id="oql-prev" aria-label="previous seed">‹</button>
    <button type="button" id="oql-next" aria-label="next seed">›</button>
    <label>mode
      <select id="oql-mode">
        <option value="ionian" selected>ionian</option>
        <option value="mixolydian">mixolydian</option>
        <option value="dorian">dorian</option>
        <option value="aeolian">aeolian</option>
        <option value="penta">pentatonic</option>
        <option value="hexa">hexatonic</option>
      </select>
    </label>
    <label>meeting
      <select id="oql-n">
        <option value="1" selected>1</option><option value="2">2</option><option value="3">3</option>
        <option value="4">4</option><option value="5">5</option><option value="6">6</option>
      </select>
    </label>
    <label>material
      <select id="oql-material">
        <option value="hymns" selected>stand-in hymn lines</option>
        <option value="none">none (the question's own intervals)</option>
      </select>
    </label>
    <label>ground
      <select id="oql-ground">
        <option value="auto" selected>as drawn</option>
        <option value="drone">drone</option>
        <option value="chorale">strings' chorale</option>
      </select>
    </label>
    <label>room
      <select id="oql-room">
        <option value="none" selected>sections as planned</option>
        <option value="form">FORM may stretch the host to 125 s</option>
      </select>
    </label>
    <button type="button" class="oql-go" id="oql-play">▶ play full question</button>
    <button type="button" id="oql-stop">stop</button>
    <div class="oql-now" id="oql-now"></div>
  </div>

  <h2 class="oql-h2">The visit</h2>
  <div class="oql-visit" id="oql-visit"></div>

  <h2 class="oql-h2">The seven questions, as this meeting's mode sings them</h2>
  <div class="oql-bank" id="oql-bank"></div>

  <h2 class="oql-h2">The event</h2>
  <div class="oql-event" id="oql-event"></div>

  <h2 class="oql-h2">Two hundred visits</h2>
  <div class="oql-stats">
    <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem">
      <button type="button" id="oql-stats-mode">measure this mode</button>
      <button type="button" id="oql-stats-all">measure all six modes</button>
      <span class="oql-meta" id="oql-stats-note">Visits from the seed field on, 200 of them. The rule check, the bugle-call counts and the doubling intervals are the lab's own restatements, independent of the module's.</span>
    </div>
    <div id="oql-stats"></div>
  </div>

  <p class="oql-footnote">Staff: written with do = C (movable do), an octave below sounding; ♭ marks the
  mode's lowered degrees; a note in the warm colour is one the gapped scale sings somewhere other than written.
  The old question keeps v0.30's played beats (1.3 · 0.9 · 1.0 · 0.8 · 2.8), so its note values are
  approximate. Every meeting here is in the mode chosen above (in the engine, FORM draws a mode per meeting).
  Stand-in hymn lines stand for "today's hymns" until the composer lands; they are also passed as
  <em>excludeLines</em>, so no question can match one. The asker is the clarinet (as in v0.30); the harmonium
  answers, and from the second answer a second harmonium rank (a pure fifth above, or a pure third, sixth or
  fourth where the scale's fifth would be a wolf or a tritone) and a second clarinet argue with it.
  ▶ play sounds one question alone over the drone at the asker's own pace.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo oql_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-question.js?v=<?php echo oql_v('kolob-question.js'); ?>"></script>
<script src="question-lab.js?v=<?php echo oql_v('question-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

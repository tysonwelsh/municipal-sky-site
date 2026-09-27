<?php
// ============================================================================
// INSTRUMENTS LAB — audition bench for KOLOB 2's new voices: the registrable
// organ, the brass band, the fiddle, the handbells, the gulls and the cart
// wheels. UNLINKED dev tool (reachable only by its URL, /art/kolob/instruments-lab),
// like the tune and room labs. Everything plays through the app's own master
// chain and never louder than the app; CHECK renders offline and measures.
// ============================================================================
$page_title = "Instruments Lab — KOLOB · Municipal Sky";
$page_description = "A private audition bench for the Kolob hymn engine's new instruments.";
function kil_v($file)
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
/* Scoped to .kil-* so it never leaks into the rest of the site. */
.kil {
  --ink: #1e4d3b;
  --ink-soft: rgba(30, 77, 59, 0.66);
  --ink-faint: rgba(30, 77, 59, 0.26);
  --paper: #f5f0e4;
  --paper-2: #ece5d3;
  --gilt: #8a7a45;
  font-family: "EB Garamond", Georgia, serif;
  color: var(--ink);
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
.kil * { box-sizing: border-box; }
.kil-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.75rem; margin-bottom: 1.1rem; }
.kil-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem; color: var(--gilt); margin: 0 0 0.35rem; }
.kil-title { font-size: 2rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.05; }
.kil-lede { font-size: 1rem; color: var(--ink-soft); margin: 0; max-width: 66ch; font-style: italic; }

.kil-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.8rem 1.1rem;
  background: var(--paper); border: 1px solid var(--ink-faint); border-radius: 8px;
  padding: 0.8rem 1rem; margin-bottom: 1.1rem; font-size: 0.95rem;
  position: sticky; top: 0; z-index: 2;
}
.kil-controls label, .kil-row label { display: flex; align-items: center; gap: 0.45rem; }
.kil input, .kil select, .kil button { font-family: inherit; font-size: 0.95rem; color: var(--ink); }
.kil input[type="number"] { width: 6.5em; padding: 0.2rem 0.35rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; }
.kil select { padding: 0.2rem 0.3rem; border: 1px solid var(--ink-soft); border-radius: 4px; background: #fbf8f0; max-width: 100%; }
.kil input[type="range"] { accent-color: var(--ink); width: 9em; }
.kil button {
  padding: 0.4rem 1rem; cursor: pointer; min-height: 2.2rem;
  background: var(--paper); border: 1px solid var(--ink-soft); border-radius: 4px;
}
.kil button:hover { background: #faf6ec; }
.kil button:disabled { opacity: 0.5; cursor: wait; }
.kil-play { font-weight: 600; }
.kil-check { font-style: italic; }
#kil-meter { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 11em; }

.kil-card { border-bottom: 1px solid var(--ink-faint); padding: 1rem 0.2rem 1.1rem; }
.kil-name { font-size: 1.3rem; font-weight: 600; font-variant: small-caps; letter-spacing: 0.04em; margin: 0 0 0.15rem; }
.kil-phrase { margin: 0 0 0.6rem; font-style: italic; color: var(--ink-soft); }
.kil-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.9rem; }
.kil-stat { margin: 0.5rem 0 0; font-size: 0.88rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.kil-report { margin-top: 0.4rem; }
.kil-meas { font-size: 0.86rem; margin: 0 0 0.4rem; color: var(--ink); font-variant-numeric: tabular-nums; }
.kil-spec { display: block; width: 100%; max-width: 640px; height: auto; border: 1px solid var(--ink-faint); border-radius: 3px; }
.kil-footnote { font-size: 0.88rem; color: var(--ink-soft); margin-top: 1.2rem; max-width: 70ch; }
@media (max-width: 560px) {
  .kil-title { font-size: 1.6rem; }
  .kil-controls { position: static; }
  .kil-row label { width: 100%; }
  .kil input[type="range"] { flex: 1; width: auto; }
}
</style>

<div class="kil">
  <header class="kil-head">
    <p class="kil-kicker">KOLOB · dev bench · unlinked</p>
    <h1 class="kil-title">Instruments Lab</h1>
    <p class="kil-lede">The new voices, one at a time: the tabernacle organ and its registrations,
    the Nauvoo band, the social-hall fiddle, the Primary's handbells, the gulls and the carts.
    Everything plays in just intonation through the app's own master chain, in the app's rooms,
    never louder than the app. <strong>check</strong> renders the phrase offline and measures it.</p>
  </header>

  <div class="kil-controls">
    <label>seed <input type="number" id="kil-seed" value="1847" /></label>
    <label>room
      <select id="kil-room">
        <option value="wide" selected>tabernacle (St Margaret's)</option>
        <option value="close">meetinghouse (short)</option>
        <option value="dry">dry</option>
      </select>
    </label>
    <button type="button" id="kil-stop">stop</button>
    <span id="kil-meter">out —</span>
  </div>

  <div id="kil-cards"></div>

  <p class="kil-footnote">Node counts are per phrase: every play builds fresh instruments, so
  “created” is the phrase's whole cost and “live at peak” is the most nodes alive at one instant.
  The seed moves only sound-level detail (detune, breath, the flock's chatter, the wheels'
  creaks) — never the notes. The level reference is the v0.30 organ as the prelude plays it,
  rebuilt line for line; it and the new organ both sound as they leave the organ, before the app's
  organ-layer volume (0.52). <strong>check</strong> renders the seed in the seed field, the room,
  and for the organ the registration and the swell on the slider; it reports loudness (LUFS,
  integrated and the loudest 3&nbsp;s) and counts clicks as bursts above 4&nbsp;kHz that stand
  21.6&nbsp;dB clear of the 30&nbsp;ms either side, down to −100&nbsp;dBFS.</p>
</div>

<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo kil_v('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="kolob-voices-organ.js?v=<?php echo kil_v('kolob-voices-organ.js'); ?>"></script>
<script src="kolob-voices-band.js?v=<?php echo kil_v('kolob-voices-band.js'); ?>"></script>
<script src="kolob-voices-folk.js?v=<?php echo kil_v('kolob-voices-folk.js'); ?>"></script>
<script src="instruments-lab.js?v=<?php echo kil_v('instruments-lab.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

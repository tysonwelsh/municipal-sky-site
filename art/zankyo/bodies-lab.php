<?php
// ============================================================================
// BODIES LAB — an audition bench for the ZANKYŌ 2 bodies (Phase 3).
//
// UNLINKED dev page (reachable only by URL: /art/zankyo/bodies-lab). Loads
// the engine exactly as index.php does and lets each body be heard alone:
// the plucked strings (koto / shamisen / biwa), the shakuhachi's two
// registers, the hichiriki, the taiko kit and its patterns, the PA, the
// noise vocabulary. Every button calls the engine's own ♪ audition (the
// console's sample) or a body directly; nothing here is a second recipe.
// ============================================================================
$page_title = "Bodies Lab — ZANKYŌ · Municipal Sky";
$page_description = "A private audition bench for the ZANKYŌ 2 instrument bodies.";
function zkv($file) { $path = __DIR__ . '/' . $file; return file_exists($path) ? filemtime($path) : 0; }
include '../../includes/header.php';
?>
<style>
.zbl { max-width: 900px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; font-family: "JetBrains Mono", ui-monospace, monospace; color: #cfc8d8; }
.zbl h1 { font-size: 1.4rem; letter-spacing: 0.12em; margin: 0 0 0.3rem; }
.zbl p { color: #8f879c; font-size: 0.85rem; max-width: 66ch; }
.zbl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.6rem; margin: 1rem 0; }
.zbl button { font: inherit; font-size: 0.8rem; padding: 0.7rem 0.8rem; background: #1a1620; color: #e6dff0; border: 1px solid #4a3f5a; border-radius: 4px; cursor: pointer; text-align: left; }
.zbl button:hover { border-color: #a58cff; }
.zbl button b { display: block; font-size: 0.95rem; }
.zbl-log { font-size: 0.75rem; color: #8f879c; white-space: pre-wrap; background: #0e0b12; border: 1px solid #2c2536; padding: 0.6rem; min-height: 6em; }
</style>
<div class="zbl">
  <h1>残響 · BODIES LAB</h1>
  <p>Each button auditions one body through the real engine graph (rooms, grit bus, master chain) while the station is stopped. Open the console page for the full performance.</p>
  <div class="zbl-grid" id="zbl-buttons"></div>
  <div class="zbl-log" id="zbl-log">ready — press a body</div>
</div>
<script src="../background-audio.js?v=<?php echo zkv('../background-audio.js'); ?>"></script>
<?php foreach (['pj2-rand','pj2-pitch','pj2-clock','pj2-voice','pj2-fx','pj2-air','pj2-conductor'] as $m): ?>
<script src="../prosperos-jukebox-v2/<?php echo $m; ?>.js?v=<?php echo zkv('../prosperos-jukebox-v2/' . $m . '.js'); ?>"></script>
<?php endforeach; ?>
<script src="zankyo-audio.js?v=<?php echo zkv('zankyo-audio.js'); ?>"></script>
<script>
(function () {
  var Z = window.ZankyoAudio, log = document.getElementById("zbl-log"), host = document.getElementById("zbl-buttons");
  if (!Z) { log.textContent = "engine failed to load"; return; }
  var BODIES = [
    ["koto", "箏 koto", "plucked string: tsume tick, pluck position, register decay"],
    ["shamisen", "三味線 shamisen", "plucked string: bachi slap, sawari on the low string"],
    ["biwa", "琵琶 biwa", "tremolo strum + huge sawari, low register"],
    ["shakuhachi", "尺八 shakuhachi", "otsu below A4 / kan above; breath formants; yuri late in long notes"],
    ["hichiriki", "篳篥 hichiriki", "double reed: buzz, nasal formants, the enbai slide"],
    ["sho", "笙 shō", "an aitake cluster, pipes entering one at a time"],
    ["taiko", "太鼓 taiko", "a matsuri pattern, then ō-daiko / shime / ka"],
    ["pa", "放送 PA", "a wordless announcement decaying into static"],
    ["noise", "雑音 noise", "a filtered wall (the vocabulary's screech / static / rumble play per scene)"],
    ["subDrone", "重低音 sub-drone", "the hull in its 64–128 Hz register"],
    ["ambient", "環境 ambient", "one pool event"],
  ];
  Z.setEventListener(function (ev) { log.textContent = (ev.label + (ev.detail ? " · " + ev.detail : "")) + "\n" + log.textContent.split("\n").slice(0, 12).join("\n"); });
  BODIES.forEach(function (b) {
    var btn = document.createElement("button");
    btn.innerHTML = "<b>" + b[1] + "</b>" + b[2];
    btn.addEventListener("click", function () { Z.sample(b[0]); });
    host.appendChild(btn);
  });
})();
</script>
<?php include '../../includes/footer.php'; ?>

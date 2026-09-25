<?php
// THE SECOND SET'S VOLUME — first set of options (dev-only mockup, 2026-09-25).
// The owner wants a control on the set that turns only the reels' own sound
// up and down, in the ledge's third station (today a reserved blank plate).
// Each option is shown IN PLACE: the set's markup is read live from
// ../index.php and zankyo.css is the real stylesheet; only the blank plate is
// swapped. The controls move in the mockup; nothing is wired to the engine.
$page_title = "ZANKYŌ — TV volume options";
$page_description = "Dev mockup: three volume controls for the second set's ledge.";
include '../../../includes/header.php';

$src  = file_get_contents(__DIR__ . '/../index.php');
$a    = strpos($src, '<div class="zk-set2"');
$b    = strpos($src, '<!-- control rail');
$set  = substr($src, $a, $b - $a);
$set  = substr($set, 0, strrpos(substr($set, 0, strrpos($set, '</div>')), '</div>'));   // drop the bank wrappers' closing tags
$set  = substr($set, 0, strrpos($set, '</div>') + 6);
$blank = '<div class="zk-blank" aria-hidden="true"></div>';

$options = [
  'A' => [
    'name' => '滑 · Slide fader',
    'note' => 'A short slot moulded into the station with a ribbed slider riding in it, like the volume slide on a 1970s portable. Left is quiet, right is loud. Faint tick marks along the slot, no numbers. Drag it.',
    'html' => '<div class="tv-sta tv-fader" data-v="0.6"><span class="tv-slot"><span class="tv-ticks"></span></span><span class="tv-slider"></span></div>',
  ],
  'B' => [
    'name' => '廻 · Rotary knob',
    'note' => 'A small knurled bakelite knob with a white pointer line, seated in the station, with a printed arc of dots on either side marking its travel. Drag up or down on it to turn it, like the console knobs.',
    'html' => '<div class="tv-sta tv-knobsta" data-v="0.6"><span class="tv-dots tv-dots-l"></span><span class="tv-knob"><span class="tv-knob-ptr"></span></span><span class="tv-dots tv-dots-r"></span></div>',
  ],
  'C' => [
    'name' => '揺 · Rocker and ladder',
    'note' => 'The same see-saw plate as the channel rocker on the left, − and +, with a window in the middle showing a short amber ladder of 8 segments. It matches the ledge\'s own language and each press is one step. Click the ends.',
    'html' => '<div class="zk-rocker tv-rock" data-v="5"><span class="zk-cap zk-cap-l tv-dn"><i>&minus;</i></span><span class="zk-rock-win tv-ladder">' . str_repeat('<i></i>', 8) . '</span><span class="zk-cap zk-cap-r tv-up"><i>+</i></span></div>',
  ],
];
?>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../zankyo.css?v=<?php echo filemtime(__DIR__ . '/../zankyo.css'); ?>" />
<style>
.mk-head, .mk-opt { max-width: 1000px; margin: 0 auto; padding: 0 16px; font-family: "JetBrains Mono", monospace; color: #3a3640; font-size: 13px; line-height: 1.55; }
.mk-head { padding-top: 32px; }
.mk-head h2 { font-family: "Orbitron", sans-serif; font-size: 18px; letter-spacing: 0.1em; margin: 0 0 6px; color: #111; }
.mk-opt { margin-top: 34px; }
.mk-opt b { font-family: "Orbitron", sans-serif; font-size: 15px; letter-spacing: 0.08em; color: #111; margin-right: 8px; }
.mk-opt span.k { font-family: "Shippori Mincho", serif; font-weight: 700; }
.mk-opt p { margin: 4px 0 0; }
.mk-opt .val { font-size: 12px; color: #777; }
.mk-stage { max-width: 1000px; margin: 10px auto 0; padding: 22px 16px; }
.mk-stage .zankyo-scene { padding: 26px; border-radius: 10px; background: linear-gradient(180deg, #2b2830, #1b191f); }
.mk-stage .zk-set2 { width: 516px; max-width: 100%; margin: 0 auto; }
.mk-stage .zk-tape { display: none; }

/* ---------------------------------------------------------------- shared: a station face */
.tv-sta {
  position: relative; min-width: 0; height: var(--cap); border-radius: 2px 2px 3px 3px; touch-action: none;
  background: linear-gradient(180deg, #322c28 0 1px, #2a2521 1px 46%, #1f1b18 46%, #151312);
  box-shadow: 0 1px 0 rgba(255, 246, 224, 0.06), 0 2px 4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 246, 224, 0.1),
    inset -1px 0 2px rgba(0, 0, 0, 0.45), inset 1px 0 1px rgba(255, 246, 224, 0.03), inset 0 -3px 4px rgba(0, 0, 0, 0.55);
}

/* ---------------------------------------------------------------- A · slide fader */
.tv-fader { cursor: ew-resize; }
.tv-slot {
  position: absolute; left: 14px; right: 14px; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px;
  background: linear-gradient(180deg, #050404, #0d0b0a);
  box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(255, 246, 224, 0.08);
}
.tv-ticks {
  position: absolute; left: 0; right: 0; top: -9px; height: 4px;
  background: repeating-linear-gradient(90deg, rgba(173, 161, 146, 0.35) 0 1px, transparent 1px calc(10% - 0.1px));
}
.tv-slider {
  position: absolute; top: 50%; width: 16px; height: 24px; margin: -12px 0 0 -8px; border-radius: 2px;
  left: calc(14px + (100% - 28px) * var(--v, 0.6));
  background:
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, #4a423b 0 1px, #3b342e 1px 50%, #2a2420 50%, #1d1916);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 246, 224, 0.16), inset 0 -2px 3px rgba(0, 0, 0, 0.5);
}
.tv-slider::after {   /* the index line on the slider's face */
  content: ""; position: absolute; left: 50%; top: 3px; bottom: 3px; width: 1px; margin-left: -0.5px; background: rgba(230, 220, 205, 0.55);
}

/* ---------------------------------------------------------------- B · rotary knob */
.tv-knobsta { display: flex; align-items: center; justify-content: center; gap: 8px; cursor: ns-resize; }
.tv-knob {
  position: relative; width: 28px; height: 28px; border-radius: 50%; flex: none;
  transform: rotate(calc(-135deg + 270deg * var(--v, 0.6)));
  background:
    repeating-conic-gradient(rgba(0, 0, 0, 0.45) 0 4deg, rgba(255, 246, 224, 0.05) 4deg 10deg),
    radial-gradient(circle at 40% 32%, #4e463f, #2a2420 60%, #16120f);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 246, 224, 0.14), 0 0 0 2px rgba(0, 0, 0, 0.35);
}
.tv-knob::before {   /* the smooth cap inside the knurled skirt */
  content: ""; position: absolute; inset: 5px; border-radius: 50%;
  background: radial-gradient(circle at 40% 32%, #544b43, #2c2622 70%);
  box-shadow: inset 0 1px 0 rgba(255, 246, 224, 0.12), 0 1px 2px rgba(0, 0, 0, 0.6);
}
.tv-knob-ptr { position: absolute; z-index: 1; left: 50%; top: 5px; width: 2px; height: 8px; margin-left: -1px; border-radius: 1px; background: #e6dccd; box-shadow: 0 0 2px rgba(0, 0, 0, 0.6); }
.tv-dots { display: flex; gap: 4px; }
.tv-dots::before, .tv-dots::after, .tv-dots { }
.tv-dots-l, .tv-dots-r { width: 26px; height: 4px; background: radial-gradient(circle, rgba(173, 161, 146, 0.45) 0 1.3px, transparent 1.6px) 0 0 / 6.5px 4px repeat-x; }
.tv-dots-l { opacity: 0.55; }

/* ---------------------------------------------------------------- C · rocker + ladder */
.tv-rock { cursor: pointer; }
.tv-ladder { flex: 1; display: flex; flex-direction: row !important; align-items: flex-end; justify-content: center; gap: 2px; padding: 0 3px 10px; }
.tv-ladder i {
  display: block; flex: none; width: 5px; border-radius: 1px;
  background: rgba(var(--amber-rgb), 0.08); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5);
}
.tv-ladder i:nth-child(n) { height: calc(6px + var(--h, 0px)); }
.tv-ladder i.on { background: radial-gradient(circle at 50% 35%, #ffe3a0, var(--amber) 70%); box-shadow: 0 0 5px rgba(var(--amber-rgb), 0.55); }
.tv-cap-press { transform: translateY(2px); }
</style>

<div class="main-wrapper">
  <div class="mk-head">
    <h2>ZANKYŌ · TV volume options</h2>
    Three volume controls for the second set, each in the third station of the control ledge (today the blank plate). It sets only the clips' own sound, not the static or the music. The controls move here, but nothing is wired up. The set's markup and stylesheet are the live ones.
  </div>
<?php foreach ($options as $key => $o): ?>
  <div class="mk-opt"><b><?php echo $key; ?></b><span class="k"><?php echo $o['name']; ?></span>
    <p><?php echo $o['note']; ?></p><p class="val">volume: <span id="val-<?php echo $key; ?>"></span></p></div>
  <div class="mk-stage"><div class="zankyo-scene"><?php echo str_replace($blank, str_replace('class="', 'data-opt="' . $key . '" class="', $o['html']), $set); ?></div></div>
<?php endforeach; ?>
</div>

<script>
(function () {
  function show(k, v) { var e = document.getElementById("val-" + k); if (e) e.textContent = Math.round(v * 100) + " %"; }
  // A — the fader: drag along the slot
  document.querySelectorAll(".tv-fader").forEach(function (el) {
    var v = +el.dataset.v; el.style.setProperty("--v", v); show("A", v);
    function at(e) { var r = el.getBoundingClientRect(); v = Math.max(0, Math.min(1, (e.clientX - r.left - 14) / (r.width - 28))); el.style.setProperty("--v", v); show("A", v); }
    el.addEventListener("pointerdown", function (e) { el.setPointerCapture(e.pointerId); at(e); el.onpointermove = at; });
    el.addEventListener("pointerup", function () { el.onpointermove = null; });
  });
  // B — the knob: drag up/down
  document.querySelectorAll(".tv-knobsta").forEach(function (el) {
    var v = +el.dataset.v, y0 = 0, v0 = 0; el.style.setProperty("--v", v); show("B", v);
    el.addEventListener("pointerdown", function (e) { el.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = v;
      el.onpointermove = function (m) { v = Math.max(0, Math.min(1, v0 + (y0 - m.clientY) / 120)); el.style.setProperty("--v", v); show("B", v); }; });
    el.addEventListener("pointerup", function () { el.onpointermove = null; });
  });
  // C — the rocker: one step per press
  document.querySelectorAll(".tv-rock").forEach(function (el) {
    var n = +el.dataset.v, segs = el.querySelectorAll(".tv-ladder i");
    segs.forEach(function (s, i) { s.style.setProperty("--h", (i * 1.2) + "px"); });
    function draw() { segs.forEach(function (s, i) { s.classList.toggle("on", i < n); }); show("C", n / 8); }
    function press(cap, d) { cap.classList.add("tv-cap-press"); setTimeout(function () { cap.classList.remove("tv-cap-press"); }, 120); n = Math.max(0, Math.min(8, n + d)); draw(); }
    el.querySelector(".tv-dn").addEventListener("click", function () { press(this, -1); });
    el.querySelector(".tv-up").addEventListener("click", function () { press(this, 1); });
    draw();
  });
})();
</script>

<?php include '../../../includes/footer.php'; ?>

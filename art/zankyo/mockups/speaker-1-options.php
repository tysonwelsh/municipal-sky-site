<?php
// SPEAKER — first set of options (dev-only mockup, 2026-09-24).
// The owner wants a speaker in the empty space under the scope's casing, to
// the right of the second set: its own casing, not part of the monitor's.
// Each option is shown IN PLACE: the bank markup is read live from
// ../index.php and zankyo.css is the real stylesheet, so what sits around the
// speaker is the machine as it is today. Nothing is wired to the engine.
$page_title = "ZANKYŌ — speaker options";
$page_description = "Dev mockup: four speakers for the empty space in the bank.";
include '../../../includes/header.php';

$src  = file_get_contents(__DIR__ . '/../index.php');
$a    = strpos($src, '<div class="zk-bank">');
$b    = strpos($src, '<!-- control rail');
$bank = substr($src, $a, $b - $a);
// the speaker goes at the foot of the right column, after the monitor
$i = strpos($bank, '<!-- 隣');
$j = strrpos(substr($bank, 0, $i), '</div>');

function spk_driver($cls = '') {
    return '<span class="drv ' . $cls . '"><span class="drv-sur"><span class="drv-cone"><span class="drv-cap"></span></span></span></span>';
}

$options = [
  'A' => [
    'name' => '穿孔 · Punched steel',
    'note' => 'A hex-punched steel grille over two drivers, the way a rack unit or a vending machine hides its speaker. You can just see the cones through the holes. A small enamel maker\'s badge, lower right.',
    'html' => '<div class="spk spk-a" aria-hidden="true"><div class="spk-well">'
            . '<div class="spk-drivers">' . spk_driver() . spk_driver() . '</div>'
            . '<div class="spk-grille"></div><span class="spk-badge">MSHI</span>'
            . '</div></div>',
  ],
  'B' => [
    'name' => '露出 · Bare drivers',
    'note' => 'No grille at all: a woofer, a tweeter and a bass-port slot, the cones out in the air. The woofer carries a thin dead neon ring. In the build, the cone would move with the master level and the ring would light red at the climax.',
    'html' => '<div class="spk spk-b" aria-hidden="true"><div class="spk-well">'
            . '<span class="spk-b-woof"><span class="spk-ring"></span>' . spk_driver('drv-breathe') . '</span>'
            . '<span class="spk-b-side"><span class="spk-b-tw">' . spk_driver('drv-tw') . '</span><span class="spk-port"></span></span>'
            . '</div></div>',
  ],
  'C' => [
    'name' => '鎧戸 · Louvred plastic',
    'note' => 'Slots moulded straight into the casing\'s own plastic, like an old intercom or a transistor radio, with dark cloth behind. A recessed 音 medallion on the left is the only mark.',
    'html' => '<div class="spk spk-c" aria-hidden="true">'
            . '<span class="spk-medal"><i>音</i></span>'
            . '<span class="spk-slots">' . str_repeat('<span></span>', 9) . '</span>'
            . '</div>',
  ],
  'D' => [
    'name' => '布 · Torn grille cloth',
    'note' => 'Woven grille cloth stretched over two drivers, torn at the lower right so a cone shows through, and patched with the same yellowed tape the second set wears. The most derelict of the four.',
    'html' => '<div class="spk spk-d" aria-hidden="true"><div class="spk-well">'
            . '<div class="spk-drivers">' . spk_driver() . spk_driver() . '</div>'
            . '<div class="spk-cloth"></div><span class="spk-d-tape"></span>'
            . '</div></div>',
  ],
];
?>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../zankyo.css?v=<?php echo filemtime(__DIR__ . '/../zankyo.css'); ?>" />
<style>
/* ---------------------------------------------------------------- page */
.mk-head { max-width: 960px; margin: 0 auto 8px; font-family: "JetBrains Mono", monospace; color: #3a3640; font-size: 13px; line-height: 1.55; }
.mk-head h2 { font-family: "Orbitron", sans-serif; font-size: 18px; letter-spacing: 0.1em; margin: 0 0 6px; color: #111; }
.mk-opt { max-width: 960px; margin: 34px auto 6px; font-family: "JetBrains Mono", monospace; font-size: 13px; line-height: 1.5; color: #3a3640; }
.mk-opt b { font-family: "Orbitron", sans-serif; font-size: 15px; letter-spacing: 0.08em; color: #111; margin-right: 8px; }
.mk-opt span { font-family: "Shippori Mincho", serif; font-weight: 700; }
.mk-opt p { margin: 4px 0 0; }
.mk-frame { padding-top: 22px; padding-bottom: 22px; }
.mk-frame .zk-bank { margin-bottom: 0; }

/* ------------------------------------------- the slot (shared by every option)
   The right column stretches to the height of the second set, and the
   speaker takes whatever is left under the scope's casing. Its own casing,
   14 px below — the same gap the bank uses between its units. Hidden under
   700 px, where the bank stacks and there is no empty space to fill. */
.zk-bank-main { align-self: stretch; }
.spk {
  flex: 1; min-height: 110px; margin-top: 14px; position: relative; display: flex;
  padding: 11px; border-radius: 9px; border: 1px solid #000;
  background:
    radial-gradient(80% 30% at 70% 0%, rgba(255, 255, 255, 0.05), transparent 70%),
    linear-gradient(180deg, #232329, #131317 55%, #0d0d11);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    inset 0 -5px 12px rgba(0, 0, 0, 0.6),
    0 6px 16px rgba(0, 0, 0, 0.55),
    0 1px 0 rgba(255, 255, 255, 0.04);
}
.spk-well {
  flex: 1; position: relative; overflow: hidden; border-radius: 6px;
  background: radial-gradient(90% 120% at 50% 40%, #0d0d10, #040405 80%);
  box-shadow: inset 0 0 0 1px #000, inset 0 2px 8px rgba(0, 0, 0, 0.9), 0 1px 0 rgba(255, 255, 255, 0.05);
}
@media (max-width: 700px) { .spk { display: none; } }

/* ------------------------------------------- a driver (used by A, B, D) */
.drv {
  --d: 96px; width: var(--d); height: var(--d); flex: none; border-radius: 50%; padding: 5%; display: block;
  background: conic-gradient(from 20deg, #3d3d45, #16161a 22%, #4a4a53 40%, #141417 62%, #3a3a42 82%, #3d3d45);
  box-shadow: 0 0 0 1px #000, 0 3px 6px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.drv-sur {   /* the rolled rubber surround */
  display: block; width: 100%; height: 100%; border-radius: 50%; padding: 10%;
  background: radial-gradient(circle at 50% 38%, #2a2a31, #0f0f12 72%);
  box-shadow: inset 0 3px 3px rgba(255, 255, 255, 0.07), inset 0 -4px 6px rgba(0, 0, 0, 0.9), 0 0 0 1px #050506;
}
.drv-cone {  /* pressed paper, faint radial fibre */
  display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%;
  background:
    repeating-conic-gradient(rgba(255, 255, 255, 0.018) 0 2deg, rgba(0, 0, 0, 0.04) 2deg 5deg),
    radial-gradient(circle, #09090b 0 24%, #1d1d22 27%, #121215 62%, #1e1e23 100%);
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.85), inset 0 2px 0 rgba(0, 0, 0, 0.6);
}
.drv-cap {   /* the dust cap */
  display: block; width: 32%; height: 32%; border-radius: 50%;
  background: radial-gradient(circle at 40% 32%, #4c4c55, #1b1b20 58%, #0a0a0c);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.spk-drivers { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-evenly; }

/* ------------------------------------------- A · punched steel */
.spk-a .drv { --d: 104px; opacity: 0.9; }
.spk-a .spk-grille {
  position: absolute; inset: 4px; border-radius: 4px;
  background:
    radial-gradient(70% 90% at 30% 0%, rgba(255, 255, 255, 0.12), transparent 60%),
    linear-gradient(180deg, #3a3a42, #24242a 45%, #18181c);
  /* hex-punched: two offset rows of holes, intersected */
  -webkit-mask:
    radial-gradient(circle at 3px 2.6px, transparent 1.45px, #000 1.95px) 0 0 / 6px 10.4px,
    radial-gradient(circle at 3px 2.6px, transparent 1.45px, #000 1.95px) 3px 5.2px / 6px 10.4px;
  -webkit-mask-composite: source-in;
          mask:
    radial-gradient(circle at 3px 2.6px, transparent 1.45px, #000 1.95px) 0 0 / 6px 10.4px,
    radial-gradient(circle at 3px 2.6px, transparent 1.45px, #000 1.95px) 3px 5.2px / 6px 10.4px;
          mask-composite: intersect;
}
.spk-a .spk-well::after {  /* the pressed rim of the grille */
  content: ""; position: absolute; inset: 3px; border-radius: 5px; pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.9), inset 0 1px 0 2px rgba(255, 255, 255, 0.05);
}
.spk-badge {
  position: absolute; right: 12px; bottom: 10px; z-index: 2; padding: 2px 7px 3px; border-radius: 9px;
  font: 700 7px/1 "Orbitron", sans-serif; letter-spacing: 0.2em; color: #8d8797;
  background: linear-gradient(180deg, #1c1c21, #0c0c0f); border: 1px solid #000;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* ------------------------------------------- B · bare drivers */
.spk-b .spk-well { display: flex; align-items: center; justify-content: center; gap: 24px; padding: 8px 16px; }
.spk-b-woof { position: relative; display: grid; place-items: center; }
.spk-b .drv-breathe { --d: 118px; }
.spk-b .drv-breathe .drv-cone { animation: spk-breathe 0.42s ease-in-out infinite alternate; }
@keyframes spk-breathe { from { transform: scale(0.982); } to { transform: scale(1.012); } }
.spk-ring {   /* the dead neon ring round the woofer */
  position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
  border: 1px solid rgba(var(--red-rgb), 0.28);
  box-shadow: 0 0 6px rgba(var(--red-rgb), 0.12), inset 0 0 4px rgba(var(--red-rgb), 0.1);
}
.spk-b-side { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.spk-b .drv-tw { --d: 44px; }
.spk-b .drv-tw .drv-cap { width: 56%; height: 56%; background: radial-gradient(circle at 40% 30%, #8a8a96, #30303a 55%, #0c0c0f); }
.spk-port {   /* bass reflex slot */
  display: block; width: 58px; height: 14px; border-radius: 7px;
  background: radial-gradient(90% 120% at 50% 30%, #000, #050506 60%, #111114);
  box-shadow: inset 0 3px 5px #000, 0 1px 0 rgba(255, 255, 255, 0.07), 0 0 0 2px #1a1a1f, 0 0 0 3px #000;
}

/* ------------------------------------------- C · louvred plastic */
.spk-c { align-items: center; gap: 16px; padding: 12px 16px; }
.spk-medal {
  flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 40% 30%, #26262c, #111114 70%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9), inset 0 -1px 0 rgba(255, 255, 255, 0.06), 0 1px 0 rgba(255, 255, 255, 0.05);
}
.spk-medal i {
  font: normal 700 24px/1 "Shippori Mincho", serif; color: rgba(var(--amber-rgb), 0.42);
  text-shadow: 0 0 8px rgba(var(--amber-rgb), 0.18), 0 -1px 0 rgba(0, 0, 0, 0.9);
}
.spk-slots { flex: 1; align-self: stretch; display: flex; flex-direction: column; justify-content: space-evenly; }
.spk-slots span {
  display: block; height: 6px; border-radius: 3px;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, #000, #09090b 55%, #17171b);
  box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(255, 255, 255, 0.07), 0 -1px 0 rgba(0, 0, 0, 0.6);
}

/* ------------------------------------------- D · torn grille cloth */
.spk-d .drv { --d: 104px; }
.spk-d .spk-drivers { justify-content: space-between; padding: 0 7% 0 9%; }
.spk-d .drv:last-child { transform: translate(6px, 10px); }
/* what shows through the tear catches a little of the room's light */
.spk-d .drv:last-child .drv-cone {
  background:
    radial-gradient(60% 60% at 70% 75%, rgba(150, 140, 125, 0.14), transparent 70%),
    repeating-conic-gradient(rgba(255, 255, 255, 0.03) 0 2deg, rgba(0, 0, 0, 0.05) 2deg 5deg),
    radial-gradient(circle, #0d0d10 0 24%, #26262b 27%, #1a1a1e 62%, #2a2a30 100%);
}
.spk-d .spk-cloth {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.4) 0 1px, transparent 1px 3px),
    radial-gradient(34% 70% at 27% 50%, rgba(0, 0, 0, 0.35), transparent 70%),
    radial-gradient(34% 70% at 73% 50%, rgba(0, 0, 0, 0.35), transparent 70%),
    radial-gradient(120% 90% at 50% 35%, #2a2630, #151318 80%);
  clip-path: polygon(0 0, 100% 0, 100% 30%, 97% 33%, 98.5% 38%, 94% 41%, 95.5% 47%, 90% 49%, 92% 55%, 86.5% 58%, 88% 61%, 83% 66%, 85% 71%, 79.5% 73%, 81% 79%, 75% 83%, 77.5% 88%, 71% 91%, 72.5% 96%, 67% 100%, 0 100%);
  filter: drop-shadow(0 0 1px rgba(210, 196, 170, 0.35)) drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.8));
}
.spk-d-tape {
  position: absolute; z-index: 3; width: 62px; height: 16px; right: 1%; bottom: 52%; transform: rotate(-32deg); opacity: 0.86;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, rgba(222, 198, 138, 0.78), rgba(206, 180, 118, 0.82) 50%, rgba(186, 158, 96, 0.8));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 240, 200, 0.12);
  clip-path: polygon(0 12%, 3% 0, 97% 4%, 100% 20%, 98% 100%, 95% 88%, 2% 96%, 0 70%);
}
</style>

<div class="main-wrapper">
  <div class="mk-head" style="padding: 32px 16px 0;">
    <h2>ZANKYŌ · speaker options</h2>
    Four speakers for the empty space under the scope's casing, to the right of the second set. Each one is shown in place, with the real layout and the real stylesheet around it. Each has its own casing, in the same plastic as the scope's, and fills whatever height the column leaves. On phones (under 700 px) the bank stacks and there is no gap to fill, so the speaker is hidden there. Nothing here plays sound.
  </div>
<?php foreach ($options as $key => $o):
    $html = substr($bank, 0, $j) . $o['html'] . "\n        " . substr($bank, $j);
?>
  <div class="mk-opt" style="padding: 0 16px;">
    <b><?php echo $key; ?></b><span><?php echo $o['name']; ?></span>
    <p><?php echo $o['note']; ?></p>
  </div>
  <div class="zankyo-scene">
    <div class="content-frame zankyo-frame mk-frame">
      <?php echo $html; ?>
    </div>
  </div>
<?php endforeach; ?>
</div>

<?php include '../../../includes/footer.php'; ?>

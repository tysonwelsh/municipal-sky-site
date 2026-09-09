<?php
// ============================================================================
// REEL LAB — the owner's bench for whole-thought windows (§14).
//
// UNLINKED dev page (reachable only by URL: /art/zankyo/reel-lab). The station
// runs NORMALLY here: the same scripts index.php loads, the same faceplate, the
// same engine and receiver. Press PLAY and it is the console. Below the panel,
// one button per window of a chosen reel — press one and THAT window is seated
// as a real broadcast at the next legal moment.
//
// IT GOES THROUGH THE PRODUCTION PATH. seatWindow() bypasses the lottery and
// the cooldown and nothing else: legality, the footprint check against the
// KIRU / guest / next arm / cycle end, the whole-window hold, the AIR silencing
// the crew, the tune-in and loss on the tube and the VFD lines are all the
// engine's own. A bench that shortcut those would agree with itself and tell
// the owner nothing. If a window cannot fit where the station currently is, the
// button says QUEUED and it is retried at the next legal moment.
//
// THE FACEPLATE IS NOT COPIED. It is sliced out of index.php at request time,
// between the scene div and the first script tag, and evaluated with the same
// variables index.php defines. Duplicating ~185 lines of frozen markup would
// drift the day someone touches the console; this cannot.
// ============================================================================
$page_title = "Reel Lab — ZANKYŌ · Municipal Sky";
$page_description = "A private bench for the ZANKYŌ receiver's reel windows.";
function zkv($file) { $path = __DIR__ . '/' . $file; return file_exists($path) ? filemtime($path) : 0; }
$zk_assets = [
    'zankyo-audio.js', 'zankyo-viz.js', 'zankyo-ui.js', 'zk-set.js', 'zk-broadcast.js', 'broadcast/manifest.json', 'zankyo.css', 'index.php',
    '../prosperos-jukebox-v2/pj2-rand.js', '../prosperos-jukebox-v2/pj2-pitch.js',
    '../prosperos-jukebox-v2/pj2-clock.js', '../prosperos-jukebox-v2/pj2-voice.js',
    '../prosperos-jukebox-v2/pj2-fx.js', '../prosperos-jukebox-v2/pj2-air.js',
    '../prosperos-jukebox-v2/pj2-conductor.js',
];
$zk_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$zk_version = trim(explode('—', $zk_version)[0]);
$zk_build = substr(md5(implode('', array_map('zkv', $zk_assets))), 0, 6);
$zk_mtime = 0;
foreach ($zk_assets as $zk_a) { $zk_p = __DIR__ . '/' . $zk_a; if (is_file($zk_p)) { $zk_m = filemtime($zk_p); if ($zk_m > $zk_mtime) $zk_mtime = $zk_m; } }
$zk_deployed = $zk_mtime ? gmdate('Y-m-d H:i', $zk_mtime) . ' UTC' : '';
include '../../includes/header.php';
?>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="zankyo.css?v=<?php echo zkv('zankyo.css'); ?>" />

<div class="main-wrapper">
<?php
// --- the real faceplate, sliced from index.php (see the header note) ---
$zk_src = (string) @file_get_contents(__DIR__ . '/index.php');
$zk_a0 = strpos($zk_src, '<div class="zankyo-scene">');
$zk_b0 = $zk_a0 === false ? false : strpos($zk_src, '<script src="../background-audio.js', $zk_a0);
if ($zk_a0 === false || $zk_b0 === false) {
    echo '<p style="color:#f66;font-family:monospace">reel-lab: could not find the faceplate in index.php '
       . '(looked for &lt;div class="zankyo-scene"&gt; and the background-audio script tag). '
       . 'The markers moved — fix this file rather than copying the markup.</p>';
} else {
    // Our own repo file, sliced between two literal markers, evaluated so the
    // one PHP expression inside it (the serial-plate build stamp) still runs.
    eval('?>' . substr($zk_src, $zk_a0, $zk_b0 - $zk_a0));
}
?>
<div class="zrl">
  <h1>残響 · REEL LAB <span class="zrl-sub">§14 whole-thought windows</span></h1>
  <p>Press <b>PLAY</b> above — the station runs normally. Then press a window below: it is seated as a
     real broadcast at the next legal moment, through the production path. If it cannot fit where the
     station is, the button says <b>QUEUED</b> and it is retried at the next legal moment.</p>
  <div class="zrl-row">
    <label>reel <select id="zrl-reel"></select></label>
    <label class="zrl-toggle"><input type="checkbox" id="zrl-slice" /> slice instead of whole <i>(for comparison)</i></label>
    <button type="button" id="zrl-next">next window ▸</button>
    <button type="button" id="zrl-cancel">cancel queued</button>
  </div>
  <div class="zrl-windows" id="zrl-windows"></div>
  <div class="zrl-state" id="zrl-state">—</div>
  <div class="zrl-log" id="zrl-log">ready</div>
</div>
</div>
<style>
.zrl { max-width: 900px; margin: 1.5rem auto 4rem; padding: 0 1.25rem; font-family: "JetBrains Mono", ui-monospace, monospace; color: #cfc8d8; }
.zrl h1 { font-size: 1.15rem; letter-spacing: 0.12em; margin: 0 0 0.3rem; }
.zrl-sub { color: #8f879c; font-size: 0.7rem; letter-spacing: 0.08em; }
.zrl p { color: #8f879c; font-size: 0.8rem; max-width: 74ch; line-height: 1.5; }
.zrl-row { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; margin: 1rem 0 0.6rem; font-size: 0.78rem; }
.zrl-row select, .zrl-row button { font: inherit; font-size: 0.78rem; background: #1a1620; color: #e6dff0; border: 1px solid #4a3f5a; border-radius: 4px; padding: 0.35rem 0.5rem; cursor: pointer; }
.zrl-row button:hover, .zrl-win:hover { border-color: #a58cff; }
.zrl-toggle i { color: #6f6880; font-style: normal; }
.zrl-windows { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.6rem; margin: 0.6rem 0; }
.zrl-win { font: inherit; font-size: 0.75rem; text-align: left; padding: 0.65rem 0.75rem; background: #1a1620; color: #e6dff0; border: 1px solid #4a3f5a; border-radius: 4px; cursor: pointer; line-height: 1.45; }
.zrl-win b { display: block; font-size: 0.85rem; letter-spacing: 0.05em; }
.zrl-win .zrl-words { display: block; color: #9b93a8; margin-top: 0.25rem; }
.zrl-win.is-queued { border-color: #d8a23a; }
.zrl-win.is-seated { border-color: #6fd88a; }
.zrl-state { font-size: 0.75rem; color: #b7aec6; background: #0e0b12; border: 1px solid #2c2536; padding: 0.5rem 0.6rem; border-radius: 4px; white-space: pre-wrap; }
.zrl-log { font-size: 0.72rem; color: #8f879c; white-space: pre-wrap; margin-top: 0.5rem; max-height: 12em; overflow: auto; }
</style>
<script src="../background-audio.js?v=<?php echo zkv('../background-audio.js'); ?>"></script>
<?php foreach (['pj2-rand','pj2-pitch','pj2-clock','pj2-voice','pj2-fx','pj2-air','pj2-conductor'] as $m): ?>
<script src="../prosperos-jukebox-v2/<?php echo $m; ?>.js?v=<?php echo zkv('../prosperos-jukebox-v2/' . $m . '.js'); ?>"></script>
<?php endforeach; ?>
<script src="zankyo-audio.js?v=<?php echo zkv('zankyo-audio.js'); ?>"></script>
<script src="zk-broadcast.js?v=<?php echo zkv('zk-broadcast.js'); ?>"></script>
<script src="zk-far.js?v=<?php echo zkv('zk-far.js'); ?>"></script>
<script src="zankyo-viz.js?v=<?php echo zkv('zankyo-viz.js'); ?>"></script>
<script src="zk-set.js?v=<?php echo zkv('zk-set.js'); ?>"></script>
<script src="zankyo-ui.js?v=<?php echo zkv('zankyo-ui.js'); ?>"></script>
<script>
(function () {
  var DEFAULT_REEL = "john-cage-interview";
  var sel = document.getElementById("zrl-reel"), host = document.getElementById("zrl-windows");
  var stateEl = document.getElementById("zrl-state"), logEl = document.getElementById("zrl-log");
  var sliceEl = document.getElementById("zrl-slice");
  var pool = [], cur = null, nextWi = 0;

  function log(msg) { logEl.textContent = (new Date().toISOString().slice(11, 19) + "  " + msg + "\n" + logEl.textContent).slice(0, 4000); }
  function mmss(s) { s = Math.max(0, +s || 0); var m = Math.floor(s / 60); return m + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }
  function dev() { try { return window.ZankyoBroadcast && window.ZankyoBroadcast._dev; } catch (e) { return null; } }

  // The manifest is the receiver's own — read it the same way it does.
  fetch("broadcast/manifest.json").then(function (r) { return r.json(); }).then(function (m) {
    pool = (Array.isArray(m) ? m : (m && m.reels) || []).filter(function (e) { return e && e.id && e.windows && e.windows.length; });
    pool.sort(function (a, b) {
      var aw = (a.whole || a.wholeWindows) ? 0 : 1, bw = (b.whole || b.wholeWindows) ? 0 : 1;
      return aw - bw || a.id.localeCompare(b.id);
    });
    sel.innerHTML = "";
    pool.forEach(function (e) {
      var o = document.createElement("option");
      o.value = e.id;
      o.textContent = ((e.whole || e.wholeWindows) ? "◆ " : "  ") + e.id + " · " + e.windows.length + " windows";
      sel.appendChild(o);
    });
    sel.value = pool.some(function (e) { return e.id === DEFAULT_REEL; }) ? DEFAULT_REEL : (pool[0] && pool[0].id);
    render();
    log("manifest: " + pool.length + " reels · ◆ = cut on complete thoughts");
  }).catch(function (e) { log("manifest failed: " + e.message); });

  // The notes field carries the owner's own description of each thought,
  // semicolons between them — split it so a window button can say its words.
  function wordsFor(reel, i) {
    var n = (reel.notes || "").split(/;\s*/);
    if (n.length === reel.windows.length) return n[i];
    if (n.length === reel.windows.length + 1) return n[i];   // a lead-in clause before the list
    return "";
  }
  function render() {
    cur = null;
    for (var i = 0; i < pool.length; i++) if (pool[i].id === sel.value) cur = pool[i];
    host.innerHTML = "";
    if (!cur) return;
    nextWi = 0;
    cur.windows.forEach(function (w, i) {
      var len = w[1] - w[0], src = (cur.srcWindows && cur.srcWindows[i]) || null;
      var b = document.createElement("button");
      b.type = "button"; b.className = "zrl-win"; b.setAttribute("data-wi", String(i));
      var whole = cur.wholeWindows ? !!cur.wholeWindows[i] : !!cur.whole;
      b.innerHTML = "<b>window " + i + (whole ? " · whole" : "") + " · " + len.toFixed(1) + " s</b>" +
        "source " + (src ? mmss(src[0]) + "–" + mmss(src[1]) : mmss(w[0]) + "–" + mmss(w[1])) +
        "<span class='zrl-words'>" + (wordsFor(cur, i) || "&mdash;").replace(/[<>]/g, "") + "</span>";
      b.addEventListener("click", function () { seat(i, b); });
      host.appendChild(b);
    });
  }
  function seat(i, btn) {
    var d = dev();
    if (!d || !d.seatWindow) { log("the receiver is not loaded"); return; }
    [].forEach.call(host.children, function (c) { c.classList.remove("is-queued", "is-seated"); });
    var r = d.seatWindow(cur.id, i, { whole: !sliceEl.checked });
    nextWi = (i + 1) % cur.windows.length;
    if (r && r.ok) {
      btn.classList.add("is-seated");
      log("SEATED window " + i + " · " + (r.whole ? "whole" : "slice") + " · in " + r.inS.toFixed(1) + "s · hold " + r.holdS.toFixed(1) + "s · t0 " + r.t0 + "s");
    } else {
      btn.classList.add("is-queued");
      log("QUEUED window " + i + " — " + ((r && r.why) || "not now") + " · it will be retried at the next legal moment");
    }
  }
  sel.addEventListener("change", render);
  document.getElementById("zrl-next").addEventListener("click", function () {
    if (!cur) return;
    var b = host.querySelector('[data-wi="' + nextWi + '"]');
    if (b) b.click();
  });
  document.getElementById("zrl-cancel").addEventListener("click", function () {
    var d = dev(); if (d && d.benchCancel) { d.benchCancel(); log("queued request cancelled"); }
    [].forEach.call(host.children, function (c) { c.classList.remove("is-queued"); });
  });

  setInterval(function () {
    var d = dev(); if (!d || !d.benchState) { stateEl.textContent = "receiver not loaded"; return; }
    var s = d.benchState();
    var bits = [];
    bits.push(s.playing ? "PLAYING" : "stopped");
    bits.push("scene " + (s.scene || "—"));
    bits.push("pool " + s.pool + (s.poolSize ? " (" + s.poolSize + ")" : ""));
    if (s.queued) bits.push("QUEUED " + s.queued.reel + " w" + s.queued.wi + (s.queued.whole ? " whole" : " slice"));
    if (s.armed) bits.push("ARMED " + s.armed.reel + " · hold " + (+s.armed.holdS).toFixed(1) + "s" +
      (s.armed.whole ? " · whole" : "") + (s.armed.inS_left != null ? " · t0 in " + s.armed.inS_left + "s" : ""));
    if (s.live) bits.push("ON THE AIR");
    bits.push("whole cap " + s.limits.wholeMaxHoldS + "s");
    stateEl.textContent = bits.join("   ·   ");
  }, 400);
})();
</script>
<?php include '../../includes/footer.php'; ?>

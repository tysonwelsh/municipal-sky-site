<?php
// ============================================================================
// PICTURE LAB — the bench for the second set's picture (PLAN-SIGNAL-PICTURE
// §6.1). UNLINKED dev page, reachable only by URL: /art/zankyo/picture-lab.
//
// The owner's review surface and the critic's. The faceplate is the real one,
// sliced out of index.php at request time exactly as reel-lab.php does it, so
// the tube here is the production tube — same canvas, same crack, same CSS.
// Nothing is played: the lab drives the set directly with bench descriptors
// (ZankyoSet.signal) in the receiver's own plan grammar, on a paused reel, so
// no AudioContext is needed. Do NOT press PLAY here: once the context exists
// the set's live clock is the audio clock, and a frozen bench reception is on
// the lab's virtual clock (freeze/step), which is what makes a capture exact.
//
//   · a reel (or the test card), and the frame it is paused on
//   · texture: Math.random, or a seeded stream (pixel-reproducible captures)
//   · the character: drawn, or forced — an archetype (§4.1, and 今 for rc.91's
//     look restated), one P1 kind alone ({"impairment":"影","sev":0.5}), or
//     axes as JSON; P2's kinds are refused by name
//   · the shape: 即/探/浮 × 常/戻/断/走 × 切/残/絶, and the time on air
//   · LIVE (the page's clock and rAF) or FROZEN (step frame by frame)
//   · a strip capture of one reception (PNG); a 4×3 contact sheet: the same
//     reel under twelve receptions, side by side, at the same moment (it
//     honours the force field, so "one archetype × 12 seeds" is a force away);
//     and the ARCHETYPE sheet: the eight archetypes, 4×2, at one severity
// ============================================================================
$page_title = "Picture Lab — ZANKYŌ · Municipal Sky";
$page_description = "A private bench for the ZANKYŌ second set's picture.";
function zkv($file) { $path = __DIR__ . '/' . $file; return file_exists($path) ? filemtime($path) : 0; }
$zk_assets = [
    'zankyo-audio.js', 'zankyo-viz.js', 'zankyo-ui.js', 'zk-picture.js', 'zk-set.js', 'zk-broadcast.js', 'broadcast/manifest.json', 'zankyo.css', 'index.php',
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
<!-- the lab starts FROZEN on a virtual clock from the set's first line, so
     every init-time timing is reproducible too (ZK_SET_DEV, read by zk-set.js) -->
<script>window.ZK_SET_DEV = { manual: true, clock: 0 };</script>

<div class="main-wrapper">
<?php
// --- the real faceplate, sliced from index.php (the reel-lab rule: never copy the markup) ---
$zk_src = (string) @file_get_contents(__DIR__ . '/index.php');
$zk_a0 = strpos($zk_src, '<div class="zankyo-scene">');
$zk_b0 = $zk_a0 === false ? false : strpos($zk_src, '<script src="../background-audio.js', $zk_a0);
if ($zk_a0 === false || $zk_b0 === false) {
    echo '<p style="color:#f66;font-family:monospace">picture-lab: could not find the faceplate in index.php '
       . '(looked for &lt;div class="zankyo-scene"&gt; and the background-audio script tag). '
       . 'The markers moved — fix this file rather than copying the markup.</p>';
} else {
    eval('?>' . substr($zk_src, $zk_a0, $zk_b0 - $zk_a0));
}
?>
<div class="zpl">
  <h1>映り · PICTURE LAB <span class="zpl-sub">PLAN-SIGNAL-PICTURE §6.1 · P1: the character drawn per reception</span></h1>
  <p>The tube above is driven from here, not by the receiver. <b>Do not press PLAY</b> on this page. Choose a reel and a shape,
     press <b>receive</b>, then step it frozen or let it run live. Captures are exact when the texture is seeded.</p>
  <div class="zpl-row">
    <label>reel <select id="zpl-reel"><option value="">test card</option></select></label>
    <label>at <input type="number" id="zpl-at" value="20" min="0" step="0.5" style="width:5em" /> s</label>
    <label>texture <input type="text" id="zpl-tex" value="7" placeholder="blank = Math.random" style="width:7em" /></label>
    <label>seed <input type="number" id="zpl-seed" value="211" style="width:6em" /></label>
  </div>
  <div class="zpl-row">
    <label>entry <select id="zpl-entry"><option value="soku">即 snap</option><option value="tan">探 hunt</option><option value="fu">浮 drift in</option></select></label>
    <label>body <select id="zpl-body"><option value="jou">常 one piece</option><option value="modori">戻 return</option><option value="dan">断 holes</option><option value="sou">走 scan</option></select></label>
    <label>exit <select id="zpl-exit"><option value="setsu">切 cut</option><option value="zan">残 lingering</option><option value="zetsu">絶 mid-word</option></select></label>
    <label>on air <input type="number" id="zpl-on" value="10" min="2" max="40" step="1" style="width:4em" /> s</label>
    <label>dropouts <input type="checkbox" id="zpl-drops" checked /></label>
  </div>
  <div class="zpl-row">
    <label class="zpl-wide">force <input type="text" id="zpl-force" placeholder='{"archetype":"遠","sev":0.8}  ·  {"impairment":"影","sev":0.5}  ·  {"archetype":"今"}  ·  blank = as drawn' /></label>
  </div>
  <div class="zpl-row">
    <button type="button" id="zpl-rx">receive</button>
    <span class="zpl-sep"></span>
    <button type="button" id="zpl-frz">freeze</button>
    <button type="button" id="zpl-s1">step 1</button>
    <button type="button" id="zpl-s10">step 10</button>
    <button type="button" id="zpl-run">run frozen ▸</button>
    <button type="button" id="zpl-live">live</button>
    <span class="zpl-sep"></span>
    <button type="button" id="zpl-strip">capture strip</button>
    <button type="button" id="zpl-sheet">contact sheet 4×3</button>
    <button type="button" id="zpl-arch">archetypes 4×2</button>
    <label>at sev <input type="number" id="zpl-arch-sev" value="0.65" min="0" max="1" step="0.05" style="width:4em" /></label>
    <label>sheet at <input type="number" id="zpl-sheet-at" value="3" min="0" step="0.5" style="width:4em" /> s into the hold</label>
  </div>
  <div class="zpl-state" id="zpl-state">—</div>
  <canvas id="zpl-out" class="zpl-out" width="10" height="10"></canvas>
  <div class="zpl-row"><a id="zpl-dl" download="picture.png" href="#" style="display:none">download PNG</a></div>
  <pre class="zpl-ch" id="zpl-ch"></pre>
</div>
</div>
<style>
.zpl { max-width: 980px; margin: 1.5rem auto 4rem; padding: 0 1.25rem; font-family: "JetBrains Mono", ui-monospace, monospace; color: #cfc8d8; }
.zpl h1 { font-size: 1.15rem; letter-spacing: 0.12em; margin: 0 0 0.3rem; }
.zpl-sub { color: #8f879c; font-size: 0.7rem; letter-spacing: 0.08em; }
.zpl p { color: #8f879c; font-size: 0.8rem; max-width: 80ch; line-height: 1.5; }
.zpl-row { display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: center; margin: 0.8rem 0 0.4rem; font-size: 0.78rem; }
.zpl-row select, .zpl-row button, .zpl-row input { font: inherit; font-size: 0.78rem; background: #1a1620; color: #e6dff0; border: 1px solid #4a3f5a; border-radius: 4px; padding: 0.3rem 0.45rem; }
.zpl-row button { cursor: pointer; }
.zpl-row button:hover { border-color: #a58cff; }
.zpl-row button.is-on { border-color: #6fd88a; }
.zpl-wide { flex: 1 1 100%; display: flex; gap: 0.5rem; align-items: center; }
.zpl-wide input { flex: 1; }
.zpl-sep { width: 1px; height: 1.4em; background: #3a3346; }
.zpl-state { font-size: 0.75rem; color: #b7aec6; background: #0e0b12; border: 1px solid #2c2536; padding: 0.5rem 0.6rem; border-radius: 4px; white-space: pre-wrap; margin-top: 0.6rem; }
.zpl-out { display: block; max-width: 100%; margin-top: 0.8rem; background: #030503; }
.zpl-ch { font-size: 0.68rem; color: #8f879c; white-space: pre-wrap; max-height: 20em; overflow: auto; }
.zpl a { color: #a58cff; font-size: 0.78rem; }
@media (max-width: 600px) { .zpl { padding: 0 16px; } }
</style>
<script>window.ZK_ASSET_V = "<?php echo $zk_build; ?>";</script>
<script src="../background-audio.js?v=<?php echo zkv('../background-audio.js'); ?>"></script>
<?php foreach (['pj2-rand','pj2-pitch','pj2-clock','pj2-voice','pj2-fx','pj2-air','pj2-conductor'] as $m): ?>
<script src="../prosperos-jukebox-v2/<?php echo $m; ?>.js?v=<?php echo zkv('../prosperos-jukebox-v2/' . $m . '.js'); ?>"></script>
<?php endforeach; ?>
<script src="zk-far.js?v=<?php echo zkv('zk-far.js'); ?>"></script>
<script src="zankyo-audio.js?v=<?php echo zkv('zankyo-audio.js'); ?>"></script>
<script src="zk-broadcast.js?v=<?php echo zkv('zk-broadcast.js'); ?>"></script>
<script src="zankyo-viz.js?v=<?php echo zkv('zankyo-viz.js'); ?>"></script>
<script src="zk-picture.js?v=<?php echo zkv('zk-picture.js'); ?>"></script>
<script src="zk-set.js?v=<?php echo zkv('zk-set.js'); ?>"></script>
<script src="zankyo-ui.js?v=<?php echo zkv('zankyo-ui.js'); ?>"></script>
<script>
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var ZS = window.ZankyoSet, D = ZS && ZS._dev;
  if (!D || !D.step) { $("zpl-state").textContent = "the set did not load (zk-picture.js / zk-set.js)"; return; }
  var FPS = 30, DT = 1000 / FPS, runTimer = null, video = null, videoKey = "";
  var cur = null;                                           // the last reception sent: { t0, P }

  // the manifest's video reels (the receiver's own file)
  var MANIFEST = "broadcast/manifest.json" + (window.ZK_ASSET_V ? "?v=" + encodeURIComponent(window.ZK_ASSET_V) : "");
  fetch(MANIFEST).then(function (r) { return r.json(); }).then(function (m) {
    var pool = (Array.isArray(m) ? m : (m && m.reels) || []).filter(function (e) { return e && e.id && !e.audioOnly; });
    pool.sort(function (a, b) { return a.id.localeCompare(b.id); });
    pool.forEach(function (e) { var o = document.createElement("option"); o.value = e.id; o.textContent = e.id; $("zpl-reel").appendChild(o); });
    $("zpl-reel").value = pool.some(function (e) { return e.id === "john-cage-interview"; }) ? "john-cage-interview" : "";
  });

  // ---- the plan, in the receiver's grammar (planTimes cloned from zk-broadcast.js) ----
  function planTimes(P) {
    var c = P.entryS, on = 0;
    for (var i = 0; i < P.segments.length; i++) {
      var s = P.segments[i];
      if (i > 0) { P.gaps[i - 1].atS = c; c += P.gaps[i - 1].durS; }
      s.lockAtS = c; c += (s.lockS || 0); s.atS = c;
      c += s.onS + (s.holeS || 0); on += s.onS;
    }
    P.lossAtS = c; P.spanS = c + P.exitS; P.presenceS = on;
    for (var h = 0; h < P.holes.length; h++) P.holes[h].atS = +(P.segments[0].atS + P.holes[h].relS).toFixed(3);
    return P;
  }
  // mid-range values of the receiver's own ranges (PLAN-SIGNAL-SHAPES), fixed
  // so an A/B on the bench changes only what was changed
  function buildPlan(seed) {
    var entry = $("zpl-entry").value, body = $("zpl-body").value, exit = $("zpl-exit").value, on = Math.max(2, +$("zpl-on").value || 10);
    var P = { body: body, entry: entry, exit: exit, entryS: entry === "tan" ? 5 : entry === "fu" ? 8 : 0.4,
              exitS: exit === "zan" ? 8 : exit === "zetsu" ? 0.3 : 2.2, segments: [], gaps: [], holes: [], glimpses: null };
    if (entry === "tan") P.glimpses = [[1.1, 0.5], [2.4, 0.7], [3.9, 0.45]];
    if (body === "modori") { P.segments = [{ onS: on * 0.55, lockS: 0 }, { onS: on * 0.45, lockS: 0.2 }]; P.gaps = [{ durS: 2.2, sweep: false }]; }
    else if (body === "sou") { P.segments = [{ onS: on / 2, lockS: 0 }, { onS: on / 2, lockS: 0 }]; P.gaps = [{ durS: 1.5, sweep: true }]; }
    else if (body === "dan") { P.segments = [{ onS: on, lockS: 0, holeS: 2.5 }]; P.holes = [{ relS: on * 0.3, durS: 1.5 }, { relS: on * 0.7, durS: 1.0 }]; }
    else P.segments = [{ onS: on, lockS: 0 }];
    return planTimes(P);
  }
  function dropsFor(P, t0) {
    if (!$("zpl-drops").checked) return [];
    var d = [], x = 1.3;
    while (x < P.presenceS) { d.push([t0 + P.entryS + x, 0.12 + ((x * 7.3) % 1) * 0.25]); x += 1.2 + ((x * 3.1) % 1) * 3.2; }
    return d;
  }
  function loadReel() {
    var id = $("zpl-reel").value, at = +$("zpl-at").value || 0, key = id + "@" + at;
    if (!id) { video = null; videoKey = ""; return Promise.resolve(null); }
    if (video && videoKey === key) return Promise.resolve(video);
    return new Promise(function (res) {
      var v = document.createElement("video");
      v.muted = true; v.preload = "auto"; v.playsInline = true;
      v.addEventListener("loadeddata", function () { v.addEventListener("seeked", function () { video = v; videoKey = key; res(v); }, { once: true }); v.currentTime = at; }, { once: true });
      v.addEventListener("error", function () { res(null); }, { once: true });
      v.src = "broadcast/reels/" + id + ".mp4";
    });
  }
  function applyTexture() { var t = $("zpl-tex").value.trim(); D.seedTexture(t === "" ? null : +t); }
  var forceOverride = null;                                 // the archetype sheet's, for one reception at a time
  function applyForce() {
    if (forceOverride) return D.force(forceOverride);
    var f = $("zpl-force").value.trim(), r = { ok: true };
    if (!f) { D.force(null); return r; }
    try { r = D.force(JSON.parse(f)); } catch (e) { r = { ok: false, why: "not JSON: " + e.message }; }
    return r;
  }
  // a reception, sent in the set's own signal clock
  function receive(seed) {
    return loadReel().then(function (v) {
      applyTexture();
      var fr = applyForce(); if (!fr.ok) { note("force refused: " + fr.why); return null; }
      var t0 = D.signalClock() + 0.1, P = buildPlan(seed);
      var ok = ZS.signal({ t0: t0, holdS: P.presenceS, lossD: P.exitS, drops: dropsFor(P, t0), seed: seed, id: "lab", rx: P, video: v });
      if (!ok) { note("refused: a reception is still on the tube (let it finish, or step through it)"); return null; }
      cur = { t0: t0, P: P };
      return cur;
    });
  }
  function note(s) { $("zpl-state").textContent = s; }
  function stepN(n) { var t = D.clock(); for (var i = 0; i < n; i++) { t += DT; D.step(t); } show(); }
  function stopRun() { if (runTimer) { clearInterval(runTimer); runTimer = null; $("zpl-run").classList.remove("is-on"); } }
  function show() {
    var s = ZS.getState(), e = cur ? (D.signalClock() - cur.t0) : null;
    note((D.frozen() ? "FROZEN" : "LIVE") + "  ·  clock " + (D.clock() / 1000).toFixed(3) + " s  ·  phase " + s.phase + "  ·  strength " + s.strength.toFixed(3) +
         (e != null && e > -0.5 && e < cur.P.spanS + 2.5 ? "  ·  " + e.toFixed(2) + " s into the reception (span " + cur.P.spanS.toFixed(1) + " s)" : "") +
         "\nframe " + s.frameMs + " ms mean · " + s.worstMs + " ms worst · canvas filter " + (s.hasFilter ? "yes" : "no (the Safari path)"));
    var ch = D.character();
    $("zpl-ch").textContent = "character  " + (ch.archetype || ch.name) + " · " + ch.tier + " · sev " + ch.sev + " · kinds " + JSON.stringify(ch.kinds) + "\n" + JSON.stringify(ch);
  }

  $("zpl-rx").addEventListener("click", function () { receive(+$("zpl-seed").value || 0).then(function (c) { if (c) show(); }); });   // a refusal stays on screen
  $("zpl-frz").addEventListener("click", function () { stopRun(); D.freeze(); show(); });
  $("zpl-s1").addEventListener("click", function () { stopRun(); if (!D.frozen()) D.freeze(); stepN(1); });
  $("zpl-s10").addEventListener("click", function () { stopRun(); if (!D.frozen()) D.freeze(); stepN(10); });
  $("zpl-run").addEventListener("click", function () {
    if (runTimer) { stopRun(); return; }
    if (!D.frozen()) D.freeze();
    $("zpl-run").classList.add("is-on");
    runTimer = setInterval(function () { stepN(1); }, DT);   // the virtual clock advances a frame per tick, whatever the tab's rate
  });
  $("zpl-live").addEventListener("click", function () { stopRun(); D.thaw(); show(); });
  setInterval(function () { if (!runTimer && !D.frozen()) show(); }, 500);

  // ---- captures. Both run the reception FROZEN, stepped at 30 fps from
  // its start, so the persistence is built exactly as the live tube builds it.
  function runTo(tEndS) { var t = D.clock(); while (D.signalClock() < tEndS) { t += DT; D.step(t); } }
  function finish() { if (cur) runTo(cur.t0 + cur.P.spanS + 2.5); }
  function tubeCanvas() { return $("zankyo-set"); }
  function output(cv, name) {
    var out = $("zpl-out"); out.width = cv.width; out.height = cv.height; out.getContext("2d").drawImage(cv, 0, 0);
    var a = $("zpl-dl"); a.href = cv.toDataURL("image/png"); a.download = name; a.style.display = "";
  }
  $("zpl-strip").addEventListener("click", function () {
    stopRun(); if (!D.frozen()) D.freeze(); finish();
    receive(+$("zpl-seed").value || 0).then(function (c) {
      if (!c) return;
      var tube = tubeCanvas(), n = 12, w = Math.round(tube.width / 2), h = Math.round(tube.height / 2);
      var strip = document.createElement("canvas"); strip.width = w * 6; strip.height = h * 2;
      var sx = strip.getContext("2d"); sx.fillStyle = "#000"; sx.fillRect(0, 0, strip.width, strip.height);
      var end = c.t0 + c.P.spanS + 0.42 + 0.32 + 0.4;
      for (var k = 0; k < n; k++) {
        runTo(c.t0 + (k + 0.5) * (end - c.t0) / n);
        sx.drawImage(tube, (k % 6) * w, Math.floor(k / 6) * h, w, h);
        sx.fillStyle = "rgba(200,255,210,0.8)"; sx.font = "11px monospace"; sx.fillText(ZS.getState().phase, (k % 6) * w + 6, Math.floor(k / 6) * h + 14);
      }
      finish(); output(strip, "strip-" + ($("zpl-reel").value || "card") + "-" + $("zpl-seed").value + ".png"); show();
    });
  });
  $("zpl-sheet").addEventListener("click", function () {
    stopRun(); if (!D.frozen()) D.freeze(); finish();
    var tube = tubeCanvas(), w = Math.round(tube.width / 2), h = Math.round(tube.height / 2), at = +$("zpl-sheet-at").value || 0;
    var sheet = document.createElement("canvas"); sheet.width = w * 4; sheet.height = h * 3;
    var sx = sheet.getContext("2d"); sx.fillStyle = "#000"; sx.fillRect(0, 0, sheet.width, sheet.height);
    var base = +$("zpl-seed").value || 0, k = 0;
    (function next() {
      if (k >= 12) { output(sheet, "sheet-" + ($("zpl-reel").value || "card") + "-" + base + ".png"); show(); return; }
      receive(base + k).then(function (c) {
        if (c) {
          runTo(c.t0 + c.P.segments[0].atS + at);
          sx.drawImage(tube, (k % 4) * w, Math.floor(k / 4) * h, w, h);
          sx.fillStyle = "rgba(200,255,210,0.8)"; sx.font = "11px monospace"; sx.fillText("seed " + (base + k), (k % 4) * w + 6, Math.floor(k / 4) * h + 14);
          finish();
        }
        k++; next();
      });
    })();
  });
  $("zpl-arch").addEventListener("click", function () {
    stopRun(); if (!D.frozen()) D.freeze(); finish();
    var tube = tubeCanvas(), w = Math.round(tube.width / 2), h = Math.round(tube.height / 2), at = +$("zpl-sheet-at").value || 0, sev = +$("zpl-arch-sev").value;
    var ids = window.ZankyoPicture.ARCHETYPES.map(function (a) { return a.id; });
    var sheet = document.createElement("canvas"); sheet.width = w * 4; sheet.height = h * 2;
    var sx = sheet.getContext("2d"); sx.fillStyle = "#000"; sx.fillRect(0, 0, sheet.width, sheet.height);
    var seed = +$("zpl-seed").value || 0, k = 0;
    (function next() {
      if (k >= ids.length) { forceOverride = null; output(sheet, "archetypes-" + ($("zpl-reel").value || "card") + "-" + seed + ".png"); show(); return; }
      forceOverride = { archetype: ids[k], sev: isFinite(sev) ? sev : 0.65 };
      receive(seed + k).then(function (c) {                   // a seed each: one seed would put every archetype on the same envelopes and lull
        if (c) {
          runTo(c.t0 + c.P.segments[0].atS + at);
          sx.drawImage(tube, (k % 4) * w, Math.floor(k / 4) * h, w, h);
          sx.fillStyle = "rgba(200,255,210,0.8)"; sx.font = "11px monospace"; sx.fillText(ids[k] + " · sev " + forceOverride.sev + " · seed " + (seed + k), (k % 4) * w + 6, Math.floor(k / 4) * h + 14);
          finish();
        }
        k++; next();
      });
    })();
  });
  show();
})();
</script>
<?php include '../../includes/footer.php'; ?>

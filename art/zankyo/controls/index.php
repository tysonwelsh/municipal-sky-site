<?php
// ============================================================================
// CONTROLS — a skeuomorphic library of inputs and readouts.
//
// UNLINKED dev page (reachable only by URL: /art/zankyo/controls/). Nothing
// here is wired into the ZANKYŌ station; the library exists to be pulled
// from by the station and by every engine after it. Every control is one
// self-contained file in controls/ (see SPEC.md); this page scans that folder
// at request time, reads each file's #sk-meta block, and renders the gallery.
// Thumbnails come from shots/<id>.jpg (tools/snap.js); a control without a
// thumbnail is shown live in an iframe instead.
// ============================================================================
$dir = __DIR__ . '/controls';
$items = [];
foreach (glob($dir . '/*.html') as $f) {
    $slug = basename($f, '.html');
    $src = @file_get_contents($f);
    if ($src === false) continue;
    if (!preg_match('~<script[^>]*id=["\']sk-meta["\'][^>]*>(.*?)</script>~is', $src, $m)) continue;
    $meta = json_decode($m[1], true);
    if (!is_array($meta)) { $meta = ['id' => $slug, 'name' => $slug, 'broken' => 'meta is not valid JSON']; }
    $meta['id'] = $slug;
    $meta['file'] = 'controls/' . $slug . '.html';
    $meta['shot'] = is_file(__DIR__ . '/shots/' . $slug . '.jpg') ? 'shots/' . $slug . '.jpg?v=' . filemtime(__DIR__ . '/shots/' . $slug . '.jpg') : null;
    $meta['mtime'] = filemtime($f);
    $meta['bytes'] = filesize($f);
    $items[] = $meta;
}
usort($items, function ($a, $b) {
    $ca = $a['code'] ?? 'Z99'; $cb = $b['code'] ?? 'Z99';
    $sa = $ca[0]; $sb = $cb[0];
    if ($sa !== $sb) return strcmp($sa, $sb);
    $na = (int) substr($ca, 1); $nb = (int) substr($cb, 1);
    if ($na !== $nb) return $na - $nb;
    return strcmp($a['name'] ?? '', $b['name'] ?? '');
});
$sections = [
    'A' => 'Rotary inputs', 'B' => 'Linear inputs', 'C' => 'Switches', 'D' => 'Buttons', 'E' => 'Compound & gestural',
    'F' => 'Needle & pointer readouts', 'G' => 'Numerals & characters', 'H' => 'Lamps, legends & light', 'I' => 'Mechanical & fluid readouts', 'J' => 'Panels & furniture',
];
$count = count($items);
$docs = [];
foreach (['PLAN.md' => 'Plan 1 · taxonomy', 'PLAN-2-MACHINES.md' => 'Plan 2 · machines', 'PLAN-3-STYLES.md' => 'Plan 3 · styles', 'SPEC.md' => 'Spec · how a control is built', 'BUILD.md' => 'Build log'] as $f => $t) {
    if (is_file(__DIR__ . '/' . $f)) $docs[$f] = $t;
}
$v = @filemtime(__DIR__ . '/index.php');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CONTROLS — a skeuomorphic library · ZANKYŌ · Municipal Sky</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  color-scheme: dark;
  --bg: #0b0b0e; --ink: #d6d2dc; --dim: #8d8797; --faint: #5c5765; --rule: #24242b; --card: #131317;
  --cyan: #16e0e0; --amber: #ffb000; --red: #ff2d55;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace; --display: "Orbitron", sans-serif; --serif: "Shippori Mincho", Georgia, serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: radial-gradient(90% 50% at 50% 0%, #17171d, var(--bg) 70%); color: var(--ink); font-family: var(--mono); font-size: 12px; line-height: 1.6; padding: 26px 22px 80px; }
a { color: var(--cyan); text-decoration: none; } a:hover { text-decoration: underline; }
.wrap { max-width: 1480px; margin: 0 auto; }

/* ---- header ---- */
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px 30px; margin-bottom: 18px; }
h1 { font-family: var(--display); font-weight: 900; font-size: 26px; letter-spacing: 0.18em; margin: 0; color: #eee9f4; }
h1 .kanji { font-family: var(--serif); font-weight: 500; letter-spacing: 0.1em; color: var(--dim); font-size: 20px; margin-left: 12px; vertical-align: 2px; }
.lede { color: var(--dim); font-size: 12px; margin: 6px 0 0; max-width: 78ch; }
.lede b { color: #b9b3c4; font-weight: 500; }
.docs { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 11px; }
.docs a { color: var(--dim); letter-spacing: 0.06em; } .docs a:hover { color: var(--cyan); }
.docs .n { color: var(--amber); font-family: var(--display); font-size: 11px; letter-spacing: 0.1em; }

/* ---- toolbar ---- */
.bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 0; margin: 0 0 14px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); background: rgba(11,11,14,0.94); backdrop-filter: blur(6px); }
.bar input[type="search"], .bar select { font: inherit; font-size: 12px; color: var(--ink); background: #101014; border: 1px solid #2a2a32; border-radius: 3px; padding: 5px 8px; }
.bar input[type="search"] { width: 240px; }
.bar input[type="search"]:focus, .bar select:focus { outline: none; border-color: var(--cyan); }
.chips { display: flex; gap: 4px; }
.chip { font: inherit; font-size: 11px; letter-spacing: 0.08em; color: var(--dim); background: #131317; border: 1px solid #2a2a32; border-radius: 3px; padding: 4px 9px; cursor: pointer; }
.chip:hover { border-color: #4a4a54; color: var(--ink); }
.chip.on { color: #0b0b0e; background: #b9b3c4; border-color: #b9b3c4; }
.bar .count { margin-left: auto; color: var(--faint); font-size: 11px; letter-spacing: 0.06em; }
.bar .count b { color: var(--amber); font-weight: 500; }
.bar label { display: flex; align-items: center; gap: 6px; color: var(--dim); font-size: 11px; cursor: pointer; }
.bar label input { accent-color: var(--cyan); }

/* ---- grid ---- */
.section-h { font-family: var(--display); font-size: 11px; letter-spacing: 0.26em; color: #b9b3c4; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--rule); display: flex; align-items: baseline; gap: 12px; }
.section-h .n { color: var(--faint); letter-spacing: 0.1em; font-size: 10px; }
.section-h:first-child { margin-top: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.card { position: relative; background: var(--card); border: 1px solid #1f1f25; border-radius: 5px; overflow: hidden; cursor: pointer; transition: border-color 120ms, transform 120ms; }
.card:hover, .card:focus-visible { border-color: #4a4a54; transform: translateY(-1px); outline: none; }
.card:focus-visible { box-shadow: 0 0 0 2px var(--cyan); }
.card .thumb { position: relative; aspect-ratio: 3 / 2; background: #0e0e11; overflow: hidden; }
.card .thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.card .thumb iframe { display: block; width: 100%; height: 100%; border: 0; pointer-events: none; background: #0b0b0e; }
.card.live .thumb iframe { pointer-events: auto; }
.card .code { position: absolute; left: 8px; top: 8px; font-family: var(--display); font-size: 9px; letter-spacing: 0.16em; color: #0b0b0e; background: rgba(185,179,196,0.92); padding: 3px 6px 2px; border-radius: 2px; pointer-events: none; }
.card .kind { position: absolute; right: 8px; top: 8px; font-size: 9px; letter-spacing: 0.16em; color: var(--bg); padding: 3px 6px 2px; border-radius: 2px; font-family: var(--display); pointer-events: none; }
.card .kind.input { background: var(--cyan); } .card .kind.output { background: var(--amber); } .card .kind.both { background: linear-gradient(90deg, var(--cyan), var(--amber)); }
.card .body { padding: 9px 11px 10px; }
.card .name { font-family: var(--serif); font-size: 14px; color: #e6e1ee; margin: 0; line-height: 1.35; }
.card .src { color: var(--dim); font-size: 11px; margin: 3px 0 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card .meta { color: var(--faint); font-size: 10px; letter-spacing: 0.06em; margin: 6px 0 0; display: flex; gap: 10px; flex-wrap: wrap; }
.card .meta .era { color: #a49c88; }
.card.broken .thumb::after { content: "meta error"; position: absolute; inset: auto 8px 8px auto; color: var(--red); font-size: 10px; letter-spacing: 0.1em; }
.empty { color: var(--faint); padding: 40px 0; text-align: center; }

/* ---- detail ---- */
.detail { position: fixed; inset: 0; z-index: 20; display: none; background: rgba(4,4,6,0.86); backdrop-filter: blur(4px); }
.detail.open { display: flex; flex-direction: column; }
.detail .dhead { display: flex; align-items: center; gap: 14px; padding: 10px 18px; border-bottom: 1px solid var(--rule); background: #0e0e12; flex-wrap: wrap; }
.detail .dhead .code { font-family: var(--display); font-size: 10px; letter-spacing: 0.16em; color: #0b0b0e; background: #b9b3c4; padding: 3px 7px 2px; border-radius: 2px; }
.detail .dhead h2 { font-family: var(--serif); font-size: 16px; margin: 0; color: #eee9f4; font-weight: 500; }
.detail .dhead .src { color: var(--dim); font-size: 11px; flex: 1 1 320px; }
.detail .dhead .acts { display: flex; gap: 8px; margin-left: auto; }
.detail button, .detail .btn { font: inherit; font-size: 11px; letter-spacing: 0.06em; color: var(--ink); background: #1a1a20; border: 1px solid #34343c; border-radius: 3px; padding: 5px 11px; cursor: pointer; }
.detail button:hover, .detail .btn:hover { border-color: var(--cyan); text-decoration: none; }
.detail .nav { font-family: var(--display); font-size: 12px; }
.detail iframe { flex: 1; width: 100%; border: 0; background: var(--bg); }
.detail .dfoot { padding: 6px 18px; font-size: 10px; color: var(--faint); border-top: 1px solid var(--rule); background: #0e0e12; display: flex; gap: 18px; flex-wrap: wrap; }
.detail .dfoot code { color: var(--dim); }
.toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 30; background: #16e0e0; color: #0b0b0e; font-size: 11px; letter-spacing: 0.08em; padding: 6px 14px; border-radius: 3px; opacity: 0; transition: opacity 160ms; pointer-events: none; }
.toast.on { opacity: 1; }
@media (max-width: 640px) { body { padding: 18px 14px 60px; } .bar input[type="search"] { width: 100%; } h1 { font-size: 20px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="head">
    <div>
      <h1>CONTROLS<span class="kanji">操作盤</span></h1>
      <p class="lede">A library of <b>skeuomorphic inputs and readouts</b> — knobs, switches, buttons, faders, wheels, meters, lamps,
      counters, tubes — each one a specific machine from the history of machines, built as a self-contained web component
      you can paste into any page. A dev page of ZANKYŌ; nothing here is wired to the station.</p>
    </div>
    <nav class="docs">
      <span class="n"><?php echo $count; ?> controls</span>
      <?php foreach ($docs as $f => $t): ?><a href="<?php echo htmlspecialchars($f); ?>"><?php echo htmlspecialchars($t); ?></a><?php endforeach; ?>
      <a href="../">← ZANKYŌ</a>
    </nav>
  </header>

  <div class="bar" id="bar">
    <input type="search" id="q" placeholder="search  name · source · tag · material" autocomplete="off">
    <div class="chips" id="kind">
      <button class="chip on" data-v="">all</button><button class="chip" data-v="input">inputs</button><button class="chip" data-v="output">outputs</button><button class="chip" data-v="both">both</button>
    </div>
    <select id="sec"><option value="">every section</option><?php foreach ($sections as $k => $t): ?><option value="<?php echo $k; ?>"><?php echo $k; ?> · <?php echo htmlspecialchars($t); ?></option><?php endforeach; ?></select>
    <select id="era"><option value="">every era</option></select>
    <select id="origin"><option value="">everywhere</option></select>
    <select id="mat"><option value="">any material</option></select>
    <select id="sort"><option value="code">by section</option><option value="name">by name</option><option value="era">by era</option><option value="new">newest first</option></select>
    <label><input type="checkbox" id="live"> live cards</label>
    <span class="count"><b id="n"><?php echo $count; ?></b> shown</span>
  </div>

  <div id="out"></div>
</div>

<div class="detail" id="detail" role="dialog" aria-modal="true" aria-label="control detail">
  <div class="dhead">
    <button class="nav" id="prev" title="previous (←)">‹</button>
    <span class="code" id="dcode"></span>
    <h2 id="dname"></h2>
    <span class="src" id="dsrc"></span>
    <div class="acts">
      <button id="copy">copy element code</button>
      <a class="btn" id="open" target="_blank" rel="noopener">open page ↗</a>
      <a class="btn" id="dl" download>download .html</a>
      <button id="close" title="close (Esc)">close ×</button>
    </div>
    <button class="nav" id="next" title="next (→)">›</button>
  </div>
  <iframe id="frame" title="control demo"></iframe>
  <div class="dfoot" id="dfoot"></div>
</div>
<div class="toast" id="toast"></div>

<script>
const ITEMS = <?php echo json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
const SECTIONS = <?php echo json_encode($sections, JSON_UNESCAPED_UNICODE); ?>;
(function () {
  const $ = s => document.querySelector(s);
  const out = $("#out"), q = $("#q"), sec = $("#sec"), era = $("#era"), origin = $("#origin"), mat = $("#mat"), sort = $("#sort"), live = $("#live"), n = $("#n");
  let kind = "";
  const state = () => ({ q: q.value.trim().toLowerCase(), kind, sec: sec.value, era: era.value, origin: origin.value, mat: mat.value, sort: sort.value });

  // populate the era / origin / material selects from the data
  function fill(select, values) { [...new Set(values.filter(Boolean))].sort().forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; select.appendChild(o); }); }
  fill(era, ITEMS.map(i => i.era)); fill(origin, ITEMS.map(i => i.origin)); fill(mat, ITEMS.flatMap(i => i.materials || []));

  // restore from the URL
  const u = new URLSearchParams(location.search);
  if (u.get("q")) q.value = u.get("q"); if (u.get("kind")) kind = u.get("kind"); if (u.get("sec")) sec.value = u.get("sec");
  if (u.get("era")) era.value = u.get("era"); if (u.get("origin")) origin.value = u.get("origin"); if (u.get("mat")) mat.value = u.get("mat");
  if (u.get("sort")) sort.value = u.get("sort"); if (u.get("live")) live.checked = true;
  document.querySelectorAll("#kind .chip").forEach(c => c.classList.toggle("on", c.dataset.v === kind));

  function hay(i) { return [i.name, i.source, i.type, i.code, i.era, i.origin, i.element, ...(i.tags || []), ...(i.materials || [])].join(" ").toLowerCase(); }
  function filtered() {
    const s = state();
    let list = ITEMS.filter(i => (!s.q || hay(i).includes(s.q)) && (!s.kind || i.kind === s.kind) && (!s.sec || (i.code || "").charAt(0) === s.sec)
      && (!s.era || i.era === s.era) && (!s.origin || i.origin === s.origin) && (!s.mat || (i.materials || []).includes(s.mat)));
    const codeKey = i => { const c = i.code || "Z99"; return c.charAt(0) + String(parseInt(c.slice(1), 10) || 99).padStart(3, "0"); };
    if (s.sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (s.sort === "era") list.sort((a, b) => (a.era || "zz").localeCompare(b.era || "zz") || codeKey(a).localeCompare(codeKey(b)));
    else if (s.sort === "new") list.sort((a, b) => b.mtime - a.mtime);
    else list.sort((a, b) => codeKey(a).localeCompare(codeKey(b)) || (a.name || "").localeCompare(b.name || ""));
    return list;
  }
  let current = [];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function card(i, idx) {
    const thumb = (live.checked || !i.shot)
      ? `<iframe loading="lazy" src="${esc(i.file)}?embed${live.checked ? "" : "&still"}" title="${esc(i.name)}"></iframe>`
      : `<img loading="lazy" src="${esc(i.shot)}" alt="${esc(i.name)}">`;
    return `<article class="card${i.broken ? " broken" : ""}${live.checked ? " live" : ""}" tabindex="0" data-i="${idx}">
      <div class="thumb">${thumb}<span class="code">${esc(i.code || "?")}</span><span class="kind ${esc(i.kind || "")}">${esc((i.kind || "").toUpperCase())}</span></div>
      <div class="body"><h3 class="name">${esc(i.name)}</h3><p class="src">${esc(i.source || i.type || "")}</p>
      <p class="meta"><span class="era">${esc(i.era || "")}</span><span>${esc(i.origin || "")}</span><span>${esc(i.type || "")}</span></p></div></article>`;
  }
  function render() {
    current = filtered();
    n.textContent = current.length;
    const s = state();
    const p = new URLSearchParams(); Object.keys(s).forEach(k => { if (s[k] && !(k === "sort" && s[k] === "code")) p.set(k, s[k]); }); if (live.checked) p.set("live", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
    if (!current.length) { out.innerHTML = `<p class="empty">nothing matches — clear a filter</p>`; return; }
    let html = "";
    if (s.sort === "code") {
      let last = null;
      current.forEach((i, idx) => {
        const k = (i.code || "Z").charAt(0);
        if (k !== last) { if (last !== null) html += `</div>`; last = k; const cnt = current.filter(j => (j.code || "Z").charAt(0) === k).length; html += `<h2 class="section-h">${k} · ${esc(SECTIONS[k] || "unsorted")}<span class="n">${cnt}</span></h2><div class="grid">`; }
        html += card(i, idx);
      });
      html += `</div>`;
    } else html = `<div class="grid">${current.map(card).join("")}</div>`;
    out.innerHTML = html;
  }
  [q, sec, era, origin, mat, sort, live].forEach(e => e.addEventListener("input", render));
  document.querySelectorAll("#kind .chip").forEach(c => c.addEventListener("click", () => { kind = c.dataset.v; document.querySelectorAll("#kind .chip").forEach(x => x.classList.toggle("on", x === c)); render(); }));
  out.addEventListener("click", e => { const c = e.target.closest(".card"); if (c && !live.checked) open(+c.dataset.i); });
  out.addEventListener("keydown", e => { const c = e.target.closest(".card"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(+c.dataset.i); } });

  // ---- detail ----
  const detail = $("#detail"), frame = $("#frame"), toast = $("#toast");
  let openIdx = -1;
  function open(idx) {
    const i = current[idx]; if (!i) return;
    openIdx = idx;
    $("#dcode").textContent = (i.code || "?") + " · " + (i.type || "");
    $("#dname").textContent = i.name || i.id;
    $("#dsrc").textContent = [i.source, i.era, i.origin].filter(Boolean).join("  ·  ");
    $("#open").href = i.file; $("#dl").href = i.file; $("#dl").setAttribute("download", i.id + ".html");
    $("#dfoot").innerHTML = `<span>element <code>&lt;${esc(i.element || "?")}&gt;</code></span><span>value <code>${esc((i.value || {}).model || "?")}</code></span>`
      + `<span>attributes <code>${esc((i.attributes || []).join(" "))}</code></span><span>events <code>${esc((i.events || []).join(" ") || "—")}</code></span>`
      + `<span>${esc((i.materials || []).join(", "))}</span><span>${esc((i.tags || []).join(", "))}</span><span>${(i.bytes / 1024).toFixed(0)} KB</span>`;
    frame.src = i.file + "?still";
    detail.classList.add("open"); document.body.style.overflow = "hidden";
    $("#close").focus();
  }
  function close() { detail.classList.remove("open"); frame.src = "about:blank"; document.body.style.overflow = ""; const c = out.querySelector(`.card[data-i="${openIdx}"]`); if (c) c.focus(); openIdx = -1; }
  $("#close").addEventListener("click", close);
  $("#prev").addEventListener("click", () => open((openIdx - 1 + current.length) % current.length));
  $("#next").addEventListener("click", () => open((openIdx + 1) % current.length));
  detail.addEventListener("click", e => { if (e.target === detail) close(); });
  document.addEventListener("keydown", e => {
    if (!detail.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") open((openIdx - 1 + current.length) % current.length);
    else if (e.key === "ArrowRight") open((openIdx + 1) % current.length);
  });
  function say(t) { toast.textContent = t; toast.classList.add("on"); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove("on"), 1600); }
  $("#copy").addEventListener("click", async () => {
    const i = current[openIdx]; if (!i) return;
    try {
      const html = await (await fetch(i.file)).text();
      const m = html.match(/<script[^>]*id=["']sk-element["'][^>]*>([\s\S]*?)<\/script>/i);
      if (!m) { say("no #sk-element block in that file"); return; }
      await navigator.clipboard.writeText(m[1].trim() + "\n");
      say("element code copied — paste it in a <script>, then use <" + (i.element || "sk-…") + ">");
    } catch (err) { say("copy failed: " + err.message); }
  });

  render();
})();
</script>
</body>
</html>

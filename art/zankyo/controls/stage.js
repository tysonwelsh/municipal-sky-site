/* ===========================================================================
   CONTROLS — stage.js
   The demo-page harness shared by every control in controls/*.html.

   What it does, given a page that follows SPEC.md:
   - reads the <script type="application/json" id="sk-meta"> block
   - fills the header (name, code, source, era) if the page left it empty
   - builds the BENCH under the stage: a live readout of every sk-* element on
     the stage, a driver for output controls (slider / select / checkbox /
     text), an auto-demo toggle, a zoom selector, a panel-material selector,
     an event log, and a "copy element code" button
   - ?embed  → strips the page to the stage only, scales the contents to fit
     the viewport, and auto-drives output controls so thumbnails and cards
     show life. ?embed&still → no auto-drive (used for screenshots that
     should be reproducible). ?panel=<name> overrides the stage material.
   - never touches the inside of a control: everything here talks to the
     element through its `value` property/attribute and its input/change
     events, exactly as a host app would.
   =========================================================================== */
(function () {
  "use strict";

  // options come from the query string or the hash (#embed&still), so hosts that
  // cannot serve a path with a query string still get the embed view
  var q = new URLSearchParams((location.search || "").replace(/^\?/, "") + "&" + (location.hash || "").replace(/^#/, ""));
  var EMBED = q.has("embed");
  var STILL = q.has("still");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  // ---- meta -------------------------------------------------------------
  var meta = {};
  try { meta = JSON.parse(($("#sk-meta") || {}).textContent || "{}"); } catch (e) { console.error("sk-meta is not valid JSON", e); }
  window.SK_META = meta;
  var vm = meta.value || { model: "range", min: 0, max: 1 };
  var isInput = meta.kind === "input" || meta.kind === "both";
  var isOutput = meta.kind === "output" || meta.kind === "both";

  // ---- embed ------------------------------------------------------------
  if (EMBED) document.documentElement.classList.add("sk-embed");
  var stage = $(".sk-stage");
  if (!stage) { console.error("stage.js: no .sk-stage on the page"); return; }
  if (q.get("panel")) stage.setAttribute("data-panel", q.get("panel"));

  // the stage's children are wrapped so they can be scaled as one in embed mode
  var fit = el("div", { "class": "sk-fit" });
  while (stage.firstChild) fit.appendChild(stage.firstChild);
  stage.appendChild(fit);

  // every custom element on the stage whose tag starts with sk-
  function stageElements() {
    return Array.prototype.filter.call(fit.querySelectorAll("*"), function (n) { return n.tagName.toLowerCase().indexOf("sk-") === 0; })
      .filter(function (n) { return !n.closest || n.closest("[data-sk-ignore]") == null; });
  }
  var elems = stageElements();
  var primary = elems[0] || null;

  // ---- header -----------------------------------------------------------
  var head = $(".sk-head");
  if (head && !head.children.length) {
    head.appendChild(el("p", { "class": "sk-crumb" }, [el("a", { href: "../", text: "CONTROLS" }), " / " + (meta.code || "") ]));
    head.appendChild(el("h1", {}, [el("span", { "class": "sk-code", text: (meta.code || "?") + " · " + (meta.type || "") }), meta.name || document.title]));
    if (meta.source) head.appendChild(el("p", { "class": "sk-source", text: meta.source }));
    var bits = [];
    if (meta.era) bits.push(meta.era);
    if (meta.origin) bits.push(meta.origin);
    if (meta.materials && meta.materials.length) bits.push(meta.materials.join(", "));
    if (meta.kind) bits.push(meta.kind.toUpperCase());
    head.appendChild(el("p", { "class": "sk-line", text: bits.join("  ·  ") }));
  }
  if (meta.name && document.title.indexOf(meta.name) < 0) document.title = meta.name + " — CONTROLS";

  // ---- value helpers ----------------------------------------------------
  function fmt(v) {
    if (v == null) return "—";
    if (typeof v === "number") { var s = (Math.abs(v) >= 100 || Number.isInteger(v)) ? String(Math.round(v * 100) / 100) : v.toFixed(2); return s + (vm.unit ? " " + vm.unit : ""); }
    if (typeof v === "boolean") return v ? "ON" : "OFF";
    if (Array.isArray(v)) return v.length > 12 ? "[" + v.length + " samples]" : JSON.stringify(v);
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }
  function readValue(node) {
    if (!node) return null;
    if ("value" in node) return node.value;
    return node.getAttribute("value");
  }
  function writeValue(node, v) {
    if (!node) return;
    if ("value" in node) node.value = v; else node.setAttribute("value", String(v));
  }

  // ---- bench ------------------------------------------------------------
  var bench = $(".sk-bench");
  if (bench && !EMBED) buildBench(bench);

  function buildBench(bench) {
    bench.innerHTML = "";
    // left: readout + driver
    var left = el("div");
    left.appendChild(el("h2", { text: "READOUT" }));
    var readouts = [];
    elems.forEach(function (node, i) {
      var r = el("span", { "class": "sk-readout", text: fmt(readValue(node)) });
      readouts.push(r);
      left.appendChild(el("label", {}, [el("span", { text: elems.length > 1 ? (node.getAttribute("label") || node.id || ("#" + (i + 1))) : "value" }), r]));
    });
    var log = el("pre", { "class": "sk-events" });
    function note(node, type, detail) {
      var i = elems.indexOf(node); if (i < 0) return;
      readouts[i].textContent = fmt(detail && "value" in detail ? detail.value : readValue(node));
      readouts[i].classList.add("is-changed"); setTimeout(function () { readouts[i].classList.remove("is-changed"); }, 160);
      var line = type + (elems.length > 1 ? " #" + (i + 1) : "") + " " + JSON.stringify(detail === undefined ? null : detail);
      log.textContent = (line + "\n" + log.textContent).split("\n").slice(0, 6).join("\n");
    }
    ["input", "change", "press", "release", "activate", "step"].forEach(function (t) {
      fit.addEventListener(t, function (ev) { var n = ev.target; while (n && elems.indexOf(n) < 0) n = n.parentNode; if (n) note(n, t, ev.detail); });
    });
    left.appendChild(el("label", {}, [el("span", { text: "events" }), log]));

    if (isOutput && primary) {
      left.appendChild(el("h2", { text: "DRIVE", style: "margin-top:12px" }));
      var driver = makeDriver(function (v) { elems.forEach(function (n) { writeValue(n, v); }); readouts.forEach(function (r) { r.textContent = fmt(v); }); });
      if (driver) left.appendChild(driver.row);
      var auto = el("input", { type: "checkbox" });
      auto.checked = !STILL;
      left.appendChild(el("label", {}, [el("span", { text: "auto-demo" }), auto, el("span", { text: "a generic driver for the value model; the control's own demo() if it has one", style: "color:var(--sk-ink-faint)" })]));
      startAuto(function () { return auto.checked; }, function (v) { if (driver) driver.set(v); readouts.forEach(function (r) { r.textContent = fmt(v); }); });
    }
    bench.appendChild(left);

    // right: page controls + meta
    var right = el("div");
    right.appendChild(el("h2", { text: "BENCH" }));
    var zoom = el("select", {});
    [0.75, 1, 1.5, 2, 3].forEach(function (z) { zoom.appendChild(el("option", { value: z, text: z + "×" })); });
    zoom.value = "1";
    zoom.addEventListener("change", function () { fit.style.zoom = zoom.value; });
    right.appendChild(el("label", {}, [el("span", { text: "zoom" }), zoom]));
    var panel = el("select", {});
    ["steel", "black", "aluminium", "aluminium-black", "hammertone", "wrinkle", "olive", "grey-enamel", "bakelite", "bakelite-black", "brass", "chrome", "wood", "beige", "putty", "plastic-grey", "white", "cream", "navy", "red", "soviet", "none"].forEach(function (p) { panel.appendChild(el("option", { value: p, text: p })); });
    panel.value = stage.getAttribute("data-panel") || "steel";
    panel.addEventListener("change", function () { stage.setAttribute("data-panel", panel.value); });
    right.appendChild(el("label", {}, [el("span", { text: "panel" }), panel]));
    var copy = el("button", { text: "copy element code", onclick: function () {
      var s = $("#sk-element"); if (!s) { copy.textContent = "no #sk-element script"; return; }
      navigator.clipboard.writeText(s.textContent).then(function () { copy.textContent = "copied ✓"; setTimeout(function () { copy.textContent = "copy element code"; }, 1400); });
    } });
    var open = el("a", { href: location.pathname + "#embed", target: "_blank", text: "embed view ↗" });
    right.appendChild(el("label", {}, [el("span", { text: "source" }), copy, open]));

    var kv = el("dl", { "class": "sk-kv" });
    function row(k, v) { if (v == null || v === "") return; kv.appendChild(el("dt", { text: k })); kv.appendChild(el("dd", { html: v })); }
    row("element", "<code>&lt;" + (meta.element || "?") + "&gt;</code>");
    row("kind", meta.kind);
    row("value", vm.model + (vm.min != null ? " " + vm.min + "…" + vm.max : "") + (vm.step ? " step " + vm.step : "") + (vm.unit ? " " + vm.unit : "") + (vm.options ? " [" + vm.options.join(" | ") + "]" : ""));
    row("attributes", (meta.attributes || []).map(function (a) { return "<code>" + a + "</code>"; }).join(" ") || null);
    row("events", (meta.events || (isInput ? ["input", "change"] : [])).map(function (a) { return "<code>" + a + "</code>"; }).join(" ") || null);
    row("size", meta.size ? meta.size.w + " × " + meta.size.h + " px" : null);
    row("tags", (meta.tags || []).join(", ") || null);
    right.appendChild(el("h2", { text: "CONTRACT", style: "margin-top:12px" }));
    right.appendChild(kv);
    bench.appendChild(right);
  }

  // a driver for the primary value model
  function makeDriver(apply) {
    var m = vm.model;
    var cur = readValue(primary);
    if (m === "range" || m === "digits" || m === "time" || m === "delta") {
      var min = vm.min != null ? vm.min : 0, max = vm.max != null ? vm.max : (m === "digits" ? 9999 : 1);
      var step = vm.step || (m === "digits" ? 1 : (max - min) / 200);
      var r = el("input", { type: "range", min: min, max: max, step: step });
      r.value = typeof cur === "number" ? cur : min;
      r.addEventListener("input", function () { apply(parseFloat(r.value)); });
      return { row: el("label", {}, [el("span", { text: "set" }), r]), set: function (v) { r.value = v; } };
    }
    if (m === "steps") {
      if (vm.options) {
        var s = el("select", {});
        vm.options.forEach(function (o, i) { s.appendChild(el("option", { value: String(o), text: String(o) })); });
        s.value = String(cur);
        s.addEventListener("change", function () { apply(s.value); });
        return { row: el("label", {}, [el("span", { text: "set" }), s]), set: function (v) { s.value = String(v); } };
      }
      var r2 = el("input", { type: "range", min: vm.min || 0, max: vm.max || 10, step: vm.step || 1 });
      r2.value = typeof cur === "number" ? cur : 0;
      r2.addEventListener("input", function () { apply(parseInt(r2.value, 10)); });
      return { row: el("label", {}, [el("span", { text: "set" }), r2]), set: function (v) { r2.value = v; } };
    }
    if (m === "boolean") {
      var c = el("input", { type: "checkbox" });
      c.checked = cur === true || cur === "true" || cur === "on" || cur === "1";
      c.addEventListener("change", function () { apply(c.checked); });
      return { row: el("label", {}, [el("span", { text: "set" }), c]), set: function (v) { c.checked = !!v; } };
    }
    if (m === "text") {
      var t = el("input", { type: "text", value: cur == null ? "" : String(cur) });
      t.addEventListener("input", function () { apply(t.value); });
      return { row: el("label", {}, [el("span", { text: "set" }), t]), set: function (v) { t.value = v; } };
    }
    return null;
  }

  // ---- auto-demo --------------------------------------------------------
  // A generic driver per value model. A control may instead define demo(t)
  // (t in seconds) returning the value to show, or demo(t) returning
  // undefined and animating itself.
  var autoOn = function () { return isOutput && !STILL; };
  var autoApply = function (v) { elems.forEach(function (n) { writeValue(n, v); }); };
  function startAuto(isOn, apply) { autoOn = isOn; autoApply = apply; }
  var words = vm.options || meta.demoWords || ["ZANKYO", "ON AIR", "SIGNAL", "RECEIVE", "3042", "TOKYO", "STANDBY", "残響"];
  var noise = (function () { var a = Math.random() * 100; return function (t) { return 0.5 + 0.28 * Math.sin(t * 0.7 + a) + 0.16 * Math.sin(t * 1.9 + a * 3) + 0.06 * Math.sin(t * 6.3 + a * 7); }; })();
  function generic(t) {
    var m = vm.model, min = vm.min != null ? vm.min : 0, max = vm.max != null ? vm.max : 1;
    switch (m) {
      case "range": case "delta": return min + (max - min) * Math.min(1, Math.max(0, noise(t)));
      case "digits": return Math.floor((min + (max - min) * ((t * 0.08) % 1)));
      case "time": return (t * 1) % (max || 60);
      case "steps": if (vm.options) return vm.options[Math.floor(t / 2.2) % vm.options.length]; return Math.floor(min + ((t / 1.6) % ((max - min) + 1)));
      case "boolean": return Math.floor(t / 1.8) % 2 === 0;
      case "text": return words[Math.floor(t / 2.6) % words.length];
      case "bits": { var n = vm.count || 8, out = []; for (var i = 0; i < n; i++) out.push(Math.sin(t * (0.5 + i * 0.13) + i) > 0.55); return out; }
      case "waveform": { var N = vm.count || 128, w = []; for (var j = 0; j < N; j++) { var x = j / N; w.push(0.5 + 0.4 * Math.sin(x * 12.6 + t * 4) * (0.6 + 0.4 * Math.sin(t * 0.9))); } return w; }
      case "xy": return { x: 0.5 + 0.4 * Math.cos(t), y: 0.5 + 0.4 * Math.sin(t * 1.3) };
      default: return null;
    }
  }
  if (isOutput && primary) {
    var t0 = performance.now();
    (function tick(now) {
      requestAnimationFrame(tick);
      if (!autoOn()) return;
      var t = (now - t0) / 1000;
      var v;
      if (typeof primary.demo === "function") { v = primary.demo(t); if (v === undefined) return; }
      else v = generic(t);
      if (v !== null) autoApply(v);
    })(t0);
  }

  // ---- embed scaling ----------------------------------------------------
  function fitToStage() {
    if (!EMBED) return;
    fit.style.transform = "";
    var pad = 28;
    var sw = stage.clientWidth - pad, sh = stage.clientHeight - pad;
    var r = fit.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    var s = Math.min(1, sw / r.width, sh / r.height);
    if (s < 0.999) fit.style.transform = "scale(" + s + ")";
  }
  if (EMBED) {
    fitToStage();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitToStage);
    window.addEventListener("resize", fitToStage);
    setTimeout(fitToStage, 50); setTimeout(fitToStage, 400);
  }

  // ---- sanity checks (surface contract problems in the console) --------
  window.addEventListener("load", function () {
    if (!meta.element) console.warn("sk-meta.element is missing");
    else if (!customElements.get(meta.element)) console.error("custom element <" + meta.element + "> is not defined");
    if (!primary) console.error("no sk-* element on the stage");
    else if (primary.getBoundingClientRect().width === 0) console.error("the control has zero width");
    if (!$("#sk-element")) console.warn("no <script id=\"sk-element\"> — 'copy element code' will not work");
  });
})();

#!/usr/bin/env node
/* ===========================================================================
   CONTROLS — tools/snap.js
   Screenshots + contract checks for the controls in ../controls/.

     node art/zankyo/controls/tools/snap.js <slug> [<slug> ...]
     node art/zankyo/controls/tools/snap.js --all
     options: --no-bench   skip the full-page (bench) screenshot
              --live       don't pass &still (outputs animate; non-reproducible)

   For each control it opens controls/<slug>.html?embed&still in headless
   Chromium at 360×240 css px (2× → 720×480 png), records console errors and
   page errors, checks the meta block, the element definition, the element's
   size, and whether the keyboard moves it; writes shots/<slug>.png and
   shots/<slug>.bench.jpg; merges the results into tools/report.json.
   =========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..");
const CONTROLS = path.join(DIR, "controls");
const SHOTS = path.join(DIR, "shots");
const REPORT = path.join(__dirname, "report.json");

let pw;
try { pw = require("playwright"); }
catch (e) {
  const cands = ["/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright", "/usr/local/lib/node_modules/playwright"];
  for (const c of cands) { try { pw = require(c); break; } catch (_) {} }
  if (!pw) { console.error("playwright not found (npm i -g playwright)"); process.exit(2); }
}

const args = process.argv.slice(2);
const ALL = args.includes("--all");
const NO_BENCH = args.includes("--no-bench");
const LIVE = args.includes("--live");
let slugs = args.filter(a => !a.startsWith("--")).map(s => s.replace(/\.html$/, "").replace(/^.*\//, ""));
if (ALL) slugs = fs.readdirSync(CONTROLS).filter(f => f.endsWith(".html")).map(f => f.slice(0, -5)).sort();
if (!slugs.length) { console.error("usage: snap.js <slug> | --all"); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true });

function loadReport() { try { return JSON.parse(fs.readFileSync(REPORT, "utf8")); } catch (_) { return {}; } }

(async () => {
  const launch = { headless: true };
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  const browser = await pw.chromium.launch(launch);
  const report = loadReport();
  let bad = 0;

  for (const slug of slugs) {
    const file = path.join(CONTROLS, slug + ".html");
    const r = { slug, at: new Date().toISOString(), errors: [], warnings: [], ok: true };
    if (!fs.existsSync(file)) { r.errors.push("file not found: " + file); r.ok = false; report[slug] = r; bad++; console.log(`✗ ${slug}: file not found`); continue; }

    // meta from source (so we can report even if the page fails to run)
    const src = fs.readFileSync(file, "utf8");
    const m = src.match(/<script[^>]*id=["']sk-meta["'][^>]*>([\s\S]*?)<\/script>/i);
    try { r.meta = m ? JSON.parse(m[1]) : null; if (!r.meta) r.errors.push("no #sk-meta block"); }
    catch (e) { r.errors.push("sk-meta is not valid JSON: " + e.message); }
    if (r.meta) {
      for (const k of ["id", "element", "name", "kind", "code", "type", "source", "value"]) if (!(k in r.meta)) r.errors.push("meta missing " + k);
      if (r.meta.id && r.meta.id !== slug) r.errors.push(`meta.id "${r.meta.id}" ≠ slug "${slug}"`);
      if (r.meta.element && !/^sk-[a-z0-9-]+$/.test(r.meta.element)) r.errors.push("meta.element must be sk-… lowercase");
    }
    if (!/id=["']sk-element["']/.test(src)) r.warnings.push("no <script id=\"sk-element\">");
    if (/<script[^>]+src=["'](?!\.\.\/stage\.js)/i.test(src)) r.errors.push("external script other than ../stage.js");
    if (/<img\b/i.test(src) || /url\(\s*["']?(?!data:)[a-z]+:\/\//i.test(src)) r.warnings.push("external image or url() reference");
    if (!src.includes("../stage.js")) r.errors.push("does not load ../stage.js");
    if (!src.includes("../stage.css")) r.warnings.push("does not load ../stage.css");

    const ctx = await browser.newContext({ viewport: { width: 360, height: 240 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const isNet = t => /Failed to load resource|net::ERR_|fonts\.g(oogleapis|static)\.com/.test(t);
    page.on("console", msg => { const t = msg.text(); if (msg.type() === "error" && !isNet(t)) r.errors.push("console: " + t); else if (msg.type() === "warning" || isNet(t)) r.warnings.push("console: " + t); });
    page.on("pageerror", err => r.errors.push("pageerror: " + err.message));
    const url = "file://" + file + "?embed" + (LIVE ? "" : "&still");
    try {
      await page.goto(url, { waitUntil: "load", timeout: 20000 });
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      await page.waitForTimeout(700);
      const info = await page.evaluate(() => {
        const meta = window.SK_META || {};
        const tag = meta.element;
        const defined = tag ? !!customElements.get(tag) : false;
        const el = tag ? document.querySelector(tag) : document.querySelector(".sk-stage [class]");
        const box = el ? el.getBoundingClientRect() : null;
        const fit = document.querySelector(".sk-fit");
        const fb = fit ? fit.getBoundingClientRect() : null;
        return { defined, hasEl: !!el, w: box ? Math.round(box.width) : 0, h: box ? Math.round(box.height) : 0, fitW: fb ? Math.round(fb.width) : 0, fitH: fb ? Math.round(fb.height) : 0, scale: fit && fit.style.transform || "" };
      });
      Object.assign(r, info);
      if (!info.defined) r.errors.push("custom element not defined");
      if (!info.hasEl) r.errors.push("element not found on the stage");
      if (info.hasEl && (info.w < 8 || info.h < 8)) r.errors.push(`element is ${info.w}×${info.h} px`);
      // keyboard probe for inputs
      const kind = r.meta && r.meta.kind;
      const vmodel = r.meta && r.meta.value && r.meta.value.model;
      if ((kind === "input" || kind === "both") && vmodel !== "momentary") {
        const before = await page.evaluate(() => { const el = document.querySelector(window.SK_META.element); el.focus(); return JSON.stringify(el.value); });
        const focused = await page.evaluate(() => { const el = document.querySelector(window.SK_META.element); let a = document.activeElement; if (a === el) return true; while (a && a.shadowRoot && a.shadowRoot.activeElement) { a = a.shadowRoot.activeElement; if (a === el) return true; } return !!(el.shadowRoot && el.shadowRoot.activeElement) || el.contains(document.activeElement); });
        if (!focused) r.warnings.push("element does not take focus via el.focus()");
        let moved = null;
        for (const key of ["ArrowUp", "ArrowRight", "Space", "Enter", "ArrowDown"]) {
          await page.keyboard.press(key);
          await page.waitForTimeout(60);
          const after = await page.evaluate(() => JSON.stringify(document.querySelector(window.SK_META.element).value));
          if (after !== before) { moved = key; break; }
        }
        r.keyboard = moved;
        if (!moved) r.warnings.push("keyboard did not change the value (tried arrows, Space, Enter)");
        // put it back for the screenshot
        await page.evaluate(v => { const el = document.querySelector(window.SK_META.element); try { el.value = JSON.parse(v); } catch (_) {} el.blur(); }, before);
        await page.waitForTimeout(150);
      }
      await page.screenshot({ path: path.join(SHOTS, slug + ".png"), type: "png" });
      await page.screenshot({ path: path.join(SHOTS, slug + ".jpg"), type: "jpeg", quality: 82 });   // the gallery thumbnail (committed; the png is not)
      if (!NO_BENCH) {
        const p2 = await ctx.newPage();
        await p2.setViewportSize({ width: 1000, height: 700 });
        p2.on("pageerror", err => r.errors.push("bench pageerror: " + err.message));
        p2.on("console", msg => { const t = msg.text(); if (msg.type() === "error" && !isNet(t)) r.errors.push("bench console: " + t); });
        await p2.goto("file://" + file + (LIVE ? "" : "?still"), { waitUntil: "load", timeout: 20000 });
        await p2.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
        await p2.waitForTimeout(500);
        await p2.screenshot({ path: path.join(SHOTS, slug + ".bench.jpg"), type: "jpeg", quality: 70, fullPage: true });
        await p2.close();
      }
    } catch (e) {
      r.errors.push("run: " + e.message);
    }
    await ctx.close();
    r.errors = [...new Set(r.errors)]; r.warnings = [...new Set(r.warnings)];
    r.ok = r.errors.length === 0;
    if (!r.ok) bad++;
    report[slug] = r;
    const tag = r.ok ? "✓" : "✗";
    console.log(`${tag} ${slug}  ${r.w || 0}×${r.h || 0}px  kb:${r.keyboard || "-"}${r.errors.length ? "\n    ERRORS: " + r.errors.join("\n            ") : ""}${r.warnings.length ? "\n    warn:   " + r.warnings.join("\n            ") : ""}`);
  }
  await browser.close();
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  console.log(`\n${slugs.length - bad}/${slugs.length} clean. shots in ${path.relative(process.cwd(), SHOTS)}/`);
  process.exit(bad ? 1 : 0);
})();

#!/usr/bin/env node
/* ===========================================================================
   CONTROLS — tools/catalog.js
   Parses the Phase 3 style entries (parts/p3-*.md, or PLAN-3-STYLES.md) into
   tools/catalog.json: one record per entry with slug, element, code, kind,
   value, priority, and the raw markdown block, so the build waves can be cut
   from it and the gallery can cross-check what was built against the plan.

     node art/zankyo/controls/tools/catalog.js            # writes tools/catalog.json, prints a summary
     node art/zankyo/controls/tools/catalog.js --built    # also marks entries that exist in controls/
   =========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const DIR = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "catalog.json");

let files = fs.existsSync(path.join(DIR, "parts")) ? fs.readdirSync(path.join(DIR, "parts")).filter(f => /^p3-.*\.md$/.test(f)).sort().map(f => path.join(DIR, "parts", f)) : [];
if (!files.length && fs.existsSync(path.join(DIR, "PLAN-3-STYLES.md"))) files = [path.join(DIR, "PLAN-3-STYLES.md")];
if (!files.length) { console.error("no parts/p3-*.md or PLAN-3-STYLES.md"); process.exit(2); }

const entries = [];
const problems = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let code = null, type = null, cur = null, lastKey = null;
  const flush = () => { if (cur) { cur.raw = cur.rawLines.join("\n").trim(); delete cur.rawLines; entries.push(cur); } cur = null; lastKey = null; };
  for (const line of lines) {
    let m;
    if ((m = line.match(/^##\s+([A-J]\d{1,2})\s*[·\-–—:]\s*(.+?)\s*$/))) { flush(); code = m[1]; type = m[2]; continue; }
    if ((m = line.match(/^###\s+([A-J]\d{1,2})[.\-](\d+)\s*[·\-–—:]\s*(.+?)\s*$/))) {
      flush();
      cur = { id: m[1] + "." + m[2], code: m[1], type, name: m[3].replace(/`/g, ""), file: path.basename(file), rawLines: [line], tells: [] };
      if (m[1] !== code) problems.push(`${path.basename(file)}: entry ${cur.id} under heading ${code}`);
      continue;
    }
    if (!cur) continue;
    cur.rawLines.push(line);
    if ((m = line.match(/^-\s+\*{0,2}([a-z][a-z ]{1,24}?)\*{0,2}\s*:\s*(.*)$/i))) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      let val = m[2].trim();
      if (/^[`'"].*[`'"]$/.test(val)) val = val.slice(1, -1);
      if (key === "the_tells" || key === "tells") { lastKey = "tells"; if (val) cur.tells.push(val); continue; }
      cur[key] = val.replace(/\s{2,}\(.*$/, "").trim();   // drop the trailing "(input | output | both)" style hints
      cur[key + "_full"] = val;
      lastKey = key;
      continue;
    }
    if ((m = line.match(/^\s+(\d+)[.)]\s+(.*)$/)) && lastKey === "tells") { cur.tells.push(m[2].trim()); continue; }
    if (/^\s{2,}\S/.test(line) && lastKey && lastKey !== "tells") { cur[lastKey] += " " + line.trim(); continue; }
  }
  flush();
}

// normalise
const seen = new Map();
for (const e of entries) {
  e.slug = (e.slug || "").replace(/[`\s]/g, "");
  e.element = (e.element || "").replace(/[`\s<>]/g, "");
  e.kind = (e.kind || "").split(/\s/)[0].toLowerCase();
  e.priority = (e.priority || "").trim().charAt(0).toUpperCase();
  if (!e.slug) problems.push(`${e.id} ${e.name}: no slug`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) problems.push(`${e.id}: bad slug "${e.slug}"`);
  if (!e.element) e.element = "sk-" + e.slug;
  if (!/^sk-[a-z0-9-]+$/.test(e.element)) problems.push(`${e.id}: bad element "${e.element}"`);
  if (!["input", "output", "both"].includes(e.kind)) problems.push(`${e.id}: kind "${e.kind}"`);
  if (!["A", "B", "C"].includes(e.priority)) problems.push(`${e.id}: priority "${e.priority}"`);
  if (seen.has(e.slug)) { problems.push(`duplicate slug ${e.slug}: ${seen.get(e.slug)} and ${e.id}`); }
  else seen.set(e.slug, e.id);
}
if (process.argv.includes("--built")) {
  for (const e of entries) e.built = fs.existsSync(path.join(DIR, "controls", e.slug + ".html"));
}
fs.writeFileSync(OUT, JSON.stringify(entries, null, 1));
const by = p => entries.filter(e => e.priority === p).length;
const codes = new Set(entries.map(e => e.code));
console.log(`${entries.length} entries across ${codes.size} codes from ${files.map(f => path.basename(f)).join(", ")}: A ${by("A")} · B ${by("B")} · C ${by("C")}`);
if (process.argv.includes("--built")) console.log(`built: ${entries.filter(e => e.built).length}`);
if (problems.length) { console.log("problems:"); problems.forEach(p => console.log("  " + p)); }

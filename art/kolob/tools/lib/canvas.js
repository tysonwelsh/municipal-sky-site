// KOLOB tools — a canvas that records instead of painting.
//
// The page draws on canvases (the staff, the wheel, the layers and the
// sprites it makes for itself, kolob-viz*.js); headless there is no canvas,
// so this one writes down every call made on a 2D context, a Path2D and a
// gradient, and every setting, in the order made, and folds them into one
// SHA-1 digest. Two builds of the page fed the same meeting draw the same
// page exactly when their digests agree: every stroke, every alpha, every
// sprite, every frame (the harness's staff=, tools/loadcheck.js). Numbers
// are written in full (no rounding: a refactor that moves a pixel's
// arithmetic by a bit is told). What the page reads back is answered the
// same way every time: a setting reads what was set (save and restore keep
// a stack, as a canvas does), measureText measures 7 px a character,
// getImageData is blank, and a canvas's box is the size it was made at.
"use strict";
const crypto = require("crypto");

const DEFAULTS = {
  fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1, globalCompositeOperation: "source-over",
  lineWidth: 1, lineCap: "butt", lineJoin: "miter", miterLimit: 10, lineDashOffset: 0,
  font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic", direction: "inherit",
  shadowBlur: 0, shadowColor: "rgba(0, 0, 0, 0)", shadowOffsetX: 0, shadowOffsetY: 0,
  imageSmoothingEnabled: true, imageSmoothingQuality: "low", filter: "none",
};

function recorder() {
  const hash = crypto.createHash("sha1");
  const rec = { calls: 0, canvases: 0, paths: 0 };
  let seq = 0;
  function fmt(v) {
    if (v && v.__rec) return v.__rec;
    if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
    if (typeof v === "string") return JSON.stringify(v);
    if (v == null || typeof v === "boolean") return String(v);
    if (typeof v === "function") return "fn";
    if (Array.isArray(v) || ArrayBuffer.isView(v)) return "[" + Array.prototype.map.call(v, fmt).join(",") + "]";
    return "{" + Object.keys(v).sort().map((k) => k + ":" + fmt(v[k])).join(",") + "}";
  }
  function log(who, what, args) { rec.calls++; hash.update(who + "." + what + "(" + Array.prototype.map.call(args, fmt).join(",") + ")\n"); }
  // a gradient: its stops written down
  function gradient(kind, args) {
    const g = { __rec: "G" + ++seq };
    log(g.__rec, kind, args);
    g.addColorStop = function () { log(g.__rec, "addColorStop", arguments); };
    return g;
  }
  // a path: everything drawn into it written down, under its own name
  function Path2D(from) {
    const id = "P" + ++seq;
    rec.paths++;
    log(id, "new", from == null ? [] : [from]);
    return new Proxy({ __rec: id }, {
      get(t, k) { return k in t || typeof k === "symbol" ? t[k] : function () { log(id, k, arguments); }; },
    });
  }
  function context(cv) {
    const id = cv.__rec + "/2d", stack = [];
    const state = Object.assign({}, DEFAULTS);
    const own = {
      canvas: cv,
      save() { log(id, "save", arguments); stack.push(Object.assign({}, state)); },
      restore() { log(id, "restore", arguments); if (stack.length) Object.assign(state, stack.pop()); },
      createLinearGradient() { return gradient(id + ".createLinearGradient", arguments); },
      createRadialGradient() { return gradient(id + ".createRadialGradient", arguments); },
      createConicGradient() { return gradient(id + ".createConicGradient", arguments); },
      createPattern() { return gradient(id + ".createPattern", arguments); },
      measureText(s) { log(id, "measureText", arguments); return { width: 7 * Array.from(String(s)).length, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 }; },
      getImageData(x, y, w, h) { log(id, "getImageData", arguments); return { width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) }; },
      isPointInPath() { log(id, "isPointInPath", arguments); return false; },
      getLineDash() { return []; },
    };
    return new Proxy(state, {
      get(t, k) {
        if (k in own) return own[k];
        if (typeof k === "symbol") return undefined;
        if (k in t) return t[k];
        return function () { log(id, k, arguments); };
      },
      set(t, k, v) { log(id, "=" + String(k), [v]); t[k] = v; return true; },
    });
  }
  // a canvas element, cssW × cssH in the page (0 × 0 for one the page makes for itself)
  function canvas(cssW, cssH) {
    const id = "C" + ++seq;
    rec.canvases++;
    let w = 300, h = 150, ctx = null;
    const el = {
      __rec: id, tagName: "CANVAS", style: {}, dataset: {},
      get width() { return w; }, set width(v) { w = +v; log(id, "=width", [v]); },
      get height() { return h; }, set height(v) { h = +v; log(id, "=height", [v]); },
      getContext(kind) { if (kind !== "2d") return null; return ctx || (ctx = context(el)); },
      getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: cssW || 0, height: cssH || 0, right: cssW || 0, bottom: cssH || 0 }; },
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
      toDataURL() { return "data:,"; },
    };
    return el;
  }
  rec.canvas = canvas;
  rec.Path2D = Path2D;
  rec.log = log;
  rec.digest = () => hash.copy().digest("hex");
  return rec;
}

module.exports = { recorder };

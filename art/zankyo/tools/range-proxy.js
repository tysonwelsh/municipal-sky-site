// ============================================================================
// ZANKYŌ — a Range-capable front for the PHP dev server (dev tool only).
//
// WHY THIS EXISTS. `php -S` answers every request with a 200 and the whole
// file; it has no Range support. Chrome will not seek a media element into a
// resource that cannot be fetched by range until the bytes happen to be
// buffered — the seek lands at 0 — so on the dev server every reception
// played its reel FROM THE TOP, whatever window the receiver chose, and every
// real-playback measurement of seeks, relocks and 走 swaps taken through it
// measured the dev server. Production (Bluehost, Apache behind nginx) answers
// 206 with `accept-ranges: bytes`, measured 2026-09-24.
//
// So: static files are served from the worktree here, with Range, the way
// production serves them; everything else (the .php pages) is passed through
// to the PHP server untouched.
//
//   node tools/range-proxy.js [listenPort=8063] [phpPort=8061]
// ============================================================================
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const LISTEN = parseInt(process.argv[2] || "8063", 10);
const UP = parseInt(process.argv[3] || "8061", 10);
const ROOT = path.resolve(__dirname, "..", "..", "..");
const TYPES = { ".mp4": "video/mp4", ".json": "application/json", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".wav": "audio/wav", ".txt": "text/plain", ".ico": "image/x-icon", ".webp": "image/webp" };

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const rel = decodeURIComponent(u.pathname);
  const file = path.join(ROOT, rel);
  const ext = path.extname(file).toLowerCase();
  if (file.startsWith(ROOT) && TYPES[ext] && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const size = fs.statSync(file).size;
    // production's own caching headers (measured): a reel is immutable for a
    // year, so a browser that has fetched it once answers a later range from
    // its cache — which is what a 走 swap onto a warmed reel relies on.
    const st = fs.statSync(file);
    const h = { "content-type": TYPES[ext], "accept-ranges": "bytes", "last-modified": st.mtime.toUTCString(),
      "cache-control": ext === ".mp4" ? "public, max-age=31536000, immutable" : "no-cache" };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m) {
      let a = m[1] === "" ? size - parseInt(m[2], 10) : parseInt(m[1], 10);
      let b = m[1] === "" || m[2] === "" ? size - 1 : Math.min(size - 1, parseInt(m[2], 10));
      if (!(a >= 0 && a <= b)) { res.writeHead(416, { "content-range": "bytes */" + size }); return res.end(); }
      res.writeHead(206, Object.assign(h, { "content-range": "bytes " + a + "-" + b + "/" + size, "content-length": b - a + 1 }));
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, Object.assign(h, { "content-length": size }));
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(file).pipe(res);
  }
  const p = http.request({ host: "127.0.0.1", port: UP, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}).listen(LISTEN, "127.0.0.1", () => process.stderr.write("[range-proxy] :" + LISTEN + " → static from " + ROOT + ", php from :" + UP + "\n"));

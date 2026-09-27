// KOLOB tools — audio measurement: WAV in and out, loudness (ITU-R BS.1770-4 /
// EBU R128: integrated, momentary, short-term, LRA), sample and true peak,
// and a log-frequency spectrogram matrix. Plain Node, no packages.
"use strict";
const fs = require("fs");

// ---------------------------------------------------------------------------
// WAV
// ---------------------------------------------------------------------------
function writeWav16(file, L, R, sr) {
  const n = L.length, ch = R ? 2 : 1, bytes = n * ch * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + bytes, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(bytes, 40);
  let o = 44, clipped = 0;
  const put = (x) => { let v = Math.round(x * 32767); if (v > 32767) { v = 32767; clipped++; } else if (v < -32768) { v = -32768; clipped++; } buf.writeInt16LE(v, o); o += 2; };
  for (let i = 0; i < n; i++) { put(L[i]); if (R) put(R[i]); }
  fs.writeFileSync(file, buf);
  return { clipped };
}
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV: " + file);
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === "data") data = { off: o + 8, len: sz };
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error("WAV without fmt/data: " + file);
  const bps = fmt.bits / 8, n = Math.floor(data.len / (bps * fmt.ch));
  const chans = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) {
    const p = data.off + (i * fmt.ch + c) * bps;
    chans[c][i] = fmt.tag === 3 ? b.readFloatLE(p) : fmt.bits === 16 ? b.readInt16LE(p) / 32768 : fmt.bits === 24 ? (b.readIntLE(p, 3) / 8388608) : b.readInt32LE(p) / 2147483648;
  }
  return { sr: fmt.sr, chans };
}

// ---------------------------------------------------------------------------
// Loudness — K-weighting (the two BS.1770 stages, derived for any rate as in
// libebur128), then 100 ms segment energies: a 400 ms momentary block is four
// segments, a 3 s short-term block thirty.
// ---------------------------------------------------------------------------
function kCoefs(sr) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K / Q + K * K;
  const s1 = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr);
  const d = 1 + K / Q + K * K;
  const s2 = { b: [1, -2, 1], a: [2 * (K * K - 1) / d, (1 - K / Q + K * K) / d] };
  return [s1, s2];
}
function segmentEnergies(x, sr, segS) {
  const [s1, s2] = kCoefs(sr);
  const seg = Math.round(sr * segS), nSeg = Math.floor(x.length / seg), out = new Float64Array(nSeg);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, w1 = 0, w2 = 0;
  for (let k = 0; k < nSeg; k++) {
    let acc = 0;
    for (let i = k * seg, e = i + seg; i < e; i++) {
      const xi = x[i];
      const y = s1.b[0] * xi + s1.b[1] * x1 + s1.b[2] * x2 - s1.a[0] * y1 - s1.a[1] * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = y;
      const w = y - 2 * z1 + z2 - s2.a[0] * w1 - s2.a[1] * w2;
      z2 = z1; z1 = y; w2 = w1; w1 = w;
      acc += w * w;
    }
    out[k] = acc / seg;
  }
  return out;
}
const LUFS = (e) => (e > 0 ? -0.691 + 10 * Math.log10(e) : -Infinity);
function loudness(chans, sr) {
  const segS = 0.1;
  const E = chans.map((c) => segmentEnergies(c, sr, segS));
  const n = E[0].length, seg = new Float64Array(n);
  for (let k = 0; k < n; k++) for (let c = 0; c < E.length; c++) seg[k] += E[c][k];   // G = 1 for L and R
  const block = (len) => { const out = []; for (let k = 0; k + len <= n; k++) { let s = 0; for (let j = 0; j < len; j++) s += seg[k + j]; out.push(s / len); } return out; };
  const mom = block(4), st = block(30);
  // integrated: absolute gate −70 LUFS, then relative gate −10 LU
  const absM = mom.filter((e) => LUFS(e) > -70);
  let integrated = -Infinity;
  if (absM.length) {
    const rel = LUFS(absM.reduce((a, b) => a + b, 0) / absM.length) - 10;
    const g = absM.filter((e) => LUFS(e) > rel);
    if (g.length) integrated = LUFS(g.reduce((a, b) => a + b, 0) / g.length);
  }
  // loudness range (EBU Tech 3342): short-term, gates −70 LUFS and −20 LU, p95 − p10
  let lra = null;
  const absS = st.filter((e) => LUFS(e) > -70);
  if (absS.length > 1) {
    const rel = LUFS(absS.reduce((a, b) => a + b, 0) / absS.length) - 20;
    const v = absS.filter((e) => LUFS(e) > rel).map(LUFS).sort((a, b) => a - b);
    if (v.length > 1) lra = v[Math.round(0.95 * (v.length - 1))] - v[Math.round(0.10 * (v.length - 1))];
  }
  return {
    integrated, lra,
    momentaryMax: Math.max(...mom.map(LUFS)), shortTermMax: Math.max(...st.map(LUFS)),
    // curves, time = the block's END (as a meter shows it), in seconds from the start
    momentary: mom.map((e, k) => ({ t: (k + 4) * segS, lufs: LUFS(e) })),
    shortTerm: st.map((e, k) => ({ t: (k + 30) * segS, lufs: LUFS(e) })),
  };
}

// ---------------------------------------------------------------------------
// Peaks — the sample peak, and the true peak estimated by 4× polyphase
// windowed-sinc interpolation around every sample within 6 dB of the peak.
// ---------------------------------------------------------------------------
function peaks(chans) {
  let sp = 0;
  chans.forEach((c) => { for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > sp) sp = v; } });
  const TAPS = 32, PH = 4, h = [];
  for (let p = 1; p < PH; p++) {
    const row = [];
    for (let k = -TAPS / 2 + 1; k <= TAPS / 2; k++) {
      const x = k - p / PH, w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS / 2 + 1));
      row.push({ k, c: (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w });
    }
    h.push(row);
  }
  let tp = sp;
  const th = sp * 0.5;
  chans.forEach((c) => {
    for (let i = 0; i < c.length; i++) {
      if (Math.abs(c[i]) < th) continue;
      for (let s = i - 1; s <= i; s++) for (const row of h) {
        let acc = 0;
        for (const { k, c: w } of row) { const j = s + k; if (j >= 0 && j < c.length) acc += c[j] * w; }
        if (Math.abs(acc) > tp) tp = Math.abs(acc);
      }
    }
  });
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
  return { sample: sp, samplePeakDb: db(sp), truePeakDb: db(tp) };
}

// ---------------------------------------------------------------------------
// FFT (radix 2, in place) and the spectrogram
// ---------------------------------------------------------------------------
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, ai = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j + len / 2] = re[i + j] - ar; im[i + j + len / 2] = im[i + j] - ai;
        re[i + j] += ar; im[i + j] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// A width×height matrix of dB values (row 0 = the top = the highest frequency),
// log-spaced from fmin to fmax, one FFT frame per column.
function spectrogram(x, sr, opts) {
  const nfft = opts.nfft || 8192, W = opts.width, H = opts.height;
  const fmin = opts.fmin || 30, fmax = Math.min(opts.fmax || 16000, sr / 2 * 0.98);
  const win = new Float64Array(nfft);
  let wsum = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (nfft - 1)); wsum += win[i]; }
  const norm = 2 / wsum, binHz = sr / nfft;
  const rowF = [];
  for (let y = 0; y <= H; y++) rowF.push(fmin * Math.pow(fmax / fmin, (H - y) / H));   // edges, top first
  const out = new Float32Array(W * H);
  const re = new Float64Array(nfft), im = new Float64Array(nfft), pw = new Float64Array(nfft / 2);
  for (let col = 0; col < W; col++) {
    const center = Math.round((col + 0.5) * x.length / W), start = center - nfft / 2;
    for (let i = 0; i < nfft; i++) { const j = start + i; re[i] = (j >= 0 && j < x.length ? x[j] : 0) * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    for (let k = 0; k < nfft / 2; k++) { const a = re[k] * norm, b = im[k] * norm; pw[k] = a * a + b * b; }
    for (let y = 0; y < H; y++) {
      const fHi = rowF[y], fLo = rowF[y + 1], kLo = fLo / binHz, kHi = fHi / binHz;
      let p;
      if (Math.floor(kHi) - Math.ceil(kLo) >= 1) { p = 0; for (let k = Math.ceil(kLo); k <= Math.floor(kHi); k++) if (pw[k] > p) p = pw[k]; }
      else { const kc = Math.sqrt(kLo * kHi), k0 = Math.floor(kc), fr = kc - k0; p = pw[k0] * (1 - fr) + pw[Math.min(k0 + 1, nfft / 2 - 1)] * fr; }
      out[y * W + col] = 10 * Math.log10(p + 1e-20);
    }
  }
  return { db: out, width: W, height: H, fmin, fmax };
}

module.exports = { writeWav16, readWav, kCoefs, loudness, peaks, spectrogram, fftInPlace, LUFS };

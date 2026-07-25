// ============================================================================
// TUNE LAB — audition bench for KOLOB's OLD_TUNES pool (the half-remembered
// quotations). UNLINKED dev tool, like the bagpipe lab.
//
// The tune DATA is read live from KolobAudio.getOldTunes() — the pool lives in
// kolob-audio.js and only there, so a correction after an ear pass propagates
// here automatically. What this file mirrors is only the RENDERING vocabulary:
//   · PLAIN — close, clean, center, steady beat: the transcription-check
//     voice. If a tune sounds wrong here, the degree data is wrong.
//   · REMEMBERED — the production farVoice treatment: distance lowpass, +8¢,
//     field-edge pan, low gain, and the seeded wear (one interior note
//     dropped or one duration held long; never the first two notes).
// Mode/tonic/beat are audition context; the engine supplies its own at runtime.
//
// Public surface: window.TuneLab
// ============================================================================
window.TuneLab = (function () {
  "use strict";

  // ---- tuning, mirrored from kolob-audio.js -------------------------------
  var COLLECTIONS = {
    ionian:     { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8], map: [0,1,2,3,4,5,6] },
    mixolydian: { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9], map: [0,1,2,3,4,5,6] },
    dorian:     { ratios: [1, 9/8, 6/5, 4/3, 3/2, 5/3, 16/9], map: [0,1,2,3,4,5,6] },
    aeolian:    { ratios: [1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9], map: [0,1,2,3,4,5,6] },
    penta:      { ratios: [1, 9/8, 5/4, 3/2, 5/3],            map: [0,1,2,2,3,4,4] },
    hexa:       { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3],       map: [0,1,2,3,4,5,5] },
  };
  var ROOT_MULT = 4;
  var f0 = 65, mode = "ionian", beat = 1.2;

  function projDeg(d7) {
    var col = COLLECTIONS[mode], n = col.ratios.length;
    var oct = Math.floor(d7 / 7);
    var d = ((d7 % 7) + 7) % 7;
    return col.map[d] + oct * n;
  }
  function degFreq(i) {
    var n = COLLECTIONS[mode].ratios.length;
    var oct = Math.floor(i / n);
    var d = ((i % n) + n) % n;
    return f0 * ROOT_MULT * COLLECTIONS[mode].ratios[d] * Math.pow(2, oct);
  }

  // the engine's mode law, restated for the verdict column
  function fitsMode(tn) {
    if (mode === "aeolian" || mode === "dorian") {
      return tn.minor ? { ok: true, why: "the house hymn — dark Sundays are its own" }
                      : { ok: false, why: "major memory; skipped on dark Sundays" };
    }
    if (tn.minor) return { ok: false, why: "minor tune; surfaces only on aeolian/dorian Sundays" };
    if (mode === "penta" || mode === "hexa") {
      for (var i = 0; i < tn.notes.length; i++) {
        var cls = ((tn.notes[i][0] % 7) + 7) % 7;
        if (cls === 6 || (mode === "penta" && cls === 3)) {
          return { ok: false, why: "incipit folds badly in " + mode + " (degree " + (cls + 1) + ")" };
        }
      }
    }
    return { ok: true, why: "quotable" };
  }

  // ---- audio ----------------------------------------------------------------
  var ctx = null, master = null;
  var live = [];                                   // stoppable node registry
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.setValueAtTime(0.9, ctx.currentTime);
    master.connect(ctx.destination);
  }
  function stopAll() {
    for (var i = 0; i < live.length; i++) { try { live[i].stop(); } catch (e) {} }
    live = [];
  }

  // one voice, both treatments — the remembered path mirrors farVoice
  function renderLine(notes, opts) {
    ensureCtx();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    stopAll();
    var t = ctx.currentTime + 0.12;
    var o = ctx.createOscillator(); o.type = "triangle";
    var o2 = ctx.createOscillator(); o2.type = "sine";
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.1, t);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(opts.far ? 1200 : 4200, t);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);       // the line swell
    var artic = ctx.createGain(); artic.gain.setValueAtTime(0.0001, t); // per-note gate
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(artic);
    if (pan) {
      pan.pan.setValueAtTime(opts.far ? (Math.random() < 0.5 ? -0.85 : 0.85) : 0, t);
      artic.connect(pan); pan.connect(master);
    } else artic.connect(master);

    var det = opts.far ? Math.pow(2, 8 / 1200) : 1;  // the +8¢ of memory
    var peak = opts.far ? 0.14 : 0.3;

    // Articulation: every note gets its own quick attack and a short gap
    // before the next, so a run of same-pitch notes reads as separate strikes
    // instead of one held tone. The gap is a near-silence in the PLAIN
    // transcription voice (so repeats are unmistakable) and a gentler dip in
    // the REMEMBERED voice, which keeps its worn legato glide between pitches.
    // PLAIN also steps discretely between pitches (no portamento) so each
    // degree is heard cleanly; REMEMBERED keeps the farVoice glide — pinning
    // BOTH oscillators to the previous pitch at the boundary, then ramping, so
    // no note chirps back toward the opening pitch.
    var floor = opts.far ? 0.22 : 0.0008;  // between-note level
    var atkBase = 0.014;
    var tt = t, prevF = 0;
    for (var i = 0; i < notes.length; i++) {
      var f = degFreq(projDeg(notes[i].deg)) * det;
      var d = notes[i].dur;

      // pitch: discrete step (plain) or pinned glide (remembered)
      if (opts.far && i > 0) {
        var port = Math.min(0.15, d * 0.2);
        o.frequency.setValueAtTime(prevF, tt);
        o.frequency.linearRampToValueAtTime(f, tt + port);
        o2.frequency.setValueAtTime(prevF * 2, tt);
        o2.frequency.linearRampToValueAtTime(f * 2, tt + port);
      } else {
        o.frequency.setValueAtTime(f, tt);
        o2.frequency.setValueAtTime(f * 2, tt);
      }

      // per-note amplitude gate: attack, hold, then a gap before the next note
      var gap = Math.min(opts.far ? 0.05 : 0.1, d * 0.35);
      gap = Math.max(0.02, Math.min(gap, d - atkBase - 0.02));  // leave room for attack
      var atk = Math.min(atkBase, d * 0.25);
      artic.gain.setValueAtTime(floor, tt);
      artic.gain.linearRampToValueAtTime(1, tt + atk);
      artic.gain.setValueAtTime(1, tt + d - gap);
      artic.gain.linearRampToValueAtTime(floor, tt + d);

      prevF = f;
      tt += d;
    }
    var total = tt - t;

    // the line swell: crisp for the plain check, slow and worn for remembered
    var swellIn = opts.far ? 0.9 : 0.1;
    var swellLead = opts.far ? 1.2 : 0.12;
    var tail = opts.far ? 1.4 : 0.18;
    g.gain.linearRampToValueAtTime(peak, t + swellIn);
    g.gain.setValueAtTime(peak, t + Math.max(swellIn, total - swellLead));
    g.gain.linearRampToValueAtTime(0.0001, t + total + tail);
    o.start(t); o.stop(t + total + tail + 0.2);
    o2.start(t); o2.stop(t + total + tail + 0.2);
    live.push(o, o2);
    return total;
  }

  function tuneNotes(tn, worn) {
    var notes = tn.notes.map(function (n) { return { deg: n[0], dur: n[1] * beat }; });
    if (!worn) return notes;
    // the wear, mirrored from oldTuneRemembered: never the first two notes
    if (notes.length > 4 && Math.random() < 0.5) {
      var di = 2 + Math.floor(Math.random() * (notes.length - 3));
      notes[di - 1].dur += notes[di].dur;           // predecessor held wrong
      notes.splice(di, 1);
    }
    if (Math.random() < 0.4) {
      var ai = 2 + Math.floor(Math.random() * (notes.length - 2));
      if (notes[ai]) notes[ai].dur *= 1.6;
    }
    return notes;
  }

  // ---- UI -------------------------------------------------------------------
  var HYMN_NAMES = {
    "all is well": "Come, Come, Ye Saints (⚠ verify by ear)",
    "kingsfold": "If You Could Hie to Kolob",
    "bethany": "Nearer, My God, to Thee",
    "foundation": "How Firm a Foundation",
    "nettleton": "Come, Thou Fount",
    "sweet hour": "Sweet Hour of Prayer (⚠ verify by ear)",
    "god be with you": "God Be with You Till We Meet Again",
  };

  function render() {
    var K = window.KolobAudio;
    var host = document.getElementById("otl-tunes");
    if (!host) return;
    if (!K || !K.getOldTunes) { host.innerHTML = "<p>KolobAudio.getOldTunes() missing — load kolob-audio.js first.</p>"; return; }
    var tunes = K.getOldTunes();
    host.innerHTML = "";
    tunes.forEach(function (tn) {
      var verdict = fitsMode(tn);
      var row = document.createElement("div");
      row.className = "otl-row" + (verdict.ok ? "" : " otl-row-out");
      row.innerHTML =
        '<div class="otl-names"><span class="otl-tune">' + tn.name + '</span>' +
        '<span class="otl-hymn">' + (HYMN_NAMES[tn.name] || "") + '</span></div>' +
        '<span class="otl-meta">w ' + tn.w + (tn.minor ? " · minor-only" : "") + ' · ' + tn.notes.length + ' notes</span>' +
        '<span class="otl-verdict ' + (verdict.ok ? "ok" : "out") + '">' + verdict.why + '</span>' +
        '<span class="otl-btns">' +
        '<button type="button" data-plain="' + tn.name + '">plain</button>' +
        '<button type="button" data-far="' + tn.name + '">remembered</button>' +
        '</span>';
      host.appendChild(row);
    });
    host.querySelectorAll("[data-plain]").forEach(function (b) {
      b.addEventListener("click", function () {
        var tn = tunes.find(function (x) { return x.name === b.getAttribute("data-plain"); });
        renderLine(tuneNotes(tn, false), { far: false });
      });
    });
    host.querySelectorAll("[data-far]").forEach(function (b) {
      b.addEventListener("click", function () {
        var tn = tunes.find(function (x) { return x.name === b.getAttribute("data-far"); });
        renderLine(tuneNotes(tn, document.getElementById("otl-wear").checked), { far: true });
      });
    });
  }

  function init() {
    var modeSel = document.getElementById("otl-mode");
    var f0El = document.getElementById("otl-f0");
    var beatEl = document.getElementById("otl-beat");
    if (modeSel) modeSel.addEventListener("change", function () { mode = modeSel.value; render(); });
    if (f0El) f0El.addEventListener("input", function () {
      f0 = parseFloat(f0El.value);
      document.getElementById("otl-f0-out").textContent = f0.toFixed(0) + " Hz";
    });
    if (beatEl) beatEl.addEventListener("input", function () {
      beat = parseFloat(beatEl.value);
      document.getElementById("otl-beat-out").textContent = beat.toFixed(2) + " s";
    });
    var stopBtn = document.getElementById("otl-stop");
    if (stopBtn) stopBtn.addEventListener("click", stopAll);
    render();
  }

  return { init: init };
})();
document.addEventListener("DOMContentLoaded", function () { window.TuneLab.init(); });

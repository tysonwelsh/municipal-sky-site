// ============================================================================
// KOLOB — kolob-melody.js: meters, prosody and the motif engine
//
// The hymn meters and the prosody that pours phrases into them; the motif
// engine — the gesture pool (each with its Deseret cipher), the transform
// algebra, genealogy and the ledger. Split from kolob-audio.js (v0.30); see
// the room list in kolob-core.js.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block at the foot of this file); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ---- BORROWED — the other rooms' functions, bound late through S (every
  // room is loaded before the first note, so the call always finds its owner) ----
  // from kolob-meeting.js
  function localArc() { return S.localArc(); }
  // from kolob-core.js
  function rng() { return S.rng(); }
  function rnd(a, b) { return S.rnd(a, b); }
  function rint(a, b) { return S.rint(a, b); }
  function chance(p) { return S.chance(p); }
  function pick(arr) { return S.pick(arr); }
  function pickW(pool) { return S.pickW(pool); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  // (the other rooms' state, read and written through S: S.ctx, S.C,
  // S.seasonPos)

  // ==========================================================================
  // PROSODY — hymn meters. A verse is lines of counted syllables; the melody
  // is POURED into the line; the last syllable is a fermata on a rest tone.
  // ==========================================================================
  var METERS = {
    "CM":    [8, 6, 8, 6],              // Common Meter
    "LM":    [8, 8, 8, 8],              // Long Meter
    "SM":    [6, 6, 8, 6],              // Short Meter
    "87.87": [8, 7, 8, 7],
    "CMD":   [8, 6, 8, 6, 8, 6, 8, 6],  // doubled — conference and jubilee verses
  };
  var Prosody = (function () {
    function nearestRest7(d) {
      var REST7 = { 0: true, 2: true, 4: true };
      var dd = ((d % 7) + 7) % 7;
      if (REST7[dd]) return d;
      for (var off = 1; off <= 3; off++) {
        if (REST7[(((d + off) % 7) + 7) % 7]) return d + off;
        if (REST7[(((d - off) % 7) + 7) % 7]) return d - off;
      }
      return d;
    }
    // Fit a motif to exactly n syllable-notes (7-degree space).
    function pourIntoLine(motif, n) {
      var src = motif.notes.map(function (x) { return { deg: x.deg, durBeats: x.durBeats }; });
      var out;
      if (src.length === n) out = src;
      else if (src.length > n) {
        // elide the shortest interior notes — keep the head and the goal
        out = src.slice();
        while (out.length > n) {
          var kill = -1, min = 1e9;
          for (var i = 1; i < out.length - 1; i++) if (out[i].durBeats < min) { min = out[i].durBeats; kill = i; }
          if (kill < 0) break;
          out.splice(kill, 1);
        }
      } else {
        // extend by stepwise sequence toward the line's rest tone
        out = src.slice();
        var goal = nearestRest7(out[out.length - 1].deg);
        while (out.length < n) {
          var lastD = out[out.length - 1].deg;
          var step = goal === lastD ? pick([-1, 1]) : (goal > lastD ? 1 : -1);
          if (chance(0.2)) step *= -1;                           // a wayward syllable
          out.push({ deg: lastD + step, durBeats: pickW([[1, 5], [1.5, 2], [0.5, 2]]) });
        }
      }
      // the fermata: last syllable lands on a rest tone and holds
      var tail = out[out.length - 1];
      tail.deg = nearestRest7(tail.deg);
      // the fermata breathes but never stalls: an augmented final note times a
      // big multiplier was producing 20-beat holds. Absolute cap at 5 beats.
      tail.durBeats = Math.min(5, Math.max(2.2, tail.durBeats * rnd(1.4, 2)));
      tail.fermata = true;
      return out;
    }
    return { pourIntoLine: pourIntoLine, nearestRest7: nearestRest7 };
  })();

  // ==========================================================================
  // MOTIF ENGINE — gestures, transform algebra, genealogy, ledger.
  // ==========================================================================
  // Motifs live in 7-DEGREE space ({deg, durBeats}) and are projected into
  // the meeting's collection only at render time — one gesture pool serves
  // every mode. Identity + genealogy: { name, gen, chain[] }.
  var Motif = (function () {
    // The working motifs are numbered, not lettered: Ⅰ is the day's theme,
    // Ⅱ and Ⅲ the subsidiary ideas. Roman numerals read in both scripts
    // (numerals stay Latin by the app's own rule) and leave the WHOLE
    // alphabet free for the gesture ciphers below.
    var NAMES = ["Ⅰ", "Ⅱ", "Ⅲ"];
    // THE GESTURE POOL — cultural DNA, abstracted from the tradition's
    // rhetoric, never quoted. Nearly thirty gestures; each meeting draws only
    // three, so most sessions never hear most of them. That is the diversity:
    // no two visits work the same material.
    // Every gesture carries a PERMANENT Deseret letter (its cipher on the hymn
    // board): the alphabet in order from 𐐀, twenty-seven letters for
    // twenty-seven shapes. The letters are stable across meetings, so a
    // returning listener can learn that a given letter is a given tune-shape.
    // (The working motifs are Roman-numbered Ⅰ/Ⅱ/Ⅲ, so no collision.)
    var GESTURES = [
      { letter: "𐐀", name: "gathering",   notes: [[-3, 1], [0, 2], [1, 1], [0, 3]] },                            // the rising-fourth call
      { letter: "𐐁", name: "kolob arch",  notes: [[0, 1], [2, 1], [4, 1], [5, 2], [4, 1], [2, 1], [0, 3]] },     // arch litany, KINGSFOLD-shaped
      { letter: "𐐂", name: "amen",        notes: [[3, 2], [2, 1], [0, 4]] },                                     // the plagal fall
      { letter: "𐐃", name: "revival",     notes: [[0, 1], [2, 1], [4, 1], [7, 3]] },                             // gapped camp-meeting ascent
      { letter: "𐐄", name: "sweet hour",  notes: [[4, 2], [3, 1], [2, 1], [1, 1], [0, 3]] },                     // stepwise evening descent
      { letter: "𐐅", name: "fuging",      notes: [[0, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 2]] },         // the imitative subject
      { letter: "𐐆", name: "handcart",    notes: [[0, 1], [1, 1], [2, 2], [1, 1], [0, 1], [-1, 1], [0, 3]] },    // walking, patient
      { letter: "𐐇", name: "wayfarer",    notes: [[5, 1], [4, 1], [2, 2], [3, 1], [1, 1], [0, 3]] },             // the lonesome stranger
      { letter: "𐐈", name: "sego lily",   notes: [[2, 1], [4, 0.5], [2, 0.5], [1, 1], [2, 1], [0, 2]] },         // a light gapped lilt
      { letter: "𐐉", name: "bells of Zion", notes: [[6, 1], [4, 1], [5, 1], [3, 1], [4, 1], [2, 1], [0, 2]] },   // falling thirds, pealing
      { letter: "𐐊", name: "morning star", notes: [[0, 1], [5, 2], [4, 1], [3, 1], [4, 3]] },                    // the upward sixth, held
      { letter: "𐐋", name: "still small", notes: [[1, 2], [0, 1], [1, 1], [2, 2], [1, 1], [0, 3]] },             // a narrow murmur
      { letter: "𐐌", name: "cumorah",     notes: [[7, 2], [4, 1], [2, 1], [0, 3]] },                             // the falling-octave call
      { letter: "𐐍", name: "beehive",     notes: [[2, 1], [2, 1], [2, 0.5], [3, 0.5], [2, 1], [0, 3]] },         // repeated-note industry
      { letter: "𐐎", name: "ensign peak", notes: [[0, 1], [4, 1], [7, 2], [5, 1], [4, 3]] },                     // the wide climb, held high
      { letter: "𐐏", name: "lullaby",     notes: [[0, 2], [-2, 1], [0, 1], [-1, 2], [0, 3]] },                   // low rocking, evening
      { letter: "𐐐", name: "sego road",   notes: [[0, 1.5], [1, 0.5], [3, 1.5], [2, 0.5], [1, 1], [0, 3]] },     // dotted walking figure
      { letter: "𐐑", name: "seagull",     notes: [[4, 1], [6, 1], [4, 1], [2, 2], [4, 1], [0, 3]] },            // a wheeling gull, the miracle
      { letter: "𐐒", name: "north star",  notes: [[0, 1], [7, 3], [6, 1], [4, 2]] },                            // a bold leap of a seventh, held
      { letter: "𐐓", name: "far water",   notes: [[2, 3], [1, 1], [2, 1], [0, 4]] },                            // long tones over great spaces
      { letter: "𐐔", name: "quail",       notes: [[4, 0.5], [3, 0.5], [4, 0.5], [2, 0.5], [0, 2]] },            // a quick clipped call
      { letter: "𐐕", name: "meridian",    notes: [[0, 1], [2, 1], [4, 1], [6, 1], [7, 2], [5, 1], [4, 3]] },    // the long ascent to the octave
      { letter: "𐐖", name: "the ferry",   notes: [[0, 2], [1, 1], [0, 1], [-2, 2], [0, 3]] },                   // rocking across, dipping under
      { letter: "𐐗", name: "sunstone",    notes: [[0, 1], [3, 1], [2, 1], [5, 1], [4, 1], [7, 2], [0, 3]] },    // a climbing zigzag, then home
      { letter: "𐐘", name: "watchfire",   notes: [[0, 1], [1, 2], [0, 1], [2, 2], [0, 1], [3, 3]] },            // patient tending, slowly rising
      { letter: "𐐙", name: "saltflat",    notes: [[4, 4], [4, 1], [3, 1], [2, 4]] },                            // very still, barely moving
      { letter: "𐐚", name: "cottonwood",  notes: [[0, 2], [2, 1], [1, 1], [3, 2], [2, 1], [0, 3]] },            // a gentle sway in the wind
    ];
    var GESTURE_LETTER = {};
    for (var gl = 0; gl < GESTURES.length; gl++) GESTURE_LETTER[GESTURES[gl].name] = GESTURES[gl].letter;
    var working = { theme: null, subs: [] };      // the whole meeting works ≤3 ideas
    var ledger = [];                              // [{from, to, motif, deadline, type}]
    var stats = { developments: 0, answers: 0, transformsUsed: {}, gestures: [] };

    // THE DAY'S TEMPER — a seeded dialect chosen per meeting that tilts HOW all
    // the voices develop their material (not WHAT they play — the gestures are
    // still drawn at random). One Sunday runs plain and psalmodic; another runs
    // florid, or restless, or opens everything out into great expansive leaps.
    // A meeting-level colour, layered over the per-voice and per-section tilts,
    // so no two visits merely feel different moment to moment — they feel like
    // different Sundays. Still fully aleatoric: it is only another bias.
    var DIALECTS = {
      plain:     { ornament: 0.35, mordent: 0.3, sequence: 0.7, syncopate: 0.5, intervalExpand: 0.7 },
      psalmodic: { intervalCompress: 1.9, augment: 1.4, ornament: 0.5, mordent: 0.4, rotate: 1.3 },
      florid:    { ornament: 2.1, mordent: 2.3, sequence: 1.5, syncopate: 1.4 },
      expansive: { augment: 1.9, intervalExpand: 2.1, transpose: 1.4, diminish: 0.5, intervalCompress: 0.4 },
      terse:     { diminish: 1.9, fragmentHead: 1.8, fragmentTail: 1.6, intervalCompress: 1.6, augment: 0.5 },
      restless:  { sequence: 1.8, rotate: 2.0, syncopate: 1.9, retrograde: 1.5, invert: 1.4 },
    };
    var meetingDialect = null, dialectName = "plain";

    function clone(m) { return JSON.parse(JSON.stringify(m)); }
    function fromGesture(g, name) {
      return {
        name: name, gesture: g.name, gen: 0, chain: [],
        notes: g.notes.map(function (n) { return { deg: n[0], durBeats: n[1] }; }),
      };
    }

    // ---- the transform algebra (each returns a NEW motif, chain appended) ----
    var TRANSFORMS = {
      invert: function (m) {
        var axis = m.notes[0].deg;
        m.notes.forEach(function (n) { n.deg = axis - (n.deg - axis); });
        return m;
      },
      transpose: function (m) {
        var by = pickW([[1, 3], [2, 3], [-1, 3], [-2, 2], [3, 1], [4, 1], [-4, 1]]);
        m.notes.forEach(function (n) { n.deg += by; });
        return m;
      },
      fragmentHead: function (m) {
        m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2)));
        return m;
      },
      fragmentTail: function (m) {
        m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2)));
        return m;
      },
      augment: function (m) {
        var f = rnd(1.35, 1.9);
        m.notes.forEach(function (n) { n.durBeats = Math.min(7, n.durBeats * f); });
        return m;
      },
      diminish: function (m) {
        var f = rnd(0.55, 0.75);
        m.notes.forEach(function (n) { n.durBeats = Math.max(0.4, n.durBeats * f); });
        return m;
      },
      retrograde: function (m) {
        m.notes.reverse();
        return m;
      },
      sequence: function (m) {                     // restate at a transposition — real sequencing
        var step = pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
        var rep = clone(m).notes.map(function (n) { return { deg: n.deg + step, durBeats: n.durBeats }; });
        m.notes = m.notes.concat(rep).slice(0, 12);
        return m;
      },
      ornament: function (m) {                     // passing tones between leaps — grace, not filigree
        var res = [];
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i], nx = m.notes[i + 1];
          if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 && n.durBeats >= 1 && chance(0.55)) {
            res.push({ deg: n.deg, durBeats: n.durBeats * 0.65 });
            res.push({ deg: n.deg + Math.sign(nx.deg - n.deg), durBeats: Math.max(0.4, n.durBeats * 0.35) });
          } else res.push({ deg: n.deg, durBeats: n.durBeats });
        }
        m.notes = res;
        return m;
      },
      rotate: function (m) {                       // start the cell from a later note — the same
        var len = m.notes.length;                  // pitches, a fresh angle of approach (modal turn)
        if (len < 3) return m;
        var k = 1 + Math.floor(rng() * (len - 1));
        m.notes = m.notes.slice(k).concat(m.notes.slice(0, k));
        return m;
      },
      intervalExpand: function (m) {               // widen every interval about the head — the same
        var axis = m.notes[0].deg, f = rnd(1.4, 1.9);  // shape, opened out into bolder leaps
        m.notes.forEach(function (n) { n.deg = axis + Math.round((n.deg - axis) * f); });
        return recentre(m);
      },
      intervalCompress: function (m) {             // narrow every interval — the shape drawn in
        var axis = m.notes[0].deg, f = rnd(0.4, 0.65);  // toward chant, close to the reciting tone
        m.notes.forEach(function (n) { n.deg = axis + Math.round((n.deg - axis) * f); });
        return m;
      },
      syncopate: function (m) {                    // lilt: lengthen a strong note and clip the next
        for (var i = 0; i < m.notes.length - 1; i++) {  // — a dotted / snap displacement of the pulse
          if (m.notes[i].durBeats >= 1 && chance(0.5)) {
            var take = m.notes[i].durBeats * 0.4;
            m.notes[i].durBeats += take;
            m.notes[i + 1].durBeats = Math.max(0.3, m.notes[i + 1].durBeats - take * 0.6);
            i++;
          }
        }
        return m;
      },
      mordent: function (m) {                      // a quick neighbor flick on one held note — the
        var res = [], did = false;                 // reed's shake, distinct from filling a leap
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i];
          if (!did && n.durBeats >= 1.5 && res.length < 8 && chance(0.7)) {
            var dir = chance(0.5) ? 1 : -1;
            res.push({ deg: n.deg, durBeats: Math.max(0.3, n.durBeats * 0.3) });
            res.push({ deg: n.deg + dir, durBeats: 0.3 });
            res.push({ deg: n.deg, durBeats: Math.max(0.4, n.durBeats * 0.4) });
            did = true;
          } else res.push({ deg: n.deg, durBeats: n.durBeats });
        }
        m.notes = res;
        return m;
      },
    };

    // ---- chain grammar: which transform, given voice + section + chain ----
    // INSTRUMENT PERSONALITIES. Every voice works the SAME motifs (the day's
    // theme + subs) — but each has its own temperament for HOW it develops
    // them, so you can tell who is speaking by their habits alone. These are
    // only probability weights over the same random development: the piece
    // stays aleatoric, the players just have characters.
    //   · clarinet  — the deacon: agile, decorative, conversational
    //   · choir     — the congregation: broad, grand, opens tunes out
    //   · bells      — the peal: terse, bright, fragmentary, clipped
    //   · telegraph — the wire: pure rhythm, syncopated code, no filigree
    //   · harmonium — the parlor organ: warm, sustained, draws tunes inward
    //   · bagpipe   — the piper on the bluff: bold, wide leaps, long-held,
    //                 a march-snap — its OWN profile now, not the clarinet's
    var VOICE_WEIGHTS = {
      clarinet:  { ornament: 3.5, mordent: 3, sequence: 3, syncopate: 2.5, transpose: 2, rotate: 2, fragmentHead: 2, invert: 1.5, fragmentTail: 1.5, diminish: 1.5, intervalExpand: 1.2, intervalCompress: 1, retrograde: 1, augment: 0.6 },
      choir:     { augment: 4, invert: 3, transpose: 2.5, intervalExpand: 2, retrograde: 1.5, sequence: 1, rotate: 1, fragmentTail: 1, intervalCompress: 0.8, fragmentHead: 0.6, diminish: 0.4, syncopate: 0.4, ornament: 0.3, mordent: 0.3 },
      bells:     { fragmentHead: 4, diminish: 3.5, fragmentTail: 2.5, syncopate: 2.5, rotate: 2, transpose: 2, retrograde: 1.5, sequence: 1.5, intervalCompress: 1.5, invert: 1, mordent: 0.6, intervalExpand: 0.5, ornament: 0.2, augment: 0.2 },
      telegraph: { syncopate: 3.5, diminish: 3, fragmentHead: 3, retrograde: 2.5, rotate: 2, sequence: 2, intervalCompress: 1.5, fragmentTail: 1.5, transpose: 1, invert: 0.5, mordent: 0.3, intervalExpand: 0.3, augment: 0.2, ornament: 0.15 },
      harmonium: { augment: 3.5, transpose: 2.5, invert: 2, intervalCompress: 2, sequence: 1.5, intervalExpand: 1.2, rotate: 1, retrograde: 1, fragmentTail: 1, mordent: 0.6, ornament: 0.6, fragmentHead: 0.6, syncopate: 0.5, diminish: 0.4 },
      bagpipe:   { intervalExpand: 3, augment: 3, sequence: 2.5, transpose: 2.5, rotate: 2, invert: 1.8, syncopate: 1.8, retrograde: 1.5, fragmentTail: 1, mordent: 0.8, fragmentHead: 0.8, diminish: 0.6, ornament: 0.6, intervalCompress: 0.5 },
    };
    var SECTION_TILT = {
      prelude:    { augment: 1.6, transpose: 1.4, ornament: 0.4, diminish: 0.4, sequence: 0.6 },
      invocation: { augment: 1.8, fragmentTail: 1.3, sequence: 0.2, ornament: 0.3 },
      hymn:       { sequence: 1.5, invert: 1.3, ornament: 1.3 },
      testimony:  { fragmentHead: 1.6, fragmentTail: 1.5, augment: 1.3, sequence: 0.4 },
      sacrament:  { augment: 2, ornament: 0.2, diminish: 0.2 },
      doxology:   { invert: 1.4, sequence: 1.5, transpose: 1.3 },
      postlude:   { augment: 1.7, fragmentTail: 1.6, ornament: 0.4 },
    };
    var AFFINITY = {
      fragmentHead: { sequence: 2.4, ornament: 1.6 },
      fragmentTail: { sequence: 2.4, ornament: 1.6 },
      invert:       { augment: 1.7, transpose: 1.5 },
      sequence:     { diminish: 1.6 },
      ornament:     { augment: 1.4 },
    };
    function beatsOf(m) { var b = 0; m.notes.forEach(function (n) { b += n.durBeats; }); return b; }
    function isPalindromic(m) {
      var s = m.notes.map(function (n) { return n.deg; });
      for (var i = 0; i < s.length; i++) if (s[i] !== s[s.length - 1 - i]) return false;
      return true;
    }
    function lastRealLink(chain) {
      for (var i = chain.length - 1; i >= 0; i--)
        if (chain[i] !== "dissolve" && chain[i] !== "tether" && chain[i] !== "seed") return chain[i];
      return null;
    }
    function allowedTransform(name, m, chain) {
      var len = m.notes.length;
      var last = lastRealLink(chain);
      if (name === last) return false;             // never twice running
      if (name === "fragmentHead" || name === "fragmentTail") {
        if (len <= 4) return false;
        var frags = 0;
        for (var i = 0; i < chain.length; i++) if (chain[i].indexOf("fragment") === 0) frags++;
        if (frags >= 1 && len <= 6) return false;
      }
      if (name === "sequence" && len >= 7) return false;
      if (name === "ornament" && len >= 8) return false;
      if (name === "retrograde" && isPalindromic(m)) return false;
      if (name === "augment" && beatsOf(m) > 20) return false;
      if ((name === "rotate" || name === "syncopate") && len < 3) return false;
      if (name === "mordent" && len >= 8) return false;
      if (name === "intervalExpand" || name === "intervalCompress") {
        var lo = 1e9, hi = -1e9;
        for (var k = 0; k < m.notes.length; k++) { lo = Math.min(lo, m.notes[k].deg); hi = Math.max(hi, m.notes[k].deg); }
        var span = hi - lo;
        if (name === "intervalExpand" && span >= 8) return false;    // already wide — don't run away
        if (name === "intervalCompress" && span <= 2) return false;  // already narrow — nothing to draw in
      }
      return true;
    }
    function pickTransform(voice, m, chain) {
      var w = VOICE_WEIGHTS[voice] || VOICE_WEIGHTS.clarinet;
      var tilt = SECTION_TILT[S.C.section] || {};
      var dia = meetingDialect || {};
      var last = lastRealLink(chain);
      var pool = [];
      for (var name in w) {
        if (!allowedTransform(name, m, chain)) continue;
        var wt = w[name] * (tilt[name] || 1) * (dia[name] || 1);   // voice · section · the day's temper
        if (last && AFFINITY[last] && AFFINITY[last][name]) wt *= AFFINITY[last][name];
        pool.push([name, wt]);
      }
      return pool.length ? pickW(pool) : null;
    }
    // Keep the centre of mass in the singable window by whole octaves —
    // internal intervals untouched, the contour survives intact.
    function recentre(m) {
      if (!m.notes.length) return m;
      var sum = 0; m.notes.forEach(function (n) { sum += n.deg; });
      var mean = sum / m.notes.length;
      while (mean > 8) { m.notes.forEach(function (n) { n.deg -= 7; }); mean -= 7; }
      while (mean < -1) { m.notes.forEach(function (n) { n.deg += 7; }); mean += 7; }
      return m;
    }

    // ---- genealogy ----
    var lineage = {};
    var climaxReprised = false;
    function ancestorOf(name) {
      if (working.theme && working.theme.name === name) return working.theme;
      for (var i = 0; i < working.subs.length; i++) if (working.subs[i] && working.subs[i].name === name) return working.subs[i];
      return working.theme;
    }
    function remember(m) {
      var cur = lineage[m.name];
      if (!cur || m.gen >= cur.gen) lineage[m.name] = clone(m);
    }
    // CUMULATIVE FORM — is this motif the withheld theme? While the flag
    // holds, the theme family may circulate only as fragments (endings
    // first); the whole tune waits for the doxology assembly.
    function withheld(m) {
      return S.C.cumulative && !S.C.assemblyFired && working.theme && m && m.name === working.theme.name;
    }
    // Ives's staging, endings before beginnings: what fragment family each
    // section may work while the tune is withheld.
    var CUMULATIVE_STAGE = {
      prelude:    ["fragmentTail", "augment"],
      invocation: ["fragmentTail", "intervalCompress"],
      interlude:  ["fragmentTail", "intervalCompress"],
      hymn:       ["fragmentHead", "sequence"],
      testimony:  ["retrograde", "invert"],
      sacrament:  ["fragmentTail", "augment"],
      doxology:   ["fragmentHead", "sequence"],
      postlude:   ["fragmentTail", "augment"],
    };
    function developWithheld(voice, m) {
      var fam = CUMULATIVE_STAGE[S.C.section] || ["fragmentTail"];
      var out = clone(m);
      var forced = null;
      for (var fi = 0; fi < fam.length; fi++) {
        if (allowedTransform(fam[fi], out, out.chain)) { forced = fam[fi]; break; }
      }
      if (!forced) return develop(voice, out, 1);  // guards refused; one gentle link
      out = TRANSFORMS[forced](out);
      out.gen = m.gen + 1;
      out.chain = m.chain.concat([forced]);
      stats.transformsUsed[forced] = (stats.transformsUsed[forced] || 0) + 1;
      recentre(out);
      stats.developments++;
      remember(out);
      emitEvent({ cat: "motif", label: "◆ " + out.name + "·g" + out.gen, detail: forced + " · withheld" });
      // occasionally one more free link — but only one, and never verbatim
      if (chance(0.4)) out = develop(voice, out, 1);
      return out;
    }
    // Identity tether: every 3rd generation, the ancestor's opening is grafted
    // back on — development may wander the valley, but the head returns.
    function tether(m) {
      var anc = ancestorOf(m.name);
      if (!anc) return m;
      // under the withholding the graft is capped at 2 — the head may haunt,
      // never announce
      var kCap = withheld(m) ? 2 : 3;
      var k = Math.min(kCap, anc.notes.length, Math.max(1, m.notes.length - 1));
      m.notes = clone(anc).notes.slice(0, k).concat(m.notes.slice(k));
      m.chain = m.chain.concat(["tether"]);
      stats.transformsUsed.tether = (stats.transformsUsed.tether || 0) + 1;
      return m;
    }
    function develop(voice, m, maxChain) {
      if (m.gen >= 9) {                            // renewal: the line returns to its source
        var anc = ancestorOf(m.name);
        if (anc) m = anc;
      }
      var out = clone(m);
      var links = rint(1, maxChain || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(voice, out, out.chain.concat(used));
        if (!name) break;
        out = TRANSFORMS[name](out);
        used.push(name);
        stats.transformsUsed[name] = (stats.transformsUsed[name] || 0) + 1;
      }
      if (!used.length) {
        out = TRANSFORMS.transpose(out);
        used.push("transpose");
        stats.transformsUsed.transpose = (stats.transformsUsed.transpose || 0) + 1;
      }
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(used);
      if (out.gen >= 3 && out.gen % 3 === 0) out = tether(out);
      recentre(out);
      stats.developments++;
      remember(out);
      emitEvent({ cat: "motif", label: "◆ " + out.name + "·g" + out.gen, detail: used.join("+") + " · " + (out.gesture || "") });
      return out;
    }
    // Which motif should a voice work right now?
    function request(voice) {
      var m;
      switch (S.C.section) {
        case "prelude": case "invocation":
          m = chance(0.7) ? working.theme : pick(working.subs); break;
        case "hymn":
          m = pickW([[working.theme, 3], [working.subs[0], 2], [working.subs[1] || working.theme, 2]]); break;
        case "testimony": case "sacrament":
          m = chance(0.55) ? pick(working.subs) : working.theme; break;
        case "doxology":
          m = chance(0.65) ? working.theme : pick(working.subs); break;
        default:
          m = working.theme;
      }
      if (!m) m = working.theme;
      // CUMULATIVE: MORE of the theme's parts than usual — the form is
      // presence of the fragments, absence of the whole
      if (withheld(working.theme) && m !== working.theme && chance(0.33)) m = working.theme;
      // Work the LINEAGE (what the meeting has built) about half the time in
      // the singing sections; the tether keeps it recognizable.
      if (S.C.section === "hymn" || S.C.section === "doxology") {
        var line = lineage[m.name];
        if (line && line.gen > 0 && line.gen < 6 && chance(0.45)) m = line;
      }
      // State it plainly first — the tradition trusts its tunes.
      if ((S.C.section === "prelude" || S.C.section === "invocation") && m.gen === 0 && chance(0.5) && !withheld(m)) return clone(m);
      if (S.C.section === "doxology" && !climaxReprised && localArc() > 0.55 && !(S.C.cumulative && !S.C.assemblyFired)) {
        // THE reprise: once per meeting, at the doxology's height, something
        // returns whole — usually the literal theme, sometimes its deepest
        // descendant, sometimes the lesser hymn. Recognition, varied.
        climaxReprised = true;
        var roll = rng();
        var deepLine = lineage[working.theme.name];
        if (roll < 0.25 && deepLine && deepLine.gen >= 3) {
          emitEvent({ cat: "motif", label: "✸ reprise " + working.theme.name, detail: "the theme returns, transfigured — g" + deepLine.gen });
          return clone(deepLine);
        }
        if (roll < 0.4 && working.subs.length) {
          var subRe = pick(working.subs);
          emitEvent({ cat: "motif", label: "✸ reprise " + subRe.name, detail: "the lesser hymn returns — " + (subRe.gesture || "") });
          return clone(subRe);
        }
        emitEvent({ cat: "motif", label: "✸ reprise " + working.theme.name, detail: "the theme returns, verbatim — " + (working.theme.gesture || "") });
        return clone(working.theme);
      }
      if (S.C.section === "postlude") {
        var deep = lineage[m.name];
        return decompose((deep && deep.gen > m.gen) ? clone(deep) : clone(m));
      }
      // the withheld theme develops only through its section's fragment family
      if (withheld(m)) return developWithheld(voice, m);
      return develop(voice, m, S.C.section === "doxology" ? 3 : 2);
    }
    // Postlude: the motif releases its notes one at a time into the evening.
    function decompose(m) {
      var out = clone(m);
      var x = localArc();
      var keep = Math.max(1, Math.round(out.notes.length * (1 - 0.8 * x)));
      while (out.notes.length > keep) out.notes.splice(rint(1, Math.max(1, out.notes.length - 1)), 1);
      out.notes.forEach(function (n) { n.durBeats *= 1 + x; });
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(["dissolve"]);
      emitEvent({ cat: "motif", label: "࿙ " + out.name + " disperses", detail: "notes let go into the dusk" });
      return out;
    }

    // ---- dialogue ledger: real obligations between voices ----
    function post(fromVoice, toVoice, motif, type) {
      ledger.push({ from: fromVoice, to: toVoice, motif: clone(motif), type: type, deadline: S.ctx.currentTime + rnd(8, 20) });
      if (ledger.length > 6) ledger.shift();
    }
    function claim(voice) {
      var i, ob = null;
      for (i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) { ob = ledger.splice(i, 1)[0]; break; }
      }
      if (!ob) {
        // An obligation past its deadline is taken up by whichever voice
        // speaks next (never the caller itself) — the answer is always heard.
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voice && S.ctx.currentTime > ledger[i].deadline) { ob = ledger.splice(i, 1)[0]; break; }
        }
      }
      if (!ob) return null;
      var m = ob.motif;
      if (m.gen >= 9) {
        var anc = ancestorOf(m.name);
        if (anc) m = clone(anc);
      }
      var ans;
      if (ob.type === "line-out") {
        // lining-out: the answer is the same line, sung back in harmony —
        // the caller's notes verbatim; the choir sets them (renderer's job).
        ans = clone(m);
        ans.linedOut = true;
      } else if (ob.type === "imitate") ans = develop(voice, m, 1);
      else if (ob.type === "invert") {
        var op = "invert";
        if (lastRealLink(m.chain) === "invert") op = isPalindromic(m) ? "transpose" : "retrograde";
        ans = TRANSFORMS[op](clone(m)); ans.gen = m.gen + 1; ans.chain = m.chain.concat([op]);
        stats.transformsUsed[op] = (stats.transformsUsed[op] || 0) + 1;
        recentre(ans); remember(ans);
      }
      else ans = develop(voice, m, 2);
      stats.answers++;
      emitEvent({ cat: "motif", label: "⇄ " + voice + " answers " + ob.from, detail: ob.type + " · " + ans.name + "·g" + ans.gen });
      return ans;
    }
    function overdueFor(voice) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) return true;
        if (ledger[i].from !== voice && S.ctx && S.ctx.currentTime > ledger[i].deadline) return true;
      }
      return false;
    }
    function pendingLineOut(voice) {
      for (var i = 0; i < ledger.length; i++) if (ledger[i].to === voice && ledger[i].type === "line-out") return true;
      return false;
    }

    function newMeeting() {
      // THE DAY'S TEMPER — the developmental dialect for the whole meeting.
      // Tilted by the kind of Sunday and the season: fast days run plain and
      // terse, festivals run florid and expansive, but any temper can surface.
      var act = S.C.meeting ? S.C.meeting.activity : "ordinary";
      dialectName = pickW([
        ["plain",     2 + 2.5 * (1 - S.seasonPos) + (act === "fast" ? 1.5 : 0)],
        ["psalmodic", 1.8 + (act === "fast" ? 1 : 0)],
        ["terse",     1.2 + (act === "fast" ? 2 : 0)],
        ["florid",    0.8 + 2.4 * S.seasonPos + (act === "jubilee" ? 1.5 : 0)],
        ["expansive", 1 + 2 * S.seasonPos + (act === "conference" ? 1.2 : 0)],
        ["restless",  1.2 + S.seasonPos + (act === "conference" ? 1 : 0)],
      ]);
      meetingDialect = DIALECTS[dialectName];
      // Draw DISTINCT gestures from the pool. Most stay home today — and a
      // lean fast Sunday sometimes carries only two hymns in its pocket.
      var draw = (S.C.meeting && S.C.meeting.activity === "fast" && chance(0.5)) ? 2 : 3;
      var idxs = [];
      while (idxs.length < draw) {
        var gi = rint(0, GESTURES.length - 1);
        if (idxs.indexOf(gi) < 0) idxs.push(gi);
      }
      working.theme = fromGesture(GESTURES[idxs[0]], NAMES[0]);
      working.subs = [];
      for (var si = 1; si < idxs.length; si++) working.subs.push(fromGesture(GESTURES[idxs[si]], NAMES[si]));
      // Perturb each once, gently, so no two meetings state a gesture the same.
      [working.theme].concat(working.subs).forEach(function (m) {
        var op = pickW([["transpose", 3], ["augment", 2], ["ornament", 1], ["diminish", 1]]);
        if (allowedTransform(op, m, [])) { TRANSFORMS[op](m); m.chain = ["seed"]; }
      });
      // CUMULATIVE: a 3-note theme withheld and finally assembled is an
      // anticlimax — seat the day's longest hymn in the theme's chair (the
      // chair keeps its name; the tune changes hands)
      if (S.C.cumulative && working.theme.notes.length < 5) {
        var best = -1;
        for (var wi = 0; wi < working.subs.length; wi++) {
          var cand = working.subs[wi].notes.length;
          var cur2 = best < 0 ? working.theme.notes.length : working.subs[best].notes.length;
          if (cand > cur2) best = wi;
        }
        if (best >= 0 && working.subs[best].notes.length >= 5) {
          var swap = working.theme;
          working.theme = working.subs[best];
          working.subs[best] = swap;
          var chairName = swap.name;
          swap.name = working.theme.name;
          working.theme.name = chairName;
        }
      }
      ledger.length = 0;
      lineage = {};
      climaxReprised = false;
      stats.gestures = idxs.map(function (g2) { return GESTURES[g2].name; });
      emitEvent({
        cat: "motif", label: "❁ the day's hymns",
        detail: stats.gestures.map(function (g3, k) { return NAMES[k] + " " + g3; }).join(" · ") + " · temper: " + dialectName,
      });
    }
    function onSection(type) {
      if (type === "doxology") climaxReprised = false;
    }
    function theme() { return working.theme; }
    function anyWorking() {
      // under the withholding, casual callers never receive the raw theme
      if (S.C.cumulative && !S.C.assemblyFired) {
        if (working.subs.length) return pick(working.subs);
        return developWithheld("choir", working.theme);
      }
      return (chance(0.7) || !working.subs.length) ? working.theme : pick(working.subs);
    }

    return {
      newMeeting: newMeeting, onSection: onSection, theme: theme, anyWorking: anyWorking,
      request: request, post: post, claim: claim, overdueFor: overdueFor, pendingLineOut: pendingLineOut,
      decompose: decompose, develop: develop,
      stats: function () {
        return {
          developments: stats.developments, answers: stats.answers,
          transforms: Object.keys(stats.transformsUsed),
          gestures: stats.gestures.slice(), dialect: dialectName,
          working: {
            theme: working.theme && working.theme.name,
            gen: working.theme && working.theme.gen,
            // the day's theme as its GESTURE cipher — the hymn board's letter
            gesture: working.theme && working.theme.gesture,
            letter: (working.theme && GESTURE_LETTER[working.theme.gesture]) || null,
          },
        };
      },
    };
  })();

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.METERS = METERS;
  S.Prosody = Prosody;
  S.Motif = Motif;
  // the room's public face on the KOLOB namespace
  KOLOB.Melody = { METERS: METERS, Prosody: Prosody, Motif: Motif };
})();

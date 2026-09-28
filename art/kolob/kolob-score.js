// ============================================================================
// KOLOB — kolob-score.js: the score as it is written
//
// The Score (SCORE.md §5): the Hymn, its Lines, their Notes, and the
// Performance that wraps a Hymn for one singing — plain objects that the
// composer writes, the performers render, the page engraves and the harness
// reads. This room holds what every one of them needs and nobody should
// write twice:
//
//   · THE SHAPES — hymn(), line(), note(), chord(), performance(): a Score
//     object made from a sketch, every field the contract names filled in
//     (a field of the maker's own rides along untouched: the Earth tunes'
//     alt, comma and src, a line's startBeat);
//   · THE PROOFREADER — validateHymn / Line / Note / Performance / Event,
//     and validate(obj, kind): each returns the list of what is wrong with
//     the object, empty when it is right. A Score is held to §5 (parts that
//     line up by beat, one melody onset per syllable, a spelling that agrees
//     with its pitch up to a comma, cadences and chords of the contract's
//     kinds); an event to §6 and to the words round 2 added to it;
//   · THE CLERK'S COPY — toJSON / fromJSON / roundTrip: a Score is JSON, and
//     roundTrip says whether a Score survives being written out and read
//     back exactly (a function, an undefined, a NaN or a cycle does not);
//   · THE READER'S HELPS — chordAt(line, beat), notesAt(hymn, t),
//     timeline(hymn), syllableMap(hymn, verse), lineLength(line): what the
//     composer, the engraver and the harness ask of a Score;
//   · THE CHORD BOOK (round 2, milestone 2) — the harmony of the hall set
//     down against the music's own clock (below, unchanged).
//
// Pure (SCORE.md §1): no audio, no clock, no dice, no DOM, no KOLOB._s. It
// loads headless (the harness requires it into a bare context).
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Score = (function () {
  "use strict";

  // ==========================================================================
  // THE VOCABULARY (SCORE.md §2, §5, §6)
  // ==========================================================================
  var PARTS = ["S", "A", "T", "B"];
  var MODES = ["ionian", "mixolydian", "dorian", "aeolian", "penta", "hexa"];
  var PROVENANCE = ["earth", "colony", "gift"];
  var DIALECTS = ["sacredharp", "psalmody", "tabernacle", "gospel", "shaker", "oldway"];
  var CADENCES = ["authentic", "half", "plagal", "deceptive", "openfifth", "imperfect", "none"];
  var NCT = ["pass", "nbr", "susp", "app", "ant", "esc"];
  var ORNAMENTS = ["grace", "slide", "turn"];
  // (round 3b, step 3: "quartet" — gospel's verse sung by four of the ward
  // standing, the ward on the refrain; "round" — a hymn sung as a canon, the
  // ward going in group by group)
  var PRACTICES = ["sung", "notes", "lined", "hummed", "unison", "descant", "quartet", "round"];
  // the contract's qualities and the Earth tunes' (the "…" of §5): a chord the
  // engine's gapped scales stack that is no triad is "other"
  var QUALITIES = ["maj", "min", "dim", "aug", "dom7", "maj7", "min7", "hdim7", "open5", "unison", "sus", "other"];

  // The spelling's pitch, for the proofreader: a degree's place in the
  // parent seven-note scale of the hymn's mode, in cents (the gapped scales
  // are major collections that leave notes out).
  var PARENT_CENTS = {
    ionian:     [0, 203.910, 386.314, 498.045, 701.955, 884.359, 1088.269],
    mixolydian: [0, 203.910, 386.314, 498.045, 701.955, 884.359, 996.090],
    dorian:     [0, 203.910, 315.641, 498.045, 701.955, 884.359, 996.090],
    aeolian:    [0, 203.910, 315.641, 498.045, 701.955, 813.686, 996.090],
  };
  PARENT_CENTS.penta = PARENT_CENTS.hexa = PARENT_CENTS.ionian;
  var COMMA_C = 21.506;                      // 81/80: the most a spelling may be off its pitch
  var SPELL_SLACK = COMMA_C + 1.5;           // (and a float's breath)
  // (round 3b: the ringing seventh. Gospel's dominant sevenths are sung on
  // the seventh harmonic, 4:5:6:7, and a note on it stands one Johnston "7"
  // — 36/35 — under the spelling a 5-limit score would give it; SCORE §2's
  // commaOf reads it so. The proofreader allows that much again for every
  // factor of 7 a monzo carries, and no more: r3-hymn2-1's request 1)
  var SEPTIMAL_C = 1200 * Math.log(36 / 35) / Math.LN2;   // 48.770 c

  // ==========================================================================
  // SMALL HANDS
  // ==========================================================================
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function isInt(x) { return isNum(x) && Math.floor(x) === x; }
  function isStr(x) { return typeof x === "string"; }
  function isBool(x) { return x === true || x === false; }
  function isMonzo(m) { return Array.isArray(m) && m.length === 4 && m.every(isInt); }
  function monzoCents(m) {
    return 1200 * (m[0] + m[1] * Math.log2(3) + m[2] * Math.log2(5) + m[3] * Math.log2(7));
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // the fields of a sketch the maker added, carried over as they are
  function extras(out, o) {
    for (var k in o) if (has(o, k) && !has(out, k)) out[k] = o[k];
    return out;
  }
  var EPS = 1e-6;

  // ==========================================================================
  // THE SHAPES — a Score object from a sketch (defaults as SCORE.md §5 has
  // them; nothing validated here — the proofreader does that)
  // ==========================================================================
  function note(o) {
    o = o || {};
    return extras({
      beat: o.beat != null ? o.beat : 0, beats: o.beats != null ? o.beats : 1,
      deg: o.deg != null ? o.deg : 0, monzo: o.monzo ? o.monzo.slice() : [0, 0, 0, 0],
      tie: !!o.tie, fermata: !!o.fermata,
      syl: o.syl === undefined ? null : o.syl,
      stress: o.stress ? 1 : 0,
      nct: o.nct || null, ornament: o.ornament || null,
    }, o);
  }
  function chord(o) {
    o = o || {};
    return extras({ beat: o.beat || 0, len: o.len != null ? o.len : 1, roman: o.roman || "I", rootDeg: o.rootDeg || 0, quality: o.quality || "maj" }, o);
  }
  function line(o) {
    o = o || {};
    var notes = {};
    for (var p in (o.notes || {})) if (has(o.notes, p)) notes[p] = (o.notes[p] || []).map(note);
    return extras({
      notes: notes,
      cadence: { kind: (o.cadence && o.cadence.kind) || "none", beat: (o.cadence && o.cadence.beat) || 0 },
      chords: (o.chords || []).map(chord),
      peak: !!o.peak, breathAfter: o.breathAfter !== false,
      fermataBeats: (o.fermataBeats || []).slice(),
    }, o);
  }
  function hymn(o) {
    o = o || {};
    return extras({
      id: o.id || "", number: o.number != null ? o.number : null, nameDs: o.nameDs || "",
      provenance: o.provenance || "colony", source: o.source || null,
      meter: o.meter || "", form: o.form || "", dialect: o.dialect || "tabernacle",
      mode: o.mode || "ionian", keyMonzo: o.keyMonzo ? o.keyMonzo.slice() : [0, 0, 0, 0],
      modeOfTime: o.modeOfTime || "4/4", beatS: o.beatS || 1, melodyPart: o.melodyPart || "S",
      lines: (o.lines || []).map(line), refrain: o.refrain ? o.refrain.map(line) : null,
      verses: (o.verses || []).map(function (v) { return v.slice(); }),
    }, o);
  }
  function performance(o) {
    o = o || {};
    return extras({
      hymnId: o.hymnId || "", verse: o.verse || 0, practice: o.practice || "sung",
      tempoMul: o.tempoMul != null ? o.tempoMul : 1, rubato: o.rubato || 0,
      organ: o.organ || null, singers: (o.singers || []).slice(),
    }, o);
  }

  // ==========================================================================
  // THE PROOFREADER — each returns [] for a right object, else what is wrong
  // (every problem names where it is: "line 3 A[2].monzo …")
  // ==========================================================================
  // opts: { mode, melody (this part is the melody) }
  function validateNote(n, where, opts) {
    var out = [], w = where || "note";
    opts = opts || {};
    if (!isObj(n)) return [w + ": not an object"];
    if (!isNum(n.beat) || n.beat < -EPS) out.push(w + ".beat " + n.beat + ": not a beat within the line");
    if (!isNum(n.beats) || n.beats <= 0) out.push(w + ".beats " + n.beats + ": a note must last");
    if (!isInt(n.deg)) out.push(w + ".deg " + n.deg + ": not a whole degree");
    if (!isMonzo(n.monzo)) out.push(w + ".monzo: not four whole exponents of 2, 3, 5, 7");
    if (!isBool(n.tie)) out.push(w + ".tie: not true/false");
    if (!isBool(n.fermata)) out.push(w + ".fermata: not true/false");
    if (!(n.syl === null || (isInt(n.syl) && n.syl >= 0))) out.push(w + ".syl " + n.syl + ": not a syllable index or null");
    if (n.stress !== 0 && n.stress !== 1) out.push(w + ".stress " + n.stress + ": not 1 or 0");
    if (!(n.nct === null || NCT.indexOf(n.nct) >= 0)) out.push(w + ".nct '" + n.nct + "': not a kind of non-chord tone");
    if (!(n.ornament === null || ORNAMENTS.indexOf(n.ornament) >= 0)) out.push(w + ".ornament '" + n.ornament + "': not an ornament");
    // the monzo is the truth and the degree the spelling: they agree up to a
    // comma (a chromatic note — Note.alt — up to a semitone and a comma)
    if (opts.mode && isInt(n.deg) && isMonzo(n.monzo) && PARENT_CENTS[opts.mode]) {
      var cls = ((n.deg % 7) + 7) % 7, oct = Math.floor(n.deg / 7);
      var spelled = 1200 * oct + PARENT_CENTS[opts.mode][cls];
      var off = monzoCents(n.monzo) - spelled;
      var room = SPELL_SLACK + (n.alt ? 100 + 12 : 0) + SEPTIMAL_C * Math.abs(n.monzo[3]);
      if (Math.abs(off) > room) out.push(w + ": deg " + n.deg + " is spelled " + spelled.toFixed(1) + " c, its monzo sounds " + monzoCents(n.monzo).toFixed(1) + " c (" + off.toFixed(1) + " c off)");
    }
    return out;
  }
  function validateChord(c, where) {
    var out = [], w = where || "chord";
    if (!isObj(c)) return [w + ": not an object"];
    if (!isNum(c.beat) || c.beat < -EPS) out.push(w + ".beat " + c.beat + ": not a beat within the line");
    if (!isNum(c.len) || c.len <= 0) out.push(w + ".len " + c.len + ": a chord must last");
    if (!isStr(c.roman) || !c.roman) out.push(w + ".roman: no numeral");
    if (!isInt(c.rootDeg) || c.rootDeg < 0 || c.rootDeg > 6) out.push(w + ".rootDeg " + c.rootDeg + ": not a degree 0–6");
    if (QUALITIES.indexOf(c.quality) < 0) out.push(w + ".quality '" + c.quality + "': not a quality");
    return out;
  }
  // opts: { melodyPart, mode, where }
  function validateLine(l, where, opts) {
    var out = [], w = where || "line";
    opts = opts || {};
    if (!isObj(l)) return [w + ": not an object"];
    if (!isObj(l.notes)) return [w + ".notes: not an object of parts"];
    var parts = Object.keys(l.notes);
    if (!parts.length) out.push(w + ": no parts");
    parts.forEach(function (p) {
      if (PARTS.indexOf(p) < 0) { out.push(w + ": '" + p + "' is not a part (S A T B)"); return; }
      var arr = l.notes[p];
      if (!Array.isArray(arr)) { out.push(w + " " + p + ": not a list of notes"); return; }
      var prev = null;
      arr.forEach(function (n, i) {
        out.push.apply(out, validateNote(n, w + " " + p + "[" + i + "]", { mode: opts.mode, melody: p === opts.melodyPart }));
        // a part is one voice: its notes follow one another, never overlap
        if (prev && isNum(n.beat) && isNum(prev.beat) && isNum(prev.beats) && n.beat < prev.beat + prev.beats - EPS) {
          out.push(w + " " + p + "[" + i + "] begins at beat " + n.beat + ", inside the note before it (" + prev.beat + " + " + prev.beats + ")");
        }
        prev = n;
      });
    });
    if (opts.melodyPart && !l.notes[opts.melodyPart]) out.push(w + ": the melody part " + opts.melodyPart + " is missing");
    // the melody has one onset per syllable: its syllables count on by one
    // (a melisma's continuation, and a note tied into, are null)
    var mel = opts.melodyPart && l.notes[opts.melodyPart];
    if (Array.isArray(mel)) {
      var last = null;
      mel.forEach(function (n, i) {
        if (!n || n.syl === null || !isInt(n.syl)) return;
        if (last !== null && n.syl !== last + 1) out.push(w + " " + opts.melodyPart + "[" + i + "].syl " + n.syl + " does not follow " + last);
        last = n.syl;
      });
    }
    var len = lineLength(l);
    if (!isObj(l.cadence)) out.push(w + ".cadence: not an object");
    else {
      if (CADENCES.indexOf(l.cadence.kind) < 0) out.push(w + ".cadence.kind '" + l.cadence.kind + "': not a kind of cadence");
      if (!isNum(l.cadence.beat) || l.cadence.beat < -EPS || l.cadence.beat > len + EPS) out.push(w + ".cadence.beat " + l.cadence.beat + ": not inside the line (0–" + len + ")");
    }
    if (!Array.isArray(l.chords)) out.push(w + ".chords: not a list");
    else {
      var pc = null;
      l.chords.forEach(function (c, i) {
        out.push.apply(out, validateChord(c, w + " chord[" + i + "]"));
        if (isObj(c) && isNum(c.beat) && c.beat > len + EPS) out.push(w + " chord[" + i + "] at beat " + c.beat + " stands past the line's end (" + len + ")");
        if (pc && isNum(c.beat) && c.beat < pc.beat + pc.len - EPS) out.push(w + " chord[" + i + "] at beat " + c.beat + " overlaps the chord before it");
        pc = c;
      });
    }
    if (!isBool(l.peak)) out.push(w + ".peak: not true/false");
    if (!isBool(l.breathAfter)) out.push(w + ".breathAfter: not true/false");
    if (!Array.isArray(l.fermataBeats) || !l.fermataBeats.every(isNum)) out.push(w + ".fermataBeats: not a list of beats");
    return out;
  }
  // (round 3b: r:<n>:<k> — the meeting's wandering refrain, k 0 as it was
  // written, 1–3 each statement of it in the key and dialect of the hymn it
  // follows)
  var ID = /^(h:\d+:\d+|r:\d+:\d+|earth:[a-z0-9][a-z0-9-]*|gift:\S+)$/;
  function validateHymn(h, where) {
    var out = [], w = where || (h && h.id) || "hymn";
    if (!isObj(h)) return [w + ": not an object"];
    if (!isStr(h.id) || !ID.test(h.id)) out.push(w + ".id '" + h.id + "': not h:<meeting>:<i>, earth:<slug> or gift:<…>");
    if (!(h.number === null || isNum(h.number))) out.push(w + ".number: not a number or null");
    if (!isStr(h.nameDs) || !h.nameDs) out.push(w + ".nameDs: no Deseret name");
    if (PROVENANCE.indexOf(h.provenance) < 0) out.push(w + ".provenance '" + h.provenance + "': not earth, colony or gift");
    if (h.provenance === "earth") {
      var s = h.source;
      if (!isObj(s)) out.push(w + ".source: an Earth tune must cite its source");
      else {
        if (!isStr(s.book) || !s.book) out.push(w + ".source.book: none");
        if (!isInt(s.year)) out.push(w + ".source.year: none");
        if (!(isNum(s.page) || (isStr(s.page) && s.page))) out.push(w + ".source.page: none");
      }
    } else if (!(h.source === null || isObj(h.source))) out.push(w + ".source: not an object or null");
    if (!isStr(h.meter) || !h.meter) out.push(w + ".meter: none");
    if (!isStr(h.form)) out.push(w + ".form: not a string");
    if (DIALECTS.indexOf(h.dialect) < 0) out.push(w + ".dialect '" + h.dialect + "': not a dialect");
    if (MODES.indexOf(h.mode) < 0) out.push(w + ".mode '" + h.mode + "': not one of the six modes");
    if (!isMonzo(h.keyMonzo)) out.push(w + ".keyMonzo: not a monzo");
    if (!isStr(h.modeOfTime) || !/^\d+\/\d+$/.test(h.modeOfTime)) out.push(w + ".modeOfTime '" + h.modeOfTime + "': not a time signature");
    if (!isNum(h.beatS) || h.beatS <= 0) out.push(w + ".beatS: not a beat length");
    if (h.melodyPart !== "S" && h.melodyPart !== "T") out.push(w + ".melodyPart '" + h.melodyPart + "': not S or T");
    var opts = { melodyPart: h.melodyPart, mode: MODES.indexOf(h.mode) >= 0 ? h.mode : null };
    if (!Array.isArray(h.lines) || !h.lines.length) out.push(w + ".lines: none");
    else h.lines.forEach(function (l, i) { out.push.apply(out, validateLine(l, w + " line " + (i + 1), opts)); });
    if (!(h.refrain === null || Array.isArray(h.refrain))) out.push(w + ".refrain: not a list of lines or null");
    else if (h.refrain) h.refrain.forEach(function (l, i) { out.push.apply(out, validateLine(l, w + " refrain " + (i + 1), opts)); });
    // the syllables count on from 0 through the verse, and again through the refrain
    [h.lines, h.refrain].forEach(function (ls, ri) {
      if (!Array.isArray(ls)) return;
      var next = 0;
      ls.forEach(function (l, li) {
        var mel = l && isObj(l.notes) && l.notes[h.melodyPart];
        if (!Array.isArray(mel)) return;
        mel.forEach(function (n, ni) {
          if (!n || !isInt(n.syl)) return;
          if (n.syl !== next) out.push(w + (ri ? " refrain " : " line ") + (li + 1) + " " + h.melodyPart + "[" + ni + "].syl " + n.syl + ": the " + (ri ? "refrain" : "verse") + " is at syllable " + next);
          next = n.syl + 1;
        });
      });
    });
    if (!Array.isArray(h.verses) || !h.verses.every(function (v) { return Array.isArray(v) && v.every(isStr); })) out.push(w + ".verses: not a list of syllable lists");
    else if (h.verses.length) {
      var want = syllableMap(h, 0).filter(function (s) { return !s.refrain; }).length;
      h.verses.forEach(function (v, i) { if (v.length !== want) out.push(w + " verse " + (i + 1) + ": " + v.length + " syllables for " + want + " melody onsets"); });
    }
    return out;
  }
  // hymn (optional): the Hymn the performance sings, to check it against
  function validatePerformance(p, hymnFor, where) {
    var out = [], w = where || "performance";
    if (!isObj(p)) return [w + ": not an object"];
    if (!isStr(p.hymnId) || !ID.test(p.hymnId)) out.push(w + ".hymnId '" + p.hymnId + "': not a hymn's id");
    if (!isInt(p.verse) || p.verse < 0) out.push(w + ".verse " + p.verse + ": not a verse index");
    if (PRACTICES.indexOf(p.practice) < 0) out.push(w + ".practice '" + p.practice + "': not a singing practice");
    if (!isNum(p.tempoMul) || p.tempoMul <= 0) out.push(w + ".tempoMul: not a tempo");
    if (!isNum(p.rubato) || p.rubato < 0) out.push(w + ".rubato: not a rubato");
    if (!(p.organ === null || (isObj(p.organ) && Array.isArray(p.organ.registration)))) out.push(w + ".organ: not null or {registration: […]}");
    if (!Array.isArray(p.singers)) out.push(w + ".singers: not a list");
    if (hymnFor) {
      if (p.hymnId !== hymnFor.id) out.push(w + ".hymnId " + p.hymnId + " is not the hymn's (" + hymnFor.id + ")");
      if (p.lines != null) {
        if (!Array.isArray(p.lines) || !p.lines.length) out.push(w + ".lines: not a list of line indices");
        else p.lines.forEach(function (li) { if (!isInt(li) || li < 0 || li >= (hymnFor.lines || []).length) out.push(w + ".lines: " + li + " is not a line of " + hymnFor.id); });
      }
    }
    return out;
  }

  // ==========================================================================
  // THE EVENTS (SCORE.md §6) — every typed event's payload, by field kind.
  // A "?" kind may be null; an object is a payload of its own, checked field
  // by field (the hymn a hymn-announced names). The first block is the
  // contract's table; the second is what round 2 added so that nothing the
  // page prints is read off a label any more (requested for §6). An event
  // may carry more than this — the legacy {cat, label, detail} ride along on
  // the same object.
  // ==========================================================================
  var EVENTS = {
    "meeting-start":       { n: "int", sunday: "str?", kind: "str", mode: "mode", keynoteHz: "num", houseDialect: "str?" },
    "section-start":       { section: "str", index: "int" },
    "hymn-announced":      { hymn: { id: "hymnId", number: "num?", nameDs: "str?", meter: "str", dialect: "dialect?", authorDs: "str?" }, leaderDs: "str?" },
    "verse-start":         { hymnId: "hymnId", verse: "int", practice: "practice" },
    "cadence":             { kind: "cadence" },
    "guest-start":         { guest: "str", section: "str", logged: "bool" },
    "guest-end":           { guest: "str", section: "str", logged: "bool" },
    "question-asking":     { k: "int", questionId: "str?" },
    "question-unanswered": {},
    "cast":                { memberId: "str", nameDs: "str", action: "str" },
    "vision":              { name: "str", nameDs: "str", d: "num" },
    "telegraph":           { word: "str", wordDs: "str?", marks: "arr" },
    // round 2
    "transport":           { action: "str" },
    "sunrise":             { mode: "mode", keynoteHz: "num" },
    "liahona":             { points: "str" },
    "stillness":           { why: "str", holdS: "num" },
    "skip":                { to: "str" },
    "joint":               { last: "bool", toward: "str?", dur: "num" },
    "room-empties":        { toward: "str?" },
    "verse-line":          { hymnId: "hymnId", verse: "int", line: "int", speechLine: "int", practice: "practice", score: "obj" },
    "lining-out":          { meter: "str", syllables: "int" },
    "fuging":              { entries: "int" },
    "field":               { field: "str" },
    "chord":               { at: "num", chord: "int", by: "str", voicing: "arr", freqs: "arr" },
    "guest":               { guest: "str", stage: "str", logged: "bool" },
    "guests-drawn":        { guests: "arr" },
    "hymns-of-the-day":    { gestures: "arr" },
    "motif-develop":       { name: "str", gen: "int" },
    "motif-reprise":       { name: "str" },
    "motif-answer":        { voice: "str", from: "str" },
    "motif-disperse":      { name: "str" },
    "motif-shadow":        { voice: "str", name: "str" },
    // the pre-v0.34 polish: the house lets go when a guest enters (each note
    // released, as written and as heard: {layer, freq, startTime, duration,
    // until}); and the prelude's seating, drawn per Sunday
    "house-lets-go":       { guest: "str", at: "num", until: "num", layers: "arr", released: "arr", logged: "bool" },
    "prelude-seating":     { n: "int", seating: "str", at: "obj" },
    // round 3: the day's hymnal — the house dialect and each singing
    // section's hymn (its id, dialect, key), drawn with the plan
    "hymnal":              { house: "dialect", hymns: "arr" },
    // round 3b, step 2: the organist's chorale prelude on the day's first
    // hymn — its span (the house listens through it) and its manner
    "chorale-prelude":     { hymnId: "hymnId", t0: "num", until: "num", style: "str?", manner: "str?" },
    // round 3b, step 3: the day's forms — a round's groups going in one by
    // one; the partner hymn's last verse, the first hymn played against it
    // (by the organ or a cornet of the ward's band); each statement of the
    // wandering refrain (k 0 after the first hymn, the enthusiast first; the
    // last in the doxology, unprompted) — and the doxology's one payoff
    "round-entry":         { hymnId: "hymnId", entry: "int", group: "str" },
    "partner":             { hymnId: "hymnId", of: "hymnId", by: "str", combined: "bool" },
    "refrain":             { refrainId: "hymnId", statement: "int", after: "hymnId", dox: "bool", by: "str?" },
    "payoff":              { kind: "str", section: "str" },
  };
  var KINDS = {
    int: isInt, num: isNum, str: isStr, bool: isBool, obj: isObj, arr: Array.isArray,
    mode: function (x) { return MODES.indexOf(x) >= 0; },
    cadence: function (x) { return CADENCES.indexOf(x) >= 0; },
    practice: function (x) { return PRACTICES.indexOf(x) >= 0; },
    dialect: function (x) { return DIALECTS.indexOf(x) >= 0; },
    hymnId: function (x) { return isStr(x) && ID.test(x); },
  };
  // the payload against its spec; `at` names where (the type, and the field
  // a nested payload hangs from)
  function payload(o, spec, at, out) {
    Object.keys(spec).forEach(function (k) {
      var kind = spec[k];
      if (!has(o, k)) { out.push(at + ": no " + k); return; }
      if (isObj(kind)) {
        if (!isObj(o[k])) out.push(at + "." + k + " " + JSON.stringify(o[k]) + ": not an object");
        else payload(o[k], kind, at + "." + k, out);
        return;
      }
      var opt = kind.charAt(kind.length - 1) === "?";
      if (opt) kind = kind.slice(0, -1);
      if (opt && o[k] === null) return;
      if (!KINDS[kind](o[k])) out.push(at + "." + k + " " + JSON.stringify(o[k]) + ": not " + kind);
    });
    return out;
  }
  function validateEvent(ev, where) {
    var w = where || "event";
    if (!isObj(ev)) return [w + ": not an object"];
    if (!isStr(ev.type)) return [w + ": no type"];
    var spec = EVENTS[ev.type];
    if (!spec) return [w + ": unknown type '" + ev.type + "'"];
    var out = [];
    if (ev.t != null && !isNum(ev.t)) out.push(w + " " + ev.type + ".t: not a time");
    return payload(ev, spec, w + " " + ev.type, out);
  }

  function validate(obj, kind, opts) {
    switch (kind) {
      case "hymn": return validateHymn(obj);
      case "line": return validateLine(obj, "line", opts);
      case "note": return validateNote(obj, "note", opts);
      case "chord": return validateChord(obj);
      case "performance": return validatePerformance(obj, opts && opts.hymn);
      case "event": return validateEvent(obj);
    }
    return ["validate: no kind '" + kind + "'"];
  }

  // ==========================================================================
  // THE CLERK'S COPY — JSON, and whether a Score survives it
  // ==========================================================================
  function toJSON(obj) { return JSON.stringify(obj); }
  function fromJSON(text, kind, opts) {
    var obj = JSON.parse(text);
    var problems = kind ? validate(obj, kind, opts) : [];
    return { score: obj, problems: problems };
  }
  // what JSON would lose or change: an undefined (dropped), a function or a
  // node (dropped), NaN and ±Infinity (null), a Date (a string), a cycle
  function roundTrip(obj) {
    var problems = [], seen = [];
    function walk(x, path) {
      if (x === null || typeof x === "string" || typeof x === "boolean") return;
      if (typeof x === "number") { if (!isFinite(x)) problems.push(path + ": " + x + " becomes null"); return; }
      if (x === undefined) { problems.push(path + ": undefined is dropped"); return; }
      if (typeof x === "function") { problems.push(path + ": a function is dropped"); return; }
      if (typeof x !== "object") { problems.push(path + ": a " + typeof x + " is not JSON"); return; }
      if (seen.indexOf(x) >= 0) { problems.push(path + ": a cycle"); return; }
      // a plain object's prototype is an Object.prototype — this realm's or
      // another's (a vm context, an iframe: round 2, the critic) — or none
      var proto = Object.getPrototypeOf(x);
      if (!Array.isArray(x) && proto !== null && Object.getPrototypeOf(proto) !== null) { problems.push(path + ": not a plain object"); return; }
      seen.push(x);
      if (Array.isArray(x)) x.forEach(function (y, i) { walk(y, path + "[" + i + "]"); });
      else Object.keys(x).forEach(function (k) { walk(x[k], path + "." + k); });
      seen.pop();
    }
    walk(obj, "score");
    if (!problems.length) {
      var back = JSON.parse(JSON.stringify(obj));
      if (!same(obj, back)) problems.push("score: reads back differently");
    }
    return { ok: !problems.length, problems: problems };
  }
  function same(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) if (!has(b, ka[i]) || !same(a[ka[i]], b[ka[i]])) return false;
    return true;
  }

  // ==========================================================================
  // THE READER'S HELPS
  // ==========================================================================
  // a line's length in beats: where its last note in any part ends
  function lineLength(l) {
    var end = 0;
    if (!l || !isObj(l.notes)) return 0;
    for (var p in l.notes) {
      var arr = l.notes[p] || [];
      for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].beat + arr[i].beats > end) end = arr[i].beat + arr[i].beats;
    }
    return end;
  }
  // the chord that stands at beat b of a line (read off by beat, §5), or null
  function chordAt(l, b) {
    var cs = (l && l.chords) || [];
    for (var i = cs.length - 1; i >= 0; i--) if (cs[i].beat <= b + EPS && b < cs[i].beat + cs[i].len - EPS) return cs[i];
    return null;
  }
  // Every note of a hymn laid out in time — seconds from the Score's own
  // start (§4), at the hymn's beat (or opts.beatS): the verse's lines, then
  // the refrain's. A line begins at its startBeat when it names one (the
  // Earth tunes do: a rest between lines is no Note), else where the one
  // before it ended.
  //   → [{ line, refrain, part, index, note, beat (from the Score's start), t, dur }]
  function timeline(h, opts) {
    opts = opts || {};
    var beatS = opts.beatS || h.beatS || 1, out = [], at = 0;
    var all = (h.lines || []).map(function (l, i) { return { l: l, i: i, refrain: false }; })
      .concat((h.refrain || []).map(function (l, i) { return { l: l, i: i, refrain: true }; }));
    all.forEach(function (x) {
      var start = x.l.startBeat != null ? x.l.startBeat : at;
      for (var p in x.l.notes) {
        (x.l.notes[p] || []).forEach(function (n, k) {
          var b = start + n.beat;
          out.push({ line: x.i, refrain: x.refrain, part: p, index: k, note: n, beat: b, t: b * beatS, dur: n.beats * beatS });
        });
      }
      at = start + lineLength(x.l);
    });
    out.sort(function (a, b) { return a.t - b.t || PARTS.indexOf(a.part) - PARTS.indexOf(b.part); });
    return out;
  }
  // the notes sounding at t seconds (a note sounds on [t, t + dur))
  function notesAt(h, t, opts) {
    return timeline(h, opts).filter(function (e) { return e.t <= t + EPS && t < e.t + e.dur - EPS; });
  }
  // the melody's syllables in order, and the verse's words set under them:
  //   → [{ line, refrain, index, syl, beat, text }]
  function syllableMap(h, verse) {
    var out = [], v = (h.verses && h.verses[verse || 0]) || null;
    [[h.lines || [], false], [h.refrain || [], true]].forEach(function (pair) {
      pair[0].forEach(function (l, li) {
        var mel = (l.notes && l.notes[h.melodyPart]) || [];
        mel.forEach(function (n, k) {
          if (n.syl === null || n.syl === undefined) return;
          out.push({ line: li, refrain: pair[1], index: k, syl: n.syl, beat: n.beat, text: v && !pair[1] ? (v[n.syl] != null ? v[n.syl] : null) : null });
        });
      });
    });
    return out;
  }

  // ==========================================================================
  // THE CHORD BOOK (round 2, milestone 2)
  // ==========================================================================
  // Why a book. The choir writes its verse half a minute ahead — two lines
  // harmonized in one turn, every chord placed at the time it will be sung.
  // Before round 2 the harmony engine remembered only the LAST chord it had
  // voiced, so while the congregation was still on the first line, the organ,
  // the harmonium, the strings and the deacon's chord-tone lean all read the
  // last chord of the second: a chord from the future. Now every chord that is
  // sung or played is written into the book at its own time, and "the current
  // chord" is a question asked of a time — what stands at t? — not of the
  // order in which the voices happened to write. The house keeps one book per
  // tuning (kolob-meeting.js, THE CHORD DESK); a composer or a lab may keep
  // books of its own.
  //
  // Entries are { t, chord, by }, kept in order of t; a chord written at the
  // same t as another stands after it (the later word wins).
  //   write(chord, t, by) → the chord's id (also set on the chord, so the
  //                         notes that follow it can say which chord it was)
  //   at(t)               → the chord that stands at t: the latest one
  //                         written at or before t — sounding, or still
  //                         ringing in the room after the voices breathe —
  //                         or null when nothing has been written yet
  //   reset()             → a clean page (a new meeting; a sunrise changes
  //                         the tuning): no chord of the old page leads the
  //                         new one, even one written for later
  // Only the last ten minutes are kept, and the chord standing before them.
  var KEEP_S = 600;
  function chordBook() {
    var entries = [];
    var nextId = 1;
    var page = 0;
    // the first index whose entry stands strictly after t
    function after(t) {
      var lo = 0, hi = entries.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (entries[mid].t <= t) lo = mid + 1; else hi = mid; }
      return lo;
    }
    function write(chordObj, t, by) {
      if (!chordObj) return null;
      if (chordObj.id == null) chordObj.id = nextId++;
      entries.splice(after(t), 0, { t: t, chord: chordObj, by: by || "" });
      // forget the far past, but keep the chord that stood at its edge
      var edge = after(t - KEEP_S) - 1;
      if (edge > 0) entries.splice(0, edge);
      return chordObj.id;
    }
    function at(t) {
      var i = after(t) - 1;
      return i >= 0 ? entries[i].chord : null;
    }
    function reset() { entries = []; page++; }
    return {
      write: write, at: at, reset: reset,
      page: function () { return page; },
      size: function () { return entries.length; },
    };
  }

  return {
    // the vocabulary
    PARTS: PARTS, MODES: MODES, PROVENANCE: PROVENANCE, DIALECTS: DIALECTS, CADENCES: CADENCES,
    PRACTICES: PRACTICES, QUALITIES: QUALITIES, EVENTS: EVENTS,
    // the shapes
    hymn: hymn, line: line, note: note, chord: chord, performance: performance,
    // the proofreader
    validate: validate, validateHymn: validateHymn, validateLine: validateLine, validateNote: validateNote,
    validateChord: validateChord, validatePerformance: validatePerformance, validateEvent: validateEvent,
    // the clerk's copy
    toJSON: toJSON, fromJSON: fromJSON, roundTrip: roundTrip,
    // the reader's helps
    lineLength: lineLength, chordAt: chordAt, timeline: timeline, notesAt: notesAt, syllableMap: syllableMap,
    monzoCents: monzoCents,
    // the chord book
    chordBook: chordBook,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-score.js"] = true;   // the load guard's roll call

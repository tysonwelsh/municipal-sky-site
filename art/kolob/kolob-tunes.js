// ============================================================================
// KOLOB — THE EARTH TUNES (a pure module: no audio, no DOM, no clock)
//
// The colony carried a hymnbook out to the rim of Kolob's light, and in the
// hymnbook were tunes older than the colony: the shape-note tunes of the
// Georgia singing conventions, the Yankee tunesmiths' fuging pieces, the
// Salt Lake psalmody of Careless and Beesley, a Shaker dancing song, a
// Methodist camp-meeting chorus. This file is that hymnbook's Earth section —
// every tune taken down again, note by note, from a public-domain printing
// (or, once, a manuscript) that anyone can open and check.
//
// It replaces v0.30's OLD_TUNES incipits (kolob-audio.js), which the owner
// heard in the tune lab and judged wrong. Those were drafted from hymnary.org
// incipit digits with guessed rhythms; these are read off the facsimiles,
// every part the source prints, with the source's own rhythm, meter,
// fermatas and repeats (written out, since a Hymn has no repeat signs).
//
// SHAPE OF THE DATA (SCORE.md §5): each tune is a Hymn with provenance
// "earth", a cited source {book, year, page, url}, keyMonzo [0,0,0,0] (a tune
// is stored relative to its own do; the performer puts it on the day's key),
// lines of Notes per part, cadences, chords where the parts make them
// unambiguous, and verses: [] (Kolob sings no English; the Deseret work will
// underlay texts later). Dev-only fields ride along and are never rendered in
// the app: nameEn, notes (the transcriber's uncertainties), crossCheck, and
// engrave (the source's own key, clefs and staff order, so the lab can
// engrave a tune the way its facsimile looks). Note.src is the pitch as the
// source writes it ("C#5"); Line.barStart is the metric position of the
// line's beat 0 within its bar, and Line.startBeat where the line begins
// (rests between lines are not Notes, so a performer needs this).
//
// HOW A TUNE IS WRITTEN DOWN HERE: each part is a string of tokens, one per
// note, in the source's own spelling —
//     G4:1   C5:2   E5:.5   _C5   D5:3^   B4~   r:1   |   /
// letter + accidental (# b n, as printed) + octave, then ":" + length in
// beats (the time signature's denominator unit; if omitted, the last length
// is kept). "@k" restarts the count for a written-out repeat that goes back
// to a pickup of k beats. "_" before a note: a slurred continuation (no new syllable).
// "^" after: fermata. "~" after: tied into the next note. "r" is a rest.
// "|" is a barline (checked: it must fall on a bar boundary). "/" ends a
// poetic line (every part must break at the same beat). Pitches are written
// as printed; a part's `shift` (in octaves) moves it to where it sounds —
// the shape-note tenor, printed in the treble clef, sounds an octave down.
//
// Degrees: deg 0 is the tune's final (do for the major tunes, la for the
// minor ones, which are therefore "aeolian" or "dorian"), placed in the
// octave F3–E4 so that deg 0 sits about where the day's keynote does.
// Monzos are exact 5-limit ratios from the v0.30 collections (SCORE §2); an
// accidental in the source becomes the chromatic neighbour of the next
// degree (a sharp is 15/16 of the degree above it, a flat 16/15 of the one
// below: so the raised seventh of a minor tune is 15/8, a sharped fourth
// 45/32, a flatted seventh 16/9). Note.alt says so (+1 raised, -1 lowered,
// against the key): the degree alone cannot, because the chromatic
// semitone is not a comma.
//
// THE COMMAS. A fixed table of degrees cannot tune every chord a hymn asks
// for: in C, the D that is a just fifth above G (9/8) is a comma too sharp
// to be a just fifth below A (10/9), so the ii chord D–F–A sounds a sour
// minor third and a wolf fifth; in a minor key the v chord's third does
// the same. A choir does not sing those: it leans the note a comma (81/80,
// about a fifth of a semitone) wherever the chord needs it. So does this
// file. After the chords are read, every onset in every line is tuned by a
// small search: each note that begins there may move a syntonic comma up
// or down, never more (so no drift and the spelling still holds, SCORE
// §2), and the choice that leaves the fewest sour fifths, thirds, sixths
// and comma-unisons among everything sounding — with the fewest moves and
// no comma jumps on a repeated note — wins. A note already sounding is
// held where it began. Note.comma records the move (-1, 0, +1); monzo is
// the pitch that sounds. Hymn.tuning (dev) counts what it fixed.
//
// METER is a canonical string: a named meter where one fits (CM, CMD, LM,
// SM, 11s …), else the syllable counts as hymnals print them (pairs run
// together when both are single digits — "87.87D", "64.64.66.64" — and
// dotted when any count reaches ten — "10.6.10.6.8.8.8.6"), "D" for a
// doubled meter, "R" for a refrain, and "irregular" when stanzas differ.
// Hymn.lineSyllables (dev) carries the counts per line.
//
// Public surface: KOLOB.Tunes = { list, byId(id), old: {...}, problems, ratio }
// ============================================================================
var KOLOB = window.KOLOB = window.KOLOB || {};   // `var`, so it also loads under Node
KOLOB.Tunes = (function () {
  "use strict";

  // ---- the lattice (5-limit, v0.30's collections, as monzos) ---------------
  // [a,b,c,d] = 2^a · 3^b · 5^c · 7^d
  var M = {
    "1": [0, 0, 0, 0], "9/8": [-3, 2, 0, 0], "5/4": [-2, 0, 1, 0], "6/5": [1, 1, -1, 0],
    "4/3": [2, -1, 0, 0], "3/2": [-1, 1, 0, 0], "5/3": [0, -1, 1, 0], "8/5": [3, 0, -1, 0],
    "15/8": [-3, 1, 1, 0], "16/9": [4, -2, 0, 0]
  };
  var SCALES = {
    ionian:     ["1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    mixolydian: ["1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian:     ["1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"],
    aeolian:    ["1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"]
  };
  var SHARP = [-4, 1, 1, 0];   // 15/16: a leading tone to the degree above
  var FLAT = [4, -1, -1, 0];   // 16/15: a leaning tone down to the degree below
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]; }
  function degMonzo(scale, deg) {
    var cls = ((deg % 7) + 7) % 7, oct = Math.floor(deg / 7);
    return add(M[SCALES[scale][cls]], [oct, 0, 0, 0]);
  }
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3]); }
  function cents(m) { return 1200 * Math.log(ratio(m)) / Math.LN2; }

  // ---- spelling -----------------------------------------------------------------
  var LET = "CDEFGAB";
  var SIG_SHARPS = "FCGDAEB", SIG_FLATS = "BEADGCF";
  function sigOf(sig) {               // "2#" → {F:1, C:1}; "3b" → {B:-1, E:-1, A:-1}; "" → {}
    var out = {};
    if (!sig) return out;
    var n = parseInt(sig, 10), sharp = sig.indexOf("#") >= 0;
    for (var i = 0; i < n; i++) out[(sharp ? SIG_SHARPS : SIG_FLATS)[i]] = sharp ? 1 : -1;
    return out;
  }
  function tonicStep(tonic) {          // the tonic's diatonic step, in the octave F3..E4
    var li = LET.indexOf(tonic);
    return (li >= 3 ? 3 : 4) * 7 + li;
  }

  // ---- the token reader -----------------------------------------------------
  var TOK = /^(_?)([A-G])([#bn]?)(-?\d)(?::(\d*\.?\d+))?([\^~]*)$/;
  var REST = /^r(?::(\d*\.?\d+))?([\^]*)$/;

  function parsePart(str, t, part, problems) {
    // → array of lines; each line = array of {beat, beats, src, step, alt, slur, fermata, tie}
    var sig = sigOf(t.key.sig), shift = (t.shift && t.shift[part]) || 0;
    var t0 = tonicStep(t.key.tonic);
    var barLen = t.barBeats, pos = -(t.pickup || 0);   // absolute metric position; 0 = first downbeat
    var lines = [[]], lineStarts = [pos], last = 1, bars = 0;
    var toks = str.replace(/\s+/g, " ").trim().split(" ");
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (!tk) continue;
      if (tk === "|" || tk === "||" || tk === ":|" || tk === "|:") {
        var r = ((pos % barLen) + barLen) % barLen;
        var lastTok = toks.slice(i + 1).join("").replace(/[|\/]/g, "") === "";
        var closesPickup = lastTok && Math.abs(r - (barLen - (t.pickup || 0))) < 1e-6;   // the final bar completes the pickup
        if (Math.abs(r) > 1e-6 && Math.abs(r - barLen) > 1e-6 && !closesPickup) {
          problems.push(t.slug + " " + part + ": barline at beat " + pos + " (bar " + (bars + 1) + ") is " + r + " into a bar");
        }
        bars++;
        continue;
      }
      if (tk === "/") { lines.push([]); lineStarts.push(pos); continue; }
      if (tk.charAt(0) === "@") {
        // a written-out repeat that goes back to a pickup: the new pickup of k
        // beats starts a fresh (incomplete) bar, as the singers take it
        var k = parseFloat(tk.slice(1)), into = ((pos % barLen) + barLen) % barLen;
        pos = pos - into + barLen - k;
        if (lines[lines.length - 1].length === 0) lineStarts[lineStarts.length - 1] = pos;
        continue;
      }
      var m = REST.exec(tk);
      if (m) {
        if (m[1]) last = parseFloat(m[1]);
        pos += last;
        continue;
      }
      m = TOK.exec(tk);
      if (!m) { problems.push(t.slug + " " + part + ": cannot read token '" + tk + "'"); continue; }
      if (m[5]) last = parseFloat(m[5]);
      var L = m[2], acc = m[3], oct = parseInt(m[4], 10);
      var step = oct * 7 + LET.indexOf(L) + shift * 7;
      var inSig = sig[L] || 0;
      var written = acc === "#" ? 1 : acc === "b" ? -1 : acc === "n" ? 0 : inSig;
      var alt = written - inSig;                  // alteration against the key signature
      lines[lines.length - 1].push({
        pos: pos, beats: last, src: L + acc + oct, deg: step - t0, alt: alt,
        slur: m[1] === "_", fermata: m[6].indexOf("^") >= 0, tie: m[6].indexOf("~") >= 0
      });
      pos += last;
    }
    if (lines.length > 1 && !lines[lines.length - 1].length) { lines.pop(); lineStarts.pop(); }   // a closing "/"
    return { lines: lines, starts: lineStarts, end: pos };
  }

  // ---- chords, read off the parts (only when the sonority is unambiguous) ------
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  function chordAt(notesByPart, beat, scale) {
    var cls = {}, n = 0, bass = null, voices = 0;
    for (var p in notesByPart) {
      var arr = notesByPart[p];
      for (var i = 0; i < arr.length; i++) {
        var nt = arr[i];
        if (nt.beat <= beat + 1e-6 && nt.beat + nt.beats > beat + 1e-6) {
          var c = ((nt.deg % 7) + 7) % 7;
          if (!cls[c]) { cls[c] = nt.monzo; n++; }
          if (bass === null || nt.deg < bass.deg) bass = nt;
          voices++;
        }
      }
    }
    // the shape-note close: every part on one letter, in unisons and
    // octaves. It names its degree and nothing else ("I8").
    if (n === 1 && voices >= 2) {
      var u = ((bass.deg % 7) + 7) % 7;
      return { roman: ROMAN[u] + "8", rootDeg: u, quality: "unison" };
    }
    if (n < 2) return null;
    var keys = Object.keys(cls).map(Number);
    for (var k = 0; k < keys.length; k++) {
      var r = keys[k], has = function (d) { return cls[(r + d) % 7] !== undefined; };
      var third = has(2), fifth = has(4), sev = has(6);
      var need = 1 + (third ? 1 : 0) + (fifth ? 1 : 0) + (sev ? 1 : 0);
      if (need !== n) continue;                    // a tone outside the stack: not unambiguous
      var bassCls = ((bass.deg % 7) + 7) % 7;
      // a bare third (the shape-note sound: root and third, no fifth) names a
      // chord only when the bass holds its root
      if (!fifth && !(third && n === 2 && bassCls === r)) continue;
      var iv = function (d) { return ((cents(cls[(r + d) % 7]) - cents(cls[r])) % 1200 + 1200) % 1200; };
      var q;
      if (!third && !sev) { if (bassCls !== r) continue; q = "open5"; }   // a bare fifth only over its root
      else if (!third) continue;
      else {
        var t3 = iv(2), t5 = fifth ? iv(4) : 702;
        if (t5 < 650 && t3 < 350) q = "dim";
        else if (t3 > 350) q = "maj";
        else q = "min";
        if (sev) {
          var t7 = iv(6);
          q = q === "maj" && t7 < 1050 ? "dom7" : q === "maj" ? "maj7" : q === "min" ? "min7" : "hdim7";
        }
      }
      var rn = ROMAN[r];
      if (q === "min" || q === "min7" || q === "dim" || q === "hdim7") rn = rn.toLowerCase();
      rn += q === "dim" ? "°" : q === "hdim7" ? "ø7" : q === "open5" ? "5" : (q === "dom7" || q === "min7" || q === "maj7") ? "7" : "";
      return { roman: rn, rootDeg: r, quality: q };
    }
    return null;
  }

  // ---- the builder: tune source → SCORE §5 Hymn --------------------------------
  function build(t, problems) {
    var parts = Object.keys(t.parts);
    t.barBeats = parseInt(t.time.split("/")[0], 10);
    var parsed = {}, nLines = null;
    parts.forEach(function (p) {
      parsed[p] = parsePart(t.parts[p], t, p, problems);
      if (nLines === null) nLines = parsed[p].lines.length;
      else if (parsed[p].lines.length !== nLines) problems.push(t.slug + " " + p + ": " + parsed[p].lines.length + " lines, expected " + nLines);
    });
    var mp = t.melody, mel = parsed[mp];
    parts.forEach(function (p) {
      for (var i = 0; i < nLines; i++) {
        if (Math.abs(parsed[p].starts[i] - mel.starts[i]) > 1e-6) problems.push(t.slug + " " + p + ": line " + (i + 1) + " starts at " + parsed[p].starts[i] + ", melody at " + mel.starts[i]);
      }
      if (Math.abs(parsed[p].end - mel.end) > 1e-6) problems.push(t.slug + " " + p + ": ends at " + parsed[p].end + ", melody at " + mel.end);
    });

    // the melody's high point, for Line.peak
    var hi = -99, hiLine = 0;
    mel.lines.forEach(function (ln, li) { ln.forEach(function (n) { if (n.deg > hi) { hi = n.deg; hiLine = li; } }); });

    var lines = [], syl = 0, refrainAt = t.refrainLine == null ? nLines : t.refrainLine;
    var pcs = {}, pcsAll = {};
    var tuning = { onsets: 0, sourBefore: 0, sourAfter: 0, moved: 0 };
    for (var li = 0; li < nLines; li++) {
      if (li === refrainAt) syl = 0;
      var start = mel.starts[li], notes = {}, fermataBeats = [];
      parts.forEach(function (p) {
        notes[p] = parsed[p].lines[li].map(function (n) {
          var mz = degMonzo(t.scale, n.deg);
          if (n.alt > 0) mz = add(degMonzo(t.scale, n.deg + 1), SHARP);
          if (n.alt < 0) mz = add(degMonzo(t.scale, n.deg - 1), FLAT);
          var beat = +(n.pos - start).toFixed(4);
          var inBar = ((n.pos % t.barBeats) + t.barBeats) % t.barBeats;
          var note = {
            beat: beat, beats: n.beats, deg: n.deg, monzo: mz, tie: n.tie, fermata: n.fermata,
            syl: null, stress: Math.abs(inBar) < 1e-6 ? 1 : 0, nct: null, ornament: null,
            alt: n.alt, comma: 0, src: n.src
          };
          var dc = ((n.deg % 7) + 7) % 7;
          if (!n.alt) pcsAll[dc] = true;
          if (p === mp) {
            if (!n.alt) pcs[dc] = true;
            if (n.fermata) fermataBeats.push(beat);
          }
          return note;
        });
      });
      // syllables: one per melody onset, except slurred continuations and tied-into notes
      var prevTie = false;
      parsed[mp].lines[li].forEach(function (n, k) {
        if (!n.slur && !prevTie) notes[mp][k].syl = syl++;
        prevTie = n.tie;
      });
      var ml = notes[mp], lastN = ml[ml.length - 1];
      var chords = [];
      if (parts.length >= 2 && t.chords !== false) {
        // a chord at every onset in any part (the sonority changes only there)
        var ons = {}, span = lastN ? lastN.beat + lastN.beats : 0;
        parts.forEach(function (p) { notes[p].forEach(function (n) { ons[n.beat] = true; }); });
        var times = Object.keys(ons).map(Number).sort(function (x, y) { return x - y; });
        times.forEach(function (b, k) {
          var len = +(((k + 1 < times.length ? times[k + 1] : span) - b)).toFixed(4);
          var ch = chordAt(notes, b, t.scale);
          if (!ch || len <= 0) return;
          var prev = chords[chords.length - 1];
          if (prev && prev.roman === ch.roman && Math.abs(prev.beat + prev.len - b) < 1e-6) prev.len = +(prev.len + len).toFixed(4);
          else chords.push({ beat: b, len: len, roman: ch.roman, rootDeg: ch.rootDeg, quality: ch.quality });
        });
      }
      var cad = (t.cadences && t.cadences[li]) || cadenceOf(chords, ml, parts.length, t.scale);
      if (parts.length >= 2) temper(notes, tuning);         // the commas (see the header)
      var line = {
        notes: notes,
        cadence: { kind: cad, beat: lastN ? lastN.beat : 0 },
        chords: chords,
        peak: li === hiLine,
        breathAfter: true,
        fermataBeats: fermataBeats,
        barStart: ((start % t.barBeats) + t.barBeats) % t.barBeats,
        startBeat: +(start - mel.starts[0]).toFixed(4)      // where the line begins, in beats from the tune's first note
      };
      if (t.lineNotes && t.lineNotes[li]) line.devNote = t.lineNotes[li];   // dev-only: what the lab should say above this line
      lines.push(line);
      if (t.syllables && t.syllables[li] != null) {
        var got = parsed[mp].lines[li].filter(function (n, k, arr) { return !n.slur && !(k > 0 && arr[k - 1].tie); }).length;
        if (got !== t.syllables[li]) problems.push(t.slug + ": line " + (li + 1) + " has " + got + " melody syllables, meter wants " + t.syllables[li]);
      }
    }

    // mode: the collection the whole tune needs, every part counted, so a
    // performer can fold to COLLECTIONS[mode] and lose nothing. A major tune
    // whose parts all avoid fa and ti is pentatonic; that avoid ti only,
    // hexatonic. melodyMode (dev) is the tune's own line alone: NEW BRITAIN's
    // melody is pentatonic although its treble sings fa.
    function modeOf(set) {
      if (t.scale !== "ionian") return t.scale;
      if (!set[3] && !set[6]) return "penta";
      if (!set[6]) return "hexa";
      return "ionian";
    }
    var mode = modeOf(pcsAll);
    var hymn = {
      id: "earth:" + t.slug,
      number: t.number,
      nameDs: t.nameDs,
      nameEn: t.nameEn,
      provenance: "earth",
      source: t.source,
      meter: t.meter,
      form: formOf(lines, mp, refrainAt),
      dialect: t.dialect,
      mode: mode,
      keyMonzo: [0, 0, 0, 0],
      modeOfTime: t.time,
      beatS: t.beatS,
      melodyPart: mp,
      lines: lines.slice(0, refrainAt),
      refrain: refrainAt < nLines ? lines.slice(refrainAt) : null,
      verses: [],
      // dev-only below: never rendered in the app
      melodyMode: modeOf(pcs),
      lineSyllables: t.syllables || null,
      tuning: tuning,
      crossCheck: t.crossCheck || [],
      notes: t.notes || "",
      engrave: { tonic: t.key.tonic, sig: t.key.sig || "", scale: t.scale, order: t.order || parts, clefs: t.clefs, shift: t.shift || {}, shapes: !!t.shapes, sourceKey: t.key.name }
    };
    return hymn;
  }

  // cadence: read from the last two chords the parts make; for a tune the
  // source gives as melody only, from where the melody comes to rest (an
  // implied cadence, and the tune's notes say so).
  //   · a bare fifth or a bare unison/octave on the final → "openfifth", the
  //     shape-note close, whatever came before it;
  //   · IV, ii or iiø7 → I: "plagal" (subdominant to tonic);
  //   · V, the leading-tone vii°, or a minor tune's subtonic VII → I:
  //     "authentic" when the melody lands on the final, else "imperfect";
  //   · ending on V: "half"; V → vi: "deceptive".
  // When the parts are there but the last sonority names no chord, the
  // melody-only guess is not trusted with "authentic".
  function cadenceOf(chords, mel, nParts, scale) {
    var last = mel[mel.length - 1];
    var lc = ((last.deg % 7) + 7) % 7;
    var at = -1;
    for (var i = 0; i < chords.length; i++) {
      if (chords[i].beat <= last.beat + 1e-6 && chords[i].beat + chords[i].len > last.beat + 1e-6) at = i;
    }
    if (at < 0) {
      if (lc === 0) return nParts >= 2 ? "imperfect" : "authentic";
      return (lc === 4 || lc === 1) ? "half" : "imperfect";
    }
    chords = chords.slice(0, at + 1);
    var z = chords[chords.length - 1], y = null;
    for (var k = chords.length - 2; k >= 0 && !y; k--) if (chords[k].rootDeg !== z.rootDeg) y = chords[k];   // the last change of harmony
    if (z.rootDeg === 0) {
      if (z.quality === "open5" || z.quality === "unison") return "openfifth";
      if (!y) return "imperfect";
      if (y.rootDeg === 3 || y.rootDeg === 1) return "plagal";
      var dominant = y.rootDeg === 4 || (y.rootDeg === 6 && (scale === "ionian" || y.quality === "maj" || y.quality === "dom7"));
      if (dominant) return lc === 0 ? "authentic" : "imperfect";
      return "imperfect";
    }
    if (z.rootDeg === 4) return "half";
    if (z.rootDeg === 5 && y && y.rootDeg === 4) return "deceptive";
    return "none";
  }

  // ---- the commas: adaptive just intonation, one onset at a time -----------
  var COMMA = [-4, 4, -1, 0];                          // 81/80, the syntonic comma
  function sourness(a, b) {                            // how sour the interval a–b sounds
    var d = [b[0] - a[0], b[1] - a[1], b[2] - a[2], b[3] - a[3]];
    var semi = Math.round((((cents(d) % 1200) + 1200) % 1200) / 100) % 12;
    var t3 = d[1], f5 = d[2];                          // the 3s and 5s: the 2s are only octaves
    switch (semi) {
      case 0: return (t3 === 0 && f5 === 0) ? 0 : 12;                   // a comma off the unison
      case 7: return (t3 === 1 && f5 === 0) ? 0 : 10;                   // 3/2, else the wolf 40/27
      case 5: return (t3 === -1 && f5 === 0) ? 0 : 10;                  // 4/3, else 27/20
      case 4: return (t3 === 0 && f5 === 1) ? 0 : 6;                    // 5/4, else 81/64
      case 8: return (t3 === 0 && f5 === -1) ? 0 : 6;                   // 8/5, else 128/81
      case 3: return (t3 === 1 && f5 === -1) ? 0 : 6;                   // 6/5, else 32/27
      case 9: return (t3 === -1 && f5 === 1) ? 0 : 6;                   // 5/3, else 27/16
    }
    return 0;                                          // seconds, sevenths, the tritone: no verdict
  }
  function temper(notesByPart, tally) {
    var all = [], byPart = {}, p, i;
    for (p in notesByPart) {
      byPart[p] = notesByPart[p];
      notesByPart[p].forEach(function (n, k) { all.push({ n: n, p: p, k: k, base: n.monzo }); });
    }
    var onsets = {};
    all.forEach(function (e) { onsets[e.n.beat] = true; });
    Object.keys(onsets).map(Number).sort(function (x, y) { return x - y; }).forEach(function (b) {
      var sounding = all.filter(function (e) { return e.n.beat <= b + 1e-6 && e.n.beat + e.n.beats > b + 1e-6; });
      var free = sounding.filter(function (e) { return Math.abs(e.n.beat - b) < 1e-6; });
      var held = sounding.filter(function (e) { return Math.abs(e.n.beat - b) >= 1e-6; });
      if (sounding.length < 2 || !free.length) return;
      tally.onsets++;
      var best = null, combos = Math.pow(3, free.length), c, j, s, score, before = null;
      for (c = 0; c < combos; c++) {
        var shift = [], x = c, moves = 0, melodic = 0;
        for (j = 0; j < free.length; j++) { shift.push((x % 3) - 1); x = Math.floor(x / 3); }
        var mz = held.map(function (e) { return e.n.monzo; });
        for (j = 0; j < free.length; j++) {
          s = shift[j];
          var m = s ? add(free[j].base, [COMMA[0] * s, COMMA[1] * s, COMMA[2] * s, 0]) : free[j].base;
          mz.push(m);
          if (s) moves += (free[j].n.deg % 7 === 0 ? 1.5 : 1);            // do (or la) moves last
          var prev = byPart[free[j].p][free[j].k - 1];                    // a comma jump on a repeated note
          if (prev && prev.deg === free[j].n.deg && prev.alt === free[j].n.alt &&
              Math.abs(prev.beat + prev.beats - b) < 1e-6 && (prev.monzo.join() !== m.join())) melodic += 3;
        }
        var sour = 0;
        for (i = 0; i < mz.length; i++) for (j = i + 1; j < mz.length; j++) sour += sourness(mz[i], mz[j]);
        if (c === Math.floor(combos / 2)) before = sour;                 // every shift 0: the fixed table
        score = sour + melodic + moves;
        if (!best || score < best.score - 1e-9) best = { score: score, shift: shift, sour: sour };
      }
      tally.sourBefore += before > 0 ? 1 : 0;
      tally.sourAfter += best.sour > 0 ? 1 : 0;
      for (j = 0; j < free.length; j++) {
        s = best.shift[j];
        if (!s) continue;
        free[j].n.monzo = add(free[j].base, [COMMA[0] * s, COMMA[1] * s, COMMA[2] * s, 0]);
        free[j].n.comma = s;
        tally.moved++;
      }
    });
  }

  // form: letters by melodic identity of lines (degrees + rhythm), A B A C …
  function formOf(lines, mp, refrainAt) {
    var seen = [], out = "";
    lines.forEach(function (ln, i) {
      var sigS = ln.notes[mp].map(function (n) { return n.deg + ":" + n.beats; }).join(",");
      var k = seen.indexOf(sigS);
      if (k < 0) { seen.push(sigS); k = seen.length - 1; }
      out += (i === refrainAt ? "|" : "") + String.fromCharCode(65 + k);
    });
    return out;
  }

  // ==========================================================================
  // THE TUNES
  // ==========================================================================
  var SOURCES = [];
  var IA = "https://archive.org/details/";
  // source.tuneName: the tune's name as the cited book prints it, where it is
  // not the name Kolob files it under
  function withName(src, name) { src.tuneName = name; return src; }
  var SH1844 = function (page) {          // B. F. White & E. J. King, Philadelphia, 1844 (first edition)
    return { book: "The Sacred Harp (B. F. White & E. J. King)", year: 1844, page: page,
             url: IA + "sacred-harp-1844-ki/page/n" + page + "/mode/1up" };
  };
  // the shape-note page: treble on top, the tune in the tenor (printed in the
  // treble clef, sung an octave down), the bass below; no alto in 1844.
  var HARP3 = { melody: "T", order: ["S", "T", "B"], clefs: { S: "treble", T: "treble8", B: "bass" },
                shift: { T: -1 }, shapes: true, dialect: "sacredharp" };
  function harp(o) { var k; for (k in HARP3) if (o[k] === undefined) o[k] = HARP3[k]; return o; }

  // The Salt Lake psalmody: Careless, Beesley, Daynes, Stephens and Griggs's
  // book "providing music for every hymn in the L.D.S. hymn book". Four
  // parts on three staves: the tenor on top (the old tenor clef, sung an
  // octave down), soprano and alto together, the bass below; tune numbered,
  // not paged.
  var LDS1889 = function (no, leaf) {
    return { book: "The Latter-day Saints' Psalmody (Careless, Beesley, Daynes, Stephens, Griggs)", year: 1889,
             page: "No. " + no, url: IA + "latterdaysaintsp1889chur/page/n" + (leaf - 1) + "/mode/1up" };
  };
  var PSALMODY = { melody: "S", order: ["T", "S", "A", "B"], clefs: { T: "treble8", S: "treble", A: "treble", B: "bass" },
                   shift: { T: -1 }, shapes: false, dialect: "tabernacle" };
  function psalmody(o) { var k; for (k in PSALMODY) if (o[k] === undefined) o[k] = PSALMODY[k]; return o; }

  // ---- ALL IS WELL ("Come, come, ye Saints") ----------------------------------
  // The pioneers' hymn, William Clayton's words (1846) to the camp-meeting
  // tune ALL IS WELL. The 1889 Psalmody prints it as No. 327 under its own
  // name for the tune, WINTER QUARTERS, set in A-flat and 3/4 with the
  // dotted "come, come, ye" and the fermatas of the LDS use.
  SOURCES.push(psalmody({
    slug: "all-is-well", nameEn: "ALL IS WELL", nameDs: "𐐫𐑊 𐐮𐑆 𐐶𐐯𐑊", number: 30,
    source: withName(LDS1889(327, 287), "WINTER QUARTERS"), meter: "10.6.10.6.8.8.8.6", time: "3/4", beatS: 0.62, pickup: 0,
    key: { tonic: "A", sig: "4b", name: "A-flat major" }, scale: "ionian",
    syllables: [10, 6, 10, 6, 8, 8, 8, 6],
    parts: {
      S: "A4:1 A4:.75 B4:.25 C5:.5^ A4:.5 | G4:.5 A4 B4 C5 D5:1^ | / C5:.75 A4:.25 B4:2 | A4:.75 G4:.25 A4:2 | / " +
         "A4:1 A4:.75 B4:.25 C5:.5^ A4:.5 | G4:.5 A4 B4 C5 D5:1^ | / C5:.75 A4:.25 B4:2 | A4:.75 G4:.25 A4:1^ / C5:.5 _D5:.5 | " +
         "E5:.5 E5 E5:1 _D5:.5 C5 | D5:.5 D5 D5:1 _C5:.5 / B4:.5 | C5 C5 E5:1 _D5:.5 C5 | B4 B4 B4:1.5 / E4:.5 | " +
         "A4 G4 A4:1.5 B4:.5 | C5 D5 E5:2 | / C5:.75 A4:.25 B4:2 | A4:.75 G4:.25 A4:2 |",
      A: "C4:1 C4:.75 D4:.25 E4:.5^ E4:.5 | E4:.5 E4 E4 E4 F4:1^ | / E4:.75 E4:.25 F4:2 | E4:.75 E4:.25 E4:2 | / " +
         "C4:1 C4:.75 D4:.25 E4:.5^ E4:.5 | E4:.5 E4 E4 E4 F4:1^ | / E4:.75 E4:.25 F4:2 | E4:.75 E4:.25 E4:1^ / A4:1 | " +
         "A4:.5 A4 E4:1.5 E4:.5 | E4:.5 E4 E4:1.5 / E4:.5 | E4 E4 E4:1.5 E4:.5 | E4 E4 E4:1.5 / E4:.5 | " +
         "E4 E4 E4:1.5 E4:.5 | E4 E4 E4:2 | / E4:.75 E4:.25 F4:2 | E4:.75 E4:.25 E4:2 |",
      T: "A4:1 A4:.75 A4:.25 A4:.5^ C5:.5 | B4:.5 F4 G4 A4 A4:1^ | / E5:.75 C5:.25 D5:2 | C5:.75 B4:.25 C5:2 | / " +
         "A4:1 A4:.75 A4:.25 A4:.5^ C5:.5 | B4:.5 F4 G4 A4 A4:1^ | / E5:.75 C5:.25 D5:2 | C5:.75 B4:.25 C5:1^ / A4:.5 B4 | " +
         "C5 C5 C5:1 _B4:.5 A4 | B4:.5 B4 B4:1 _A4:.5 / G4:.5 | A4 A4 C5:1 _B4:.5 A4 | G4 E4 G4:1.5 / G4:.5 | " +
         "A4 A4 C5:1.5 G4:.5 | A4 B4 C5:2 | / A4:.75 C5:.25 D5:2 | C5:.75 B4:.25 C5:2 |",
      B: "A2:1 A2:.75 A2:.25 A2:.5^ A2:.5 | E3:.5 E3 E3 A3 D3:1^ | / A2:.75 A2:.25 D3:2 | E3:.75 E3:.25 A2:2 | / " +
         "A2:1 A2:.75 A2:.25 A2:.5^ A2:.5 | E3:.5 E3 E3 A3 D3:1^ | / A2:.75 A2:.25 D3:2 | E3:.75 E3:.25 A2:1^ / A3:1 | " +
         "A3:.5 A3 A3:1.5 A3:.5 | G3:.5 G3 G3:1 _A3:.5 / E3:.5 | A3 A3 A3:1.5 A3:.5 | E3 E3 E3:1.5 / D3:.5 | " +
         "C3 B2 A2:1.5 E3:.5 | A3 A3 A3:2 | / A3:.75 A3:.25 D3:2 | E3:.75 E3:.25 A2:2 |"
    },
    crossCheck: [
      { book: "The Sacred Harp (White & King)", year: 1844, page: 122, url: IA + "sacred-harp-1844-ki/page/n122/mode/1up",
        note: "J. T. White's ALL IS WELL: the same tune family (the 'All is well!' refrain, the rising 'no toil nor labor fear'), but a different, longer shape-note setting in the tenor. The LDS form is the Psalmody's." }
    ],
    notes: "The 1889 Psalmody titles No. 327 WINTER QUARTERS, 'P. M.' [page 58 of the hymn book]: that is the book's own name for the tune (after the Saints' camp of 1846–47), and its melody is the LDS ALL IS WELL of 'Come, Come, Ye Saints'; Kolob keeps the name the Saints sing it by. " +
           "Fermatas on 'Saints', 'fear', 'you', 'appear' and 'day' are the source's. 'Tis is two slurred eighths (C–D♭). " +
           "The detector-assisted reading of the bass was checked bar by bar against the scan (it misreads staves next to lyric rows); the alto's rhythm in bars 9–13 follows the soprano's where the scan shows the same stems."
  }));

  // ---- NEW BRITAIN ------------------------------------------------------------
  // "Amazing grace." In 1844 it is in C and 3/4, three parts, and the second
  // half is sung twice (first and second endings), written out here.
  (function () {
    var T3 = "D5:.5 _E5 | G5:2 E5:.5 _D5 | C5:2 A4:.5 _G4 | C5:2 A4:.5 _G4 | G4:2 /";
    var S3 = "D5:1 | C5:2 C5:1 | E5:2 G5:1 | E5:2 E5:.5 D5:.5 | C5:2 /";
    var B3 = "G3:1 | C4:2 A3:1 | G3:2 E3:1 | G3:2 E3:.5 D3:.5 | C3:2 /";
    SOURCES.push(harp({
      slug: "new-britain", nameEn: "NEW BRITAIN", nameDs: "𐑌𐑏 𐐺𐑉𐐮𐐻𐐲𐑌", number: 45,
      source: SH1844(45), meter: "CM", time: "3/4", beatS: 0.55, pickup: 1,
      key: { tonic: "C", sig: "", name: "C major" }, scale: "ionian",
      syllables: [8, 6, 8, 6, 8, 6],
      parts: {
        S: "C5:1 | E5:2 E5:1 | G5:2 G5:1 | E5:2 E5:1 | D5:2 / D5:1 | E5:2 C5:.5 E5:.5 | G5:2 F5:.5 E5:.5 | D5:2 / " +
           S3 + " C5:1 | G4:2 C5:1 | E5:2 D5:1 | E5:2 / " + S3 + " C5:1 | G4:2 C5:1 | E5:2 D5:1 | E5:3 |",
        T: "G4:1 | C5:2 E5:.5 _C5 | E5:2 D5:1 | C5:2 A4:1 | G4:2 / G4:1 | C5:2 E5:.5 _C5 | E5:2 D5:.5 _E5 | G5:2 / " +
           T3 + " G4:1 | C5:2 E5:.5 _C5 | E5:2 D5:1 | C5:2 / " + T3 + " G4:1 | C5:2 E5:.5 _C5 | E5:2 D5:1 | C5:3 |",
        B: "C3:1 | C3:2 G3:1 | E3:2 G3:1 | C3:2 E3:1 | G3:2 / G3:1 | C3:2 G3:.5 A3:.5 | C4:2 A3:1 | G3:2 / " +
           B3 + " C3:1 | C3:2 E3:.5 G3:.5 | A3:2 G3:1 | C3:2 / " + B3 + " C3:1 | C3:2 E3:.5 G3:.5 | A3:2 G3:1 | C3:3 |"
      },
      notes: "1844 prints it in C (today's Sacred Harp has it in G) with no alto; the alto part in later books is a 1911 addition. " +
             "Lines 3–4 are printed once with first and second endings and a repeat mark after 'me!'; written out here, so six lines. " +
             "The 1844 tenor is more ornamented than the hymnal tune: 'but' and 'am' are A–G slurred eighths. Pentatonic melody (no fa, no ti)."
    }));
  })();

  // ---- KEDRON ----------------------------------------------------------------
  // "Thou Man of grief, remember me." Dare's Long Meter lament, E minor, 4/4,
  // downbeat start; the second half repeated.
  (function () {
    var S3 = "B4:2 B4:1 E5:1 | D5:2 E5:2 | B4:1 B4:1 D5:2 | / D5:2 D5:1 C5:1 | B4:2 G4:1.5 A4:.5 | B4:1 B4:1 B4:2 | / ";
    var T3 = "E5:2 D5:1 E5:1 | B4:2 G4:2 | D5:1 B4:1 A4:2 | / A4:2 B4:1 E4:1 | G4:2 B4:2 | G4:1 F#4:1 E4:2 | / ";
    var B3 = "E3:2 B3:1 B3:1 | G3:2 B3:2 | A3:1 G3:1 D3:2 | / D3:2 G3:1 G3:.5 F#3:.5 | E3:2 E3:2 | B2:1 B2:1 E3:2 | / ";
    SOURCES.push(harp({
      slug: "kedron", nameEn: "KEDRON", nameDs: "𐐿𐐨𐐼𐑉𐐲𐑌", number: 48,
      source: SH1844(48), meter: "LM", time: "4/4", beatS: 0.62, pickup: 0,
      key: { tonic: "E", sig: "1#", name: "E minor" }, scale: "aeolian",
      syllables: [8, 8, 8, 8, 8, 8],
      parts: {
        S: "B4:2 B4:1 B4:1 | G4:2 G4:2 | A4:1 C5:1 B4:2 | / B4:2 B4:1 B4:1 | B4:2 A4:2 | G4:1 E4:1 B4:2^ | / " + S3 + S3,
        T: "G4:1.5 _F#4:.5 E4:1 E4:1 | B4:2 B4:2 | A4:1 G4:1 F#4:2 | / G4:1.5 _F#4:.5 E4:1 E4:1 | E5:2 F#5:.5 _E5:1.5 | D5:1 C5:1 B4:2^ | / " + T3 + T3,
        B: "E3:2 E3:1 B2:1 | E3:2 E3:2 | D3:1 E3:1 B2:2 | / B2:2 E3:1 E3:1 | G3:2 D3:2 | G3:.5 F#3:.5 E3:1 B2:2^ | / " + B3 + B3
      },
      notes: "Credited to Dare (Elkanah Kelsay Dare; the tune is in Wyeth's Repository, Part Second, 1813). Aeolian: the tenor never raises D, and the only F# is the scale's own. " +
             "In 'pangs and' the 1844 plate prints a dot after each of the tenor's two half notes; two dotted halves cannot fit the 4/4 bar the other parts fill, so they are read as plain halves (a plate blemish or a hold mark). " +
             "Fermata at the end of line 2 in all parts. Lines 3–4 repeated (both endings a half note), written out."
    }));
  })();

  // ---- IDUMEA -----------------------------------------------------------------
  // "And am I born to die?" Davisson's minor tune (Kentucky Harmony, 1816), in
  // A minor and 3/2 (the half note is the beat). Second half repeated.
  (function () {
    var S3 = "A4:1 | C5:2 C5:.5 B4:.5 | A4:2 C5:.5 D5:.5 | E5:2 B4:.5 A4:.5 | G4:2 / G5:1 | E5:2 E5:.5 D5:.5 | C5:2 D5:1 | ";
    var T3 = "E5:1 | G5:2 E5:.5 _D5 | E5:2 D5:.5 _C5 | A4:2 G4:.5 _E4 | G4:2 / G4:1 | A4:2 G4:.5 _A4 | C5:2 D5:.5 _C5 | ";
    var B3 = "A3:1 | G3:2 A3:.5 B3:.5 | A3:2 E3:1 | A2:2 C3:1 | G3:2 / C3:1 | A2:2 C3:.5 D3:.5 | E3:2 E3:1 | ";
    SOURCES.push(harp({
      slug: "idumea", nameEn: "IDUMEA", nameDs: "𐐴𐐼𐐷𐐭𐑋𐐨𐐲", number: 47,
      source: SH1844(47), meter: "SM", time: "3/2", beatS: 0.7, pickup: 1,
      key: { tonic: "A", sig: "", name: "A minor" }, scale: "aeolian",
      syllables: [6, 6, 8, 6, 8, 6],
      parts: {
        S: "C5:1 | E5:2 D5:1 | C5:2 D5:1 | E5:2 / E5:1 | D5:2 E5:.5 D5:.5 | E5:2 D5:.5 C5:.5 | A4:2 / " + S3 + "E5:2 / " + S3 + "E5:3 |",
        T: "A4:1 | A4:2 G4:.5 _A4 | C5:2 D5:.5 _C5 | A4:2 / E5:1 | G5:2 E5:.5 _D5 | C5:2 D5:1 | E5:2 / " + T3 + "A4:2 / " + T3 + "A4:3 |",
        B: "A3:1 | A3:2 D3:1 | E3:2 E3:1 | A2:2 / A3:1 | G3:2 C4:.5 B3:.5 | A3:2 G3:1 | E3:2 / " + B3 + "A2:2 / " + B3 + "A2:3 |"
      },
      notes: "Aeolian throughout: no raised seventh anywhere in the three parts (G natural in 'spirit', in the bass at 'lay this'). " +
             "The treble divides at the close: 'un-' has D5 over G4 and the final chord E5 over A4; only the upper note is kept here. " +
             "The repeat mark after 'down' sends lines 3–4 round twice (first ending a whole note, second a dotted whole)."
    }));
  })();

  // ---- PISGAH -----------------------------------------------------------------
  // "Jesus, thou art the sinner's friend." J. C. Lowry's tune (Kentucky Harmony,
  // 1816); in 1844 in B-flat with a "Second Treble", so four parts. The verse,
  // then the soft strain "O Lord, remember me!" sung twice.
  SOURCES.push(harp({
    slug: "pisgah", nameEn: "PISGAH", nameDs: "𐐹𐐮𐑆𐑀𐐲", number: 58,
    source: SH1844(58), meter: "CM", time: "4/4", beatS: 0.5, pickup: 2,
    key: { tonic: "B", sig: "2b", name: "B-flat major" }, scale: "ionian",
    order: ["S", "A", "T", "B"], clefs: { S: "treble", A: "treble", T: "treble8", B: "bass" },
    parts: {
      S: "B4:1.5 D5:0.5 | F5:1 F5:1 F5:0.5 G5:0.5 F5:1 | D5:1 D5:1 D5:0.5 F5:0.5 / D5:1 | C5:1 C5:1 B4:1 G4:1 | B4:0.5 G4:0.5 F4:0.5 D4:0.5 F4:1 / F4:0.5 G4:0.5 | B4:1 B4:1 B4:1 G4:0.5 B4:0.5 | F4:1 F4:1 F4:1 / B4:1 | G5:1 F5:1 D5:1 G4:0.5 C5:0.5 | B4:3 / B4:0.5 D5:0.5 | F5:1 F5:1 F5:0.5 G5:0.5 F5:1 | D5:1.5 C5:0.5 D5:0.5 F5:0.5 / D5:1 | C5:1 C5:1 B4:1 G4:1 | B4:0.5 G4:0.5 F4:0.5 D4:0.5 F4:1 / F4:0.5 G4:0.5 | B4:1 B4:1 B4:1 G4:0.5 B4:0.5 | F4:1 F4:1 F4:1 / B4:1 | G5:1 F5:1 D5:1 G4:0.5 C5:0.5 | B4:3 / B4:0.5 D5:0.5 | F5:1 F5:1 F5:0.5 G5:0.5 F5:1 | D5:1.5 C5:0.5 D5:0.5 F5:0.5 / D5:1 | C5:1 C5:1 B4:1 G4:1 | B4:0.5 G4:0.5 F4:0.5 D4:0.5 F4:1 / F4:0.5 G4:0.5 | B4:1 B4:1 B4:1 G4:0.5 B4:0.5 | F4:1 F4:1 F4:1 / B4:1 | G5:1 F5:1 D5:1 G4:0.5 C5:0.5 | B4:2 |",
      A: "B4:1.5 G4:0.5 | F4:1 F4:0.5 G4:0.5 B4:1 B4:0.5 C5:0.5 | D5:1 D5:0.5 G5:0.5 F5:0.5 D5:0.5 / B4:1 | C5:1 C5:1 C5:1 D5:0.5 C5:0.5 | B4:0.5 C5:0.5 B4:0.5 G4:0.5 F4:1 / F4:0.5 G4:0.5 | B4:1 B4:1 B4:1 C5:1 | D5:1 D5:0.5 G5:0.5 F5:0.75 G5:0.25 / F5:0.5 D5:0.5 | B4:1 B4:1 C5:1 B4:0.5 C5:0.5 | D5:3 / B4:0.5 C5:0.5 | G4:1 G4:1 G4:0.5 F4:0.5 G4:1 | B4:1.5 C5:0.5 D5:0.5 F5:0.5 / D5:1 | C5:1 C5:1 C5:1 D5:0.5 C5:0.5 | B4:0.5 C5:0.5 B4:0.5 G4:0.5 F4:1 / F4:0.5 G4:0.5 | B4:1 B4:1 B4:1 C5:1 | D5:1 D5:0.5 G5:0.5 F5:0.75 G5:0.25 / F5:0.5 D5:0.5 | B4:1 B4:1 C5:1 B4:0.5 C5:0.5 | D5:3 / B4:0.5 C5:0.5 | G4:1 G4:1 G4:0.5 F4:0.5 G4:1 | B4:1.5 C5:0.5 D5:0.5 F5:0.5 / D5:1 | C5:1 C5:1 C5:1 D5:0.5 C5:0.5 | B4:0.5 C5:0.5 B4:0.5 G4:0.5 F4:1 / F4:0.5 G4:0.5 | B4:1 B4:1 B4:1 C5:1 | D5:1 D5:0.5 G5:0.5 F5:0.75 G5:0.25 / F5:0.5 D5:0.5 | B4:1 B4:1 C5:1 B4:0.5 C5:0.5 | D5:2 |",
      T: "F4:1.5 _G4:0.5 | B4:1 B4:1 B4:0.5 _C5:0.5 D5:0.5 _B4:0.5 | G4:1 G4:1 G4:0.5 _F4:0.5 / D4:1 | F4:1 F4:1 G4:1 B4:1 | D5:0.5 _C5:0.5 _B4:0.5 _D5:0.5 _C5:1 / B4:0.5 _D5:0.5 | F5:1 F5:1 F5:1 G5:0.5 _F5:0.5 | D5:1 D5:1 C5:1 / B4:1 | G4:1 B4:1 F4:1 G4:0.5 _A4:0.5 | B4:3 / F4:0.5 _G4:0.5 | B4:1 B4:1 B4:0.5 _C5:0.5 D5:0.5 _B4:0.5 | G4:1.5 _A4:0.5 _G4:0.5 _F4:0.5 / D4:1 | F4:1 F4:1 G4:1 B4:1 | D5:0.5 _C5:0.5 _B4:0.5 _D5:0.5 _C5:1 / B4:0.5 _D5:0.5 | F5:1 F5:1 F5:1 G5:0.5 _F5:0.5 | D5:1 D5:1 C5:1 / B4:1 | G4:1 B4:1 F4:1 G4:0.5 _A4:0.5 | B4:3 / F4:0.5 _G4:0.5 | B4:1 B4:1 B4:0.5 _C5:0.5 D5:0.5 _B4:0.5 | G4:1.5 _A4:0.5 _G4:0.5 _F4:0.5 / D4:1 | F4:1 F4:1 G4:1 B4:1 | D5:0.5 _C5:0.5 _B4:0.5 _D5:0.5 _C5:1 / B4:0.5 _D5:0.5 | F5:1 F5:1 F5:1 G5:0.5 _F5:0.5 | D5:1 D5:1 C5:1 / B4:1 | G4:1 B4:1 F4:1 G4:0.5 _A4:0.5 | B4:2 |",
      B: "F3:1.5 G3:0.5 | B3:1 D4:0.5 C4:0.5 B3:1 G3:0.5 F3:0.5 | D3:1 D3:1 D3:0.5 F3:0.5 / G3:1 | F3:1 F3:0.5 D3:0.5 B2:1 B2:0.5 C3:0.5 | D3:0.5 C3:0.5 D3:0.5 E3:0.5 F3:1 / F3:0.5 G3:0.5 | B3:1 B3:1 B3:1 G3:0.5 B3:0.5 | F3:1 F3:1 F3:1 / D3:0.5 F3:0.5 | G3:1 G3:0.5 F3:0.5 D3:1 C3:1 | B2:3 / F3:0.5 G3:0.5 | B3:1 D4:0.5 C4:0.5 B3:1 G3:0.5 F3:0.5 | D3:1.5 C3:0.5 D3:0.5 F3:0.5 / G3:1 | F3:1 F3:0.5 D3:0.5 B2:1 B2:0.5 C3:0.5 | D3:0.5 C3:0.5 D3:0.5 E3:0.5 F3:1 / F3:0.5 G3:0.5 | B3:1 B3:1 B3:1 G3:0.5 B3:0.5 | F3:1 F3:1 F3:1 / D3:0.5 F3:0.5 | G3:1 G3:0.5 F3:0.5 D3:1 C3:1 | B2:3 / F3:0.5 G3:0.5 | B3:1 D4:0.5 C4:0.5 B3:1 G3:0.5 F3:0.5 | D3:1.5 C3:0.5 D3:0.5 F3:0.5 / G3:1 | F3:1 F3:0.5 D3:0.5 B2:1 B2:0.5 C3:0.5 | D3:0.5 C3:0.5 D3:0.5 E3:0.5 F3:1 / F3:0.5 G3:0.5 | B3:1 B3:1 B3:1 G3:0.5 B3:0.5 | F3:1 F3:1 F3:1 / D3:0.5 F3:0.5 | G3:1 G3:0.5 F3:0.5 D3:1 C3:1 | B2:2 |"
    },
    crossCheck: [
      { book: "The Sacred Harp, 1991 Edition (Denson revision), digital score at shapenote.net", year: 1991, page: 58,
        url: "https://shapenote.net/musicxml/58.mxl",
        note: "Reading aid, transposed from A-flat to the 1844 B-flat. It agrees with the 1844 plate except in one tenor note, and 1844 is followed: in the first full bar of the soft strain ('O Lord, remember me!'), both times, the last quaver is a triangle (fa) on B-flat, where 1991 has C." }
    ],
    notes: "1844 labels the second staff 'Second Treble' (the alto): Pisgah is one of the few four-part pages in the first edition. " +
           "The second strain carries 'Soft.' and the words 'O Lord, remember me!' twice; it is printed once with a repeat and first/second endings (dotted half, then half), written out here. " +
           "Melisma underlay follows the 1844 text placement; slurs in the scan are sparse, so the long 'thee' and 'me!' groups are read from where the syllables sit."
  }));

  // ---- HOLY MANNA ---------------------------------------------------------------
  // "Brethren, we have met to worship." William Moore's tune (Columbian
  // Harmony, 1825), in C, 4/4. The first strain sung twice (two lines of text
  // under it), then the second half repeated with first and second endings.
  SOURCES.push(harp({
    slug: "holy-manna", nameEn: "HOLY MANNA", nameDs: "𐐸𐐬𐑊𐐮 𐑋𐐰𐑌𐐲", number: 59,
    source: SH1844(59), meter: "87.87D", time: "4/4", beatS: 0.5, pickup: 2,
    key: { tonic: "C", sig: "", name: "C major" }, scale: "ionian",
    syllables: [8, 7, 8, 7, 8, 7, 8, 7, 8, 7, 8, 7],
    parts: {
      S: "C5:1 C5:0.5 A4:0.5 | G4:1 G4:1 A4:1 G4:0.5 A4:0.5 | C5:0.5 D5:0.5 E5:0.5 D5:0.5 / C5:1 C5:0.5 A4:0.5 | G4:1 G4:1 E4:1 F4:1 | G4:2 / C5:1 C5:0.5 A4:0.5 | G4:1 G4:1 A4:1 G4:0.5 A4:0.5 | C5:0.5 D5:0.5 E5:0.5 D5:0.5 / C5:1 C5:0.5 A4:0.5 | G4:1 G4:1 E4:1 F4:1 | G4:4 | / C5:1 E5:1 E5:1 E5:1 | G5:1 G5:0.5 E5:0.5 D5:1 C5:1 | / C5:1 E5:1 E5:1 E5:1 | G5:1 G5:0.5 E5:0.5 G5:2^ | / C5:1 C5:0.5 D5:0.5 E5:1 E5:1 | F5:1 F5:0.5 E5:0.5 G5:0.5 E5:0.5 C5:1 | / C5:1 C5:0.5 D5:0.5 E5:1 E5:1 | G5:1 E5:0.5 D5:0.5 E5:2 | / C5:1 E5:1 E5:1 E5:1 | G5:1 G5:0.5 E5:0.5 D5:1 C5:1 | / C5:1 E5:1 E5:1 E5:1 | G5:1 G5:0.5 E5:0.5 G5:2^ | / C5:1 C5:0.5 D5:0.5 E5:1 E5:1 | F5:1 F5:0.5 E5:0.5 G5:0.5 E5:0.5 C5:1 | / C5:1 C5:0.5 D5:0.5 E5:1 E5:1 | G5:1 E5:0.5 D5:0.5 E5:2 |",
      T: "G4:1 G4:0.5 _A4:0.5 | C5:1 C5:1 D5:1 D5:0.5 _C5:0.5 | E5:0.5 _D5:0.5 C5:0.5 _A4:0.5 / G4:1 G4:0.5 _A4:0.5 | C5:1 C5:1 E5:1 D5:1 | C5:2 / G4:1 G4:0.5 _A4:0.5 | C5:1 C5:1 D5:1 D5:0.5 _C5:0.5 | E5:0.5 _D5:0.5 C5:0.5 _A4:0.5 / G4:1 G4:0.5 _A4:0.5 | C5:1 C5:1 E5:1 D5:1 | C5:4 | / E5:1 G5:1 G5:1 G5:1 | E5:1 E5:0.5 _C5:0.5 D5:1 C5:1 | / E5:1 G5:1 G5:1 G5:1 | E5:1 E5:0.5 _C5:0.5 D5:2^ | / G4:1 G4:0.5 _A4:0.5 C5:1 C5:1 | D5:1 D5:0.5 _C5:0.5 E5:0.5 _D5:0.5 C5:0.5 _A4:0.5 | / G4:1 G4:0.5 _A4:0.5 C5:1 C5:1 | E5:1 D5:1 C5:2 | / E5:1 G5:1 G5:1 G5:1 | E5:1 E5:0.5 _C5:0.5 D5:1 C5:1 | / E5:1 G5:1 G5:1 G5:1 | E5:1 E5:0.5 _C5:0.5 D5:2^ | / G4:1 G4:0.5 _A4:0.5 C5:1 C5:1 | D5:1 D5:0.5 _C5:0.5 E5:0.5 _D5:0.5 C5:0.5 _A4:0.5 | / G4:1 G4:0.5 _A4:0.5 C5:1 C5:1 | E5:1 D5:1 C5:2 |",
      B: "C3:1 C3:0.5 E3:0.5 | G3:1 G3:1 A3:1 G3:1 | C4:1 G3:1 / C3:1 C3:0.5 D3:0.5 | E3:1 G3:1 A3:1 G3:1 | C3:2 / C3:1 C3:0.5 E3:0.5 | G3:1 G3:1 A3:1 G3:1 | C4:1 G3:1 / C3:1 C3:0.5 D3:0.5 | E3:1 G3:1 A3:1 G3:1 | C3:4 | / G3:1 C4:1 C4:1 C4:1 | A3:1 G3:0.5 E3:0.5 C3:1 C3:1 | / G3:1 C4:1 C4:1 C4:1 | E3:1 D3:1 D3:2^ | / C3:1 C3:0.5 E3:0.5 G3:1 G3:1 | A3:1 G3:1 C4:1 G3:1 | / C3:1 C3:0.5 D3:0.5 E3:1 G3:1 | A3:1 G3:1 C3:2 | / G3:1 C4:1 C4:1 C4:1 | A3:1 G3:0.5 E3:0.5 C3:1 C3:1 | / G3:1 C4:1 C4:1 C4:1 | E3:1 D3:1 D3:2^ | / C3:1 C3:0.5 E3:0.5 G3:1 G3:1 | A3:1 G3:1 C4:1 G3:1 | / C3:1 C3:0.5 D3:0.5 E3:1 G3:1 | A3:1 G3:1 C3:2 |"
    },
    crossCheck: [
      { book: "The Sacred Harp, 1991 Edition (Denson revision), digital score at shapenote.net", year: 1991, page: 59,
        url: "https://shapenote.net/musicxml/59.mxl",
        note: "Same key; used as a reading aid. Treble, tenor and bass agree with the 1844 plate; the 1991 alto (a later addition) is left out." }
    ],
    notes: "Three parts in 1844 (no alto). The first strain is printed once with two lines of text stacked under it, so it is written out twice; it ends on a half note that the next pickup completes, as 1844 bars it (the 1991 book re-bars it as a whole note and a rest). " +
           "The second strain carries repeat dots and first and second endings, written out. The fermata on 'down' is printed on the 1844 plate in all three parts (and in 1991). " +
           "The tenor uses no fa or ti: a pentatonic tune."
  }));

  // ---- CORONATION ---------------------------------------------------------------
  // "All hail the power of Jesus' name." Oliver Holden's tune (Union Harmony,
  // 1793), the oldest American tune still in common use; in 1844 in A-flat,
  // four parts (an alto in the C clef). The trebles and basses alone take
  // "Bring forth the royal diadem" the first time; the tenor rests.
  SOURCES.push(harp({
    slug: "coronation", nameEn: "CORONATION", nameDs: "𐐿𐐫𐑉𐐬𐑌𐐩𐑇𐐲𐑌", number: 63,
    source: SH1844(63), meter: "CM", time: "4/4", beatS: 0.55, pickup: 2,
    key: { tonic: "A", sig: "4b", name: "A-flat major" }, scale: "ionian",
    order: ["S", "A", "T", "B"], clefs: { S: "treble", A: "treble", T: "treble8", B: "bass" },
    parts: {
      S: "A4:2 | C5:1 C5:1 E5:1 E5:1 | E5:1 E5:1 E5:1 / E5:1 | E5:1 C5:1 A4:1 B4:1 | C5:3 B4:1 | C5:1 B4:1 A4:1 C5:1 | E5:0.5 D5:0.5 C5:0.5 B4:0.5 C5:1 / C5:1 | C5:2 C5:2 | D5:2 B4:2 | B4:3 / C5:1 | C5:1 E5:1 E5:1 E5:1 | E5:1 E5:1 E5:1 / E5:1 | C5:2 A4:2 | A4:2 _B4:1 B4:1 | C5:4 |",
      A: "E4:2 | E4:1 E4:1 A4:1 A4:1 | G4:1 G4:1 G4:1 / A4:1 | G4:1 F4:1 E4:1 E4:1 | E4:3 r:1 | r:4 | r:2 r:1 / G4:1 | A4:2 A4:2 | A4:2 B4:1 A4:1 | G4:3 / A4:1 | A4:1 A4:1 A4:1 A4:1 | G4:1 G4:1 G4:1 / A4:1 | A4:2 F4:2 | E4:3 E4:1 | E4:4 |",
      T: "E4:2 | A4:1 A4:1 C5:1 C5:1 | C5:1 A4:1 B4:1 / B4:1 | B4:1 A4:1 C5:1 B4:1 | A4:3 r:1 | r:4 | r:2 r:1 / E5:1 | E5:2 E5:2 | F5:2 E5:1 _Dn5:1 | E5:3 / C5:1 | E5:1 C5:1 A4:1 C5:1 | B4:0.5 _A4:0.5 B4:0.5 _C5:0.5 B4:1 / A4:1 | E5:2 D5:2 | C5:1.5 _D5:0.5 _B4:1 B4:1 | A4:4 |",
      B: "A2:2 | A2:1 A2:1 A3:1 A3:1 | E3:1 E3:1 E3:1 / A3:1 | E3:1 F3:1 E3:1 E3:1 | A2:3 E3:1 | C3:1 E3:1 A3:1 A3:1 | C4:0.5 B3:0.5 A3:0.5 G3:0.5 F3:1 / E3:1 | A3:2 A3:2 | F3:2 B2:2 | E3:3 / A3:1 | C4:1 C4:1 C4:1 A3:1 | E3:1 E3:1 E3:1 / A3:1 | A3:2 D3:2 | E3:3 E3:1 | A2:4 |"
    },
    crossCheck: [
      { book: "The Sacred Harp, 1991 Edition (Denson revision), digital score at shapenote.net", year: 1991, page: 63,
        url: "https://shapenote.net/musicxml/63.mxl",
        note: "Reading aid (in G; transposed). The 1991 book differs from the 1844 plate in six places, and 1844 is followed each time. Treble: the opening pickup (A-flat, not C), 'Bring' (C), 'crown him' (C–A-flat) and 'Lord of' (A-flat–B-flat). Tenor: 'of Je-sus' name, Let' is C–A-flat–B-flat, B-flat (a square, a triangle, two ovals), where 1991 has B-flat–A-flat–B-flat, C. Bass: 'Bring forth the royal' ends on the low B-flat, where 1991 has the octave above." }
    ],
    notes: "1844 prints the second strain once (no repeat); the 1991 book repeats it. The tenor's rests in 'Bring forth the royal diadem' are the source's, so the melody part has no syllables there. " +
           "The 1844 alto is in a C clef; read as sounding in the treble octave, as the shapes (fa, la, mi) require. The tenor's D-natural in 'Lord of' is printed in 1844 (a natural sign): the raised fourth, leaning up to the dominant, stored as 45/32 with alt +1. " +
             "Proofed round 2 against the 1844 plate part by part, shape and staff position together: no fermatas, no repeat marks."
  }));

  // ---- WONDROUS LOVE --------------------------------------------------------------
  // "What wondrous love is this, O my soul." The Southern Harmony tune (1840),
  // in 1844 a three-part minor song in G with two flats, 4/4. The only tune
  // here built on a ballad meter of its own: 12.9.6.6.12.9.
  SOURCES.push(harp({
    slug: "wondrous-love", nameEn: "WONDROUS LOVE", nameDs: "𐐶𐐲𐑌𐐼𐑉𐐲𐑅 𐑊𐐲𐑂", number: 159,
    source: SH1844(159), meter: "12.9.6.6.12.9", time: "4/4", beatS: 0.5, pickup: 2,
    key: { tonic: "G", sig: "2b", name: "G minor" }, scale: "aeolian",
    syllables: [12, 9, 6, 6, 12, 9],
    parts: {
      S: "D5:2 | D5:1 D5:1 D5:1 C5:1 | D5:2 C5:1 C5:1 | B4:2 G4:1 B4:1 | A4:2 / D5:2 | D5:1 C5:1 D5:1 F5:1 | G5:2 F5:1 F5:1 | D5:4 | r:2 / F5:2 | D5:1 C5:1 B4:1 C5:1 | D5:2^ / D5:2 | B4:1 G4:1 B4:1 D5:1 | G5:2 / G5:2 | D5:1 D5:1 D5:1 C5:1 | D5:2 C5:1 C5:1 | B4:2 G4:1 B4:1 | A4:2 / D5:2 | D5:1 C5:1 D5:1 F5:1 | G5:2 F5:1 F5:1 | D5:4 |",
      T: "G4:2 | G4:1 F4:1 A4:1 C5:1 | D5:2 C5:1 A4:1 | G4:2 G4:1 F4:1 | A4:2 / D5:2 | F5:1 E5:1 D5:1 C5:1 | D5:2 C5:1 A4:1 | G4:4 | r:2 / C5:2 | D5:1 C5:1 D5:1 F5:1 | G5:2^ / G5:2 | F5:1 D5:1 D5:0.5 _C5:0.5 A4:1 | G4:2 / G4:2 | G4:1 F4:1 A4:1 C5:1 | D5:2 C5:1 A4:1 | G4:2 G4:1 F4:1 | A4:2 / D5:2 | F5:1 E5:1 D5:1 C5:1 | D5:2 C5:1 A4:1 | G4:4 |",
      B: "G3:2 | D3:1 D3:1 D3:1 F3:1 | G3:2 F3:1 F3:1 | G3:2 G3:1 F3:1 | D3:2 / G3:2 | B3:1 A3:1 G3:1 F3:1 | G3:2 F3:1 D3:1 | G3:4 | r:2 / F3:2 | G3:1 G3:1 B3:1 A3:1 | G3:2^ / D4:2 | B3:1 G3:1 F3:1 D3:1 | G3:2 / G3:2 | D3:1 D3:1 D3:1 F3:1 | G3:2 F3:1 F3:1 | G3:2 G3:1 F3:1 | D3:2 / G3:2 | B3:1 A3:1 G3:1 F3:1 | G3:2 F3:1 D3:1 | G3:4 |"
    },
    crossCheck: [
      { book: "The Sacred Harp, 1991 Edition, 'as written' digital score at shapenote.net", year: 1991, page: 159,
        url: "https://shapenote.net/musicxml/159a.mxl",
        note: "Reading aid, transposed from F minor to the 1844 G minor. Its notes agree with the 1844 plate; it has no fermata, where 1844 prints one over 'this!' in all three parts." }
    ],
    notes: "Aeolian as printed: the tenor's E in 'O my soul' (bars 5 and 17) is a fa, E-flat, in the 1844 plate. Singers have long raised it (the Dorian sixth), but the book does not; Kolob plays what is printed. " +
           "No alto in 1844 (the later alto is left out). The treble's opening note is divided (D over G), and the bass divides (G over low G) at the ends of the 'O my soul' lines; the upper notes are kept. " +
             "The fermata over 'this!' (the end of line 3, just before 'That caused the Lord of bliss') is printed in all three parts on the 1844 plate, p. 159."
  }));

  // ---- BEACH SPRING ------------------------------------------------------------------
  // "Come, ye sinners, poor and wretched." B. F. White's own tune, in A and
  // 4/4, three parts. Each strain carries a repeat: the first for the second
  // pair of lines, the second for the chorus-like close. Written out.
  SOURCES.push(harp({
    slug: "beach-spring", nameEn: "BEACH SPRING", nameDs: "𐐺𐐨𐐽 𐑅𐐹𐑉𐐮𐑍", number: 81,
    source: SH1844(81), meter: "87.87D", time: "4/4", beatS: 0.5, pickup: 2,
    key: { tonic: "A", sig: "3#", name: "A major" }, scale: "ionian",
    syllables: [8, 7, 8, 7, 8, 7, 8, 7, 8, 7, 8, 7],
    parts: {
      S: "A4:1 C5:1 | E5:2 E5:2 | F5:1 F5:1 E5:2 | C5:2 / A4:1 C5:1 | C5:2 E5:2 | F5:1 E5:1 E5:2 | @2 / A4:1 C5:1 | E5:2 E5:2 | F5:1 F5:1 E5:2 | C5:2 / A4:1 C5:1 | C5:2 E5:2 | F5:1 E5:1 E5:2 | r:2 / E5:1 C5:1 | A4:2 A4:2 | C5:1 C5:1 F5:2 | E5:2 / A4:1 C5:1 | C5:2 E5:2 | E5:1 E5:1 C5:2 | / C5:1 E5:1 F5:2 | E5:2 F5:1 E5:1 | E5:1 C5:1 C5:2 | / A4:1 D5:1 C5:2 | E5:2 F5:1 E5:1 | E5:4 | r:2 / E5:1 C5:1 | A4:2 A4:2 | C5:1 C5:1 F5:2 | E5:2 / A4:1 C5:1 | C5:2 E5:2 | E5:1 E5:1 C5:2 | / C5:1 E5:1 F5:2 | E5:2 F5:1 E5:1 | E5:1 C5:1 C5:2 | / A4:1 D5:1 C5:2 | E5:2 F5:1 E5:1 | E5:4 |",
      T: "A4:1 A4:1 | B4:2 A4:2 | C5:1 C5:1 B4:1 _A4:1 | F4:2 / A4:1 A4:1 | F4:2 E4:2 | F4:1 A4:1 A4:2 | @2 / A4:1 A4:1 | B4:2 A4:2 | C5:1 C5:1 B4:1 _A4:1 | F4:2 / A4:1 A4:1 | F4:2 E4:2 | F4:1 A4:1 A4:2 | r:2 / A4:1 C5:1 | E5:2 E5:2 | F5:1 E5:1 C5:2 | A4:2 / A4:1 C5:1 | E5:2 A4:2 | C5:0.5 _B4:0.5 A4:1 F4:2 | / F5:1 E5:1 C5:2 | A4:2 C5:1 C5:1 | B4:1 _A4:1 F4:2 | / A4:1 A4:1 F4:2 | E4:2 F4:1 A4:1 | A4:4 | r:2 / A4:1 C5:1 | E5:2 E5:2 | F5:1 E5:1 C5:2 | A4:2 / A4:1 C5:1 | E5:2 A4:2 | C5:0.5 _B4:0.5 A4:1 F4:2 | / F5:1 E5:1 C5:2 | A4:2 C5:1 C5:1 | B4:1 _A4:1 F4:2 | / A4:1 A4:1 F4:2 | E4:2 F4:1 A4:1 | A4:4 |",
      B: "A3:1 A3:1 | E3:2 E3:2 | F3:1 F3:1 E3:2 | C3:2 / A3:1 A3:1 | C3:2 E3:2 | F3:1 E3:1 A2:2 | @2 / A3:1 A3:1 | E3:2 E3:2 | F3:1 F3:1 E3:2 | C3:2 / A3:1 A3:1 | C3:2 E3:2 | F3:1 E3:1 A2:2 | r:2 / A3:1 F3:1 | E3:2 E3:2 | C3:1 E3:1 F3:2 | A3:2 / A3:1 A3:1 | E3:2 E3:2 | C3:1 E3:1 F3:2 | / A3:1 A3:1 F3:2 | E3:2 F3:1 F3:1 | E3:2 C3:2 | / A3:1 A3:1 C3:2 | E3:2 F3:1 E3:1 | A2:4 | r:2 / A3:1 F3:1 | E3:2 E3:2 | C3:1 E3:1 F3:2 | A3:2 / A3:1 A3:1 | E3:2 E3:2 | C3:1 E3:1 F3:2 | / A3:1 A3:1 F3:2 | E3:2 F3:1 F3:1 | E3:2 C3:2 | / A3:1 A3:1 C3:2 | E3:2 F3:1 E3:1 | A2:4 |"
    },
    crossCheck: [
      { book: "The Sacred Harp, 1991 Edition, digital score at shapenote.net", year: 1991, page: 81,
        url: "https://shapenote.net/musicxml/81t.mxl",
        note: "Same key; reading aid. The automatic notehead check of the 1844 plate matched every detected note but a handful of detector misreads, which were checked by eye." }
    ],
    notes: "Credited to B. F. White (the compiler) in 1844. Three parts; the later alto is left out. Both strains carry repeat marks and are written out, so the tune runs 8.7.8.7 twice over. " +
           "The second strain opens with a half rest in all parts. Melismas: 'wretch-(ed)' (B–A) and the eighth-note C–B in the second strain."
  }));

  // ---- THE PROMISED LAND ----------------------------------------------------------------
  // "On Jordan's stormy banks I stand." Miss M. Durham's minor tune, in 1844
  // in F-sharp minor, 4/4, three parts, the chorus "I am bound for the
  // promised land" joined to the common-meter verse.
  SOURCES.push(harp({
    slug: "promised-land", nameEn: "THE PROMISED LAND", nameDs: "𐑄 𐐹𐑉𐐱𐑋𐐮𐑅𐐻 𐑊𐐰𐑌𐐼", number: 128,
    source: SH1844(128), meter: "CMR", time: "4/4", beatS: 0.5, pickup: 0,
    key: { tonic: "F", sig: "3#", name: "F-sharp minor" }, scale: "aeolian",
    syllables: [8, 6, 8, 6, 8, 7, 8, 8],
    parts: {
      S: "C5:4 | C5:1 C5:1 C5:0.5 B4:0.5 A4:1 | B4:1 B4:1 B4:1 / E5:1 | C5:1 C5:1 C5:1 B4:0.5 A4:0.5 | C5:2 / C5:1.5 B4:0.5 | C5:1 C5:0.5 B4:0.5 A4:1 G4:1 | F4:1 F4:1 F4:1 / F4:0.5 G4:0.5 | A4:1 A4:0.5 B4:0.5 C5:1 C5:1 | C5:2 / C5:1.5 B4:0.5 | C5:1 C5:0.5 B4:0.5 C5:0.5 B4:0.5 A4:1 | / B4:1.5 C5:0.5 E5:1 E5:1 | C5:1 C5:0.5 B4:0.5 C5:0.5 B4:0.5 A4:1 | / C5:2 C5:1.5 B4:0.5 | C5:1 C5:0.5 B4:0.5 A4:1 G4:1 | F4:1 / F4:1 F4:1 F4:0.5 G4:0.5 | A4:1 A4:0.5 B4:0.5 C5:1 C5:1 | C5:4 |",
      T: "F4:4 | A4:1 A4:1 A4:0.5 _B4:0.5 C5:1 | B4:1 B4:1 B4:1 / G4:1 | A4:1 A4:1 A4:0.5 _B4:0.5 C5:1 | G4:2 / A4:1.5 _G4:0.5 | F4:1 F4:0.5 _G4:0.5 A4:1 B4:1 | C5:1 E5:1 C5:1 / C5:0.5 _B4:0.5 | A4:1 A4:0.5 _F4:0.5 G4:1 G4:1 | F4:2 / F4:1.5 G4:0.5 | A4:1 A4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:1 | / B4:1.5 _C5:0.5 _B4:0.5 _A4:0.5 G4:1 | A4:1 A4:0.5 G4:0.5 A4:0.5 B4:0.5 _C5:1 | / G4:2 A4:1.5 _G4:0.5 | F4:1 F4:0.5 G4:0.5 A4:1 B4:1 | C5:1 / F5:1 C5:1 C5:0.5 _B4:0.5 | A4:1 A4:0.5 _F4:0.5 G4:1 G4:1 | F4:4 |",
      B: "F3:4 | F3:1 F3:1 F3:1 F3:1 | E3:1 E3:1 E3:1 / C3:1 | F3:1 F3:1 F3:1 F3:1 | C3:2 / F3:1.5 G3:0.5 | A3:1 A3:0.5 G3:0.5 F3:1 E3:1 | F3:1 C3:1 A3:1 / A3:0.5 G3:0.5 | F3:1 F3:1 C3:1 C3:1 | F3:2 / F3:1.5 E3:0.5 | F3:1 F3:0.5 E3:0.5 F3:1 C3:1 | / E3:1.5 C3:0.5 E3:1 C3:1 | F3:1 F3:0.5 E3:0.5 E3:1 F3:1 | / C3:2 F3:1.5 G3:0.5 | A3:1 A3:0.5 G3:0.5 F3:1 E3:1 | F3:1 / C3:1 A3:1 A3:0.5 G3:0.5 | F3:1 F3:0.5 E3:0.5 C3:1 C3:1 | F3:4 |"
    },
    crossCheck: [
      { book: "The Sacred Harp, 1991 Edition, digital score at shapenote.net", year: 1991, page: 128,
        url: "https://shapenote.net/musicxml/128.mxl",
        note: "Same key; reading aid. It agrees with the 1844 plate except in one note, and 1844 is followed: the tenor's 'hap-py' in 'To Canaan's fair and happy land' is an oval (sol) in the E space, E, where 1991 has F-sharp (la). Where the phrase returns in the chorus, 1844 prints F-sharp (la) there, as 1991 does." }
    ],
    notes: "Minor, as in 1844 and still in the Sacred Harp (the major PROMISED LAND of later hymnals is Rigdon McIntosh's 1895 major arrangement, not this). The 1844 treble part is kept; the alto is later and is left out. " +
           "Underlay: the chorus melismas ('I'm' on four notes, 'land' on two) are placed where the syllable count requires; the plate's text is too small to confirm each slur. " +
             "The treble divides at 'land, I'm' (E over B); the upper note is kept. Proofed round 2 against the plate: no fermatas, no repeats."
  }));

  // ---- FOUNDATION ("How firm a foundation") --------------------------------------------
  // The pentatonic Southern tune the Saints sing to "How firm a foundation";
  // the 1844 Sacred Harp prints it as BELLEVUE (credited to Z. Chambless,
  // after Mercer's Cluster), with those very words, in B-flat, 4/4, 11s. The
  // second strain carries repeat dots, so "What more can he say" is sung
  // twice: six lines written out.
  (function () {
    var S2 = "r:2 / D5:2 | B4:2 B4:1 B4:1 | D5:2 D5:1 D5:1 | F5:2 C5:1 D5:1 | B4:2 / B4:2 | B4:2 G4:1 B4:1 | D5:2 D5:1 B4:1 | G4:2 F4:1 F4:1 | B4:4 | ";
    var T2 = "r:2 / D5:2 | F5:2 D5:1 F5:1 | B4:2 B4:1 B4:1 | D5:2 C5:1 D5:1 | F4:2 / F4:2 | B4:2 G4:1 B4:1 | F4:2 B4:1 B4:1 | D5:2 C5:1 C5:1 | B4:4 | ";
    var B2 = "r:2 / B3:2 | B3:2 B3:1 B3:1 | G3:2 G3:1 G3:1 | F3:2 F3:1 F3:1 | B2:2 / B2:2 | B2:2 E3:1 B2:1 | F3:2 B3:1 B3:1 | G3:2 F3:1 F3:1 | B2:4 | ";
    SOURCES.push(harp({
      slug: "foundation", nameEn: "FOUNDATION (BELLEVUE)", nameDs: "𐑁𐐵𐑌𐐼𐐩𐑇𐐲𐑌", number: 72,
      source: withName(SH1844(72), "BELLEVUE"), meter: "11s", time: "4/4", beatS: 0.5, pickup: 2,
      key: { tonic: "B", sig: "2b", name: "B-flat major" }, scale: "ionian",
      syllables: [11, 11, 11, 11, 11, 11],
      parts: {
        S: "B4:2 | B4:2 G4:1 B4:1 | D5:2 D5:1 B4:1 | B4:2 C5:1 B4:1 | D5:2 / B4:2 | B4:2 G4:1 B4:1 | D5:2 D5:1 B4:1 | G4:2 F4:1 F4:1 | B4:4 | " + S2 + S2.replace(/\| $/, "|"),
        T: "F4:2 | B4:2 G4:1 B4:1 | F4:2 B4:1 B4:1 | D5:2 C5:1 D5:1 | F4:2 / F4:2 | B4:2 G4:1 B4:1 | F4:2 B4:1 B4:1 | D5:2 C5:1 C5:1 | B4:4 | " + T2 + T2.replace(/\| $/, "|"),
        B: "B2:2 | B2:2 E3:1 B2:1 | F3:2 B3:1 B3:1 | G3:2 E3:1 F3:1 | B2:2 / B2:2 | B2:2 E3:1 B2:1 | F3:2 B3:1 B3:1 | G3:2 F3:1 F3:1 | B2:4 | " + B2 + B2.replace(/\| $/, "|")
      },
      crossCheck: [
        { book: "The Sacred Harp, 1991 Edition, BELLEVUE (72b), digital score at shapenote.net", year: 1991, page: 72,
          url: "https://shapenote.net/musicxml/72b.mxl",
          note: "Same key; reading aid. It agrees with the 1844 plate note for note, and marks the same repeat of the second strain (bars 10–18)." },
        { book: "Joseph Funk, A Compilation of Genuine Church Music (as PROTECTION)", year: 1835, page: 196,
          url: IA + "compilationofgen1835funk/page/n193/mode/1up",
          note: "The tune's earliest printings (Funk, 1832/1835) call it PROTECTION. Not transcribed here; listed so the owner can compare the older three-part setting." }
      ],
      notes: "v0.30 called this FOUNDATION; the 1844 book's name is BELLEVUE, and the words printed under it are 'How firm a foundation, ye saints of the Lord'. " +
             "Every staff of BELLEVUE carries two flats (B-flat major; the one-flat signature at the top of p. 72 belongs to THE WEARY SOULS, the tune above it). " +
             "The 1844 plate puts repeat dots at the start of the bar that holds the half rest and 'What more can he say', so lines 3–4 are sung twice; the repeat goes back to the rest, as the book bars it, and is written out. " +
             "Pentatonic tenor: no fa, no ti. Three parts; the later alto is left out."
    }));
  })();

  // ---- KINGSFOLD ----------------------------------------------------------------------
  // The house hymn ("If You Could Hie to Kolob", LDS #284, sings this tune).
  // An English folk melody of the Dives-and-Lazarus family; its first
  // hymnbook setting is Vaughan Williams's in The English Hymnal (1906),
  // No. 574, "I heard the voice of Jesus say", in E minor, minim beat, four
  // parts. The US edition is public domain (published before 1929).
  SOURCES.push({
    slug: "kingsfold", nameEn: "KINGSFOLD", nameDs: "𐐿𐐮𐑍𐑆𐑁𐐬𐑊𐐼", number: 574,
    source: { book: "The English Hymnal (ed. R. Vaughan Williams)", year: 1906, page: "No. 574",
              url: IA + "englishhymnalwit00unse/page/n779/mode/1up" },
    meter: "CMD", time: "4/2", beatS: 0.75, pickup: 1,
    key: { tonic: "E", sig: "1#", name: "E minor" }, scale: "aeolian",
    melody: "S", dialect: "tabernacle",
    order: ["S", "A", "T", "B"], clefs: { S: "treble", A: "treble", T: "bass", B: "bass" },
    syllables: [8, 6, 8, 6, 8, 6, 8, 6],
    parts: {
      S: "G4:.5 _F#4:.5 | E4:1 E4:1 E4:1 D4:1 | G4:1 G4:1 A4:1 / G4:.5 _A4:.5 | B4:1 B4:1 A4:.5 _G4:.5 E4:1 | D4:3 / G4:.5 _F#4:.5 | E4:1 E4:1 E4:1 D4:1 | G4:1 G4:1 A4:1 / G4:.5 _A4:.5 | B4:1 B4:1 A4:.5 _G4:.5 E4:1 | E4:3 / B4:.5 C5:.5 | D5:1 B4:1 B4:.5 _A4:.5 G4:1 | A4:1 A4:1 / B4:2 | B4:1 B4:.5 _A4:.5 G4:1 E4:1 | D4:3 / G4:.5 _F#4:.5 | E4:1 E4:1 E4:.5 _D4:.5 E4:.5 _F#4:.5 | G4:1 G4:1 A4:1 / G4:.5 _A4:.5 | B4:1 B4:1 A4:.5 _G4:.5 E4:1 | E4:3 |",
      A: "E4:1 | B3:1 B3:1 C4:1 A3:1 | D4:1 B3:1 D4:1 / D4:.5 F#4:.5 | G4:1 G4:1 E4:1 C4:1 | A3:3 / D4:1 | D4:1 C4:1 C4:.5 B3:.5 A3:1 | D4:1 C#4:1 D4:1 / D4:.5 Cn4:.5 | B3:1 D4:1 C4:1 C4:1 | B3:3 / E4:1 | F#4:1 F#4:1 G4:.5 D4:.5 D4:1 | E4:1 D4:1 / D4:2 | G4:1 G4:.5 F#4:.5 D4:1 C4:.5 B3:.5 | A3:3 / D4:1 | D4:1 D4:1 C4:1 C4:1 | D4:1 D4:.5 C#4:.5 D4:1 / D4:.5 Cn4:.5 | B3:1 D4:1 E4:1 C4:1 | B3:3 |",
      T: "B3:.5 A3:.5 | G3:1 G3:1 G3:1 F#3:1 | G3:1 G3:1 F#3:1 / G3:.5 C4:.5 | B3:1 D4:1 C4:1 G3:1 | G3:2 F#3:1 / G3:1 | G3:1 G3:1 G3:1 F#3:1 | G3:1 G3:1 F#3:1 / G3:.5 F#3:.5 | G3:1 G3:1 E3:1 E3:.5 F#3:.5 | G3:3 / G3:1 | B3:1 D4:1 D4:.5 C4:.5 B3:1 | A3:.5 G3:.5 F#3:1 / G3:2 | D4:1 D4:.5 C4:.5 B3:1 G3:1 | G3:2 F#3:1 / G3:1 | G3:1 G3:1 A3:1 C4:1 | B3:.5 A3:.5 G3:1 F#3:1 / G3:.5 F#3:.5 | G3:1 G3:1 E3:1 E3:.5 F#3:.5 | G3:3 |",
      B: "E3:1 | E3:1 E3:.5 D3:.5 C3:1 C3:1 | B2:1 E3:1 D3:1 / B2:.5 A2:.5 | G2:1 G2:1 A2:1 C3:1 | D3:3 / B2:1 | C3:1 C3:.5 B2:.5 A2:1 D3:1 | B2:1 E3:1 D3:.5 C3:.5 / B2:.5 A2:.5 | G2:1 B2:1 C3:1 A2:1 | E3:3 / E3:1 | B2:1 B3:1 E3:.5 F#3:.5 G3:1 | C3:1 D3:1 / G2:2 | G2:1 G2:.5 A2:.5 B2:1 C3:1 | D3:3 / B2:1 | C3:1 C3:.5 B2:.5 A2:1 A3:1 | G3:.5 F#3:.5 E3:1 D3:1 / B2:.5 A2:.5 | G2:1 B2:1 C3:1 A2:1 | E3:3 |"
    },
    notes: "English Hymnal prints no time signature ('In moderate time, minim = 80'); the bars hold four minims, so 4/2 here, with a minim upbeat. " +
           "The melody is Aeolian as printed (C natural in line 5); the alto's C-sharps in lines 4 and 8 are the only Dorian colour, and they are the harmoniser's. " +
           "The words are printed under the music only for the first verse's shape; the underlay here slurs every pair of crotchets (as the printed slurs show) and the upbeat. " +
           "Harmony read from a faint 1906 scan with a notehead detector and by eye, bar by bar; the least certain notes are the alto's last-line E4 (bar 15) and the bass's octave leap A2–A3 in bar 13. The alto's upbeat to line 1 is a minim E (on the bottom line, under the treble's G–F-sharp); the upbeats to lines 3 and 7 are D. " +
           "The final chord's small low E (organ, 'Org.') is left out. v0.30's incipit had the opening pitches (G F-sharp E E E D G) but no upbeat and even crotchets; the minim upbeat pair and the half-bar rhythm are restored."
  });

  // ---- GOD BE WITH YOU -----------------------------------------------------------------
  // J. E. Rankin's words, W. G. Tomer's tune (first printed in Gospel Bells,
  // 1880), here from Gospel Hymns No. 5 (1887; this printing 1888, No. 74),
  // in D-flat, 4/4, four parts on two staves. In the refrain the treble and
  // alto hold "meet" while the men echo "Till we meet!" under them; the
  // second time, everyone pauses (fermatas) before "God be with you" closes.
  (function () {
    var S_R = "F4:.75 Gb4:.25 | Ab4:1 _Db5 _F5 Eb5:.75 Db5:.25 | ";
    var A_R = "Db4:.75 Eb4:.25 | F4:2 _Ab4:1 Ab4:.75 Ab4:.25 | ";
    var T_R = "r:1 | r:1 Ab3:.5 Ab3 Db4:1 Db4:.75 Db4:.25 | ";
    var B_R = "r:1 | r:1 Db3:.5 Db3 Db3:1 F3:.75 F3:.25 | ";
    SOURCES.push({
      slug: "god-be-with-you", nameEn: "GOD BE WITH YOU", nameDs: "𐑀𐐱𐐼 𐐺𐐨 𐐶𐐮𐑄 𐐷𐐭", number: 74,
      source: { book: "Gospel Hymns No. 5, with Standard Selections (Sankey, McGranahan & Stebbins)", year: 1888,
                page: "No. 74", url: IA + "cihm_32900/page/n77/mode/1up" },
      meter: "98.89R", time: "4/4", beatS: 0.55, pickup: 0,
      key: { tonic: "D", sig: "5b", name: "D-flat major" }, scale: "ionian",
      melody: "S", dialect: "gospel",
      order: ["S", "A", "T", "B"], clefs: { S: "treble", A: "treble", T: "bass", B: "bass" },
      refrainLine: 4,
      syllables: [9, 8, 8, 9, 6, 7, 6, 9],
      lineNotes: {
        4: "Refrain: the treble and alto hold 'meet' while the tenor and bass echo 'Till we meet!' beneath them (the book's small men's words).",
        7: "The fermatas on the held 'meet' and on 'God' are the book's, in all four parts."
      },
      parts: {
        S: "F4:1.5 F4:.5 F4 F4 F4 F4 | Ab4:1 Eb4 F4 r:1 / " +
           "Bb4:1.5 Bb4:.5 Bb4 Bb4 Bb4 Bb4 | Bb4:2 Ab4:1 r:1 / " +
           "Ab4:1.5 Ab4:.5 Ab4 Ab4 Ab4 Ab4 | Ab4:2 F4:1 r:1 / " +
           "F4:1.5 F4:.5 Bb4 Ab4 Db4 Eb4 | F4:1 Eb4 Db4 / " +
           S_R + "Bb4:1 _Db5:2 / C5:.75 Bb4:.25 | Ab4:1.5 Bb4:.5 Ab4 _F4 Db4 _F4 | Eb4:3 / " +
           S_R + "Bb4:1 _Db5:2^ / Db5:.75^ Bb4:.25 | Ab4:.5 F4 Db4 Eb4 F4:1 Eb4 | Db4:3 r:1 |",
        A: "Db4:1.5 Db4:.5 Db4 Db4 Db4 Db4 | Db4:1 C4 Db4 r:1 / " +
           "Db4:1.5 Gb4:.5 Gb4 Gb4 Gb4 Gb4 | Gb4:2 F4:1 r:1 / " +
           "Eb4:1.5 Eb4:.5 Eb4 Eb4 Gb4 Gb4 | F4:2 Db4:1 r:1 / " +
           "Db4:1.5 Db4:.5 Gb4 F4 Db4 Db4 | Db4:1 C4 Db4 / " +
           A_R + "Gb4:1 _Bb4:2 / Ab4:.75 Gb4:.25 | F4:1.5 Gb4:.5 F4 Db4 Db4:1 | C4:3 / " +
           A_R + "Gb4:1 _Bb4:2^ / Gb4:.75^ Gb4:.25 | F4:.5 Db4 Db4 Db4 Db4:1 C4 | Db4:3 r:1 |",
        T: "Ab3:1.5 Ab3:.5 Ab3 Ab3 Ab3 Ab3 | Ab3:1 Ab3 Ab3 r:1 / " +
           "Gb3:1.5 Db4:.5 Db4 Db4 Db4 Db4 | Db4:2 Db4:1 r:1 / " +
           "C4:1.5 C4:.5 C4 C4 Eb4 Eb4 | Db4:2 Ab3:1 r:1 / " +
           "Ab3:1.5 Ab3:.5 Db4 Db4 Ab3 Bb3 | Ab3:1 Gb3 F3 / " +
           T_R + "Db4:1 Db4 Db4 / Db4:.75 Db4:.25 | Db4:1.5 Db4:.5 Db4 Ab3 F3 Ab3 | Ab3:1 Ab3:.5 Ab3 Ab3:1 / " +
           T_R + "Db4:1 Db4 Db4:1^ / Bb3:.75^ Db4:.25 | Db4:.5 Ab3 Ab3 Bb3 Ab3:1 Gb3 | F3:3 r:1 |",
        B: "Db3:1.5 Db3:.5 Db3 Db3 Db3 Db3 | F3:1 Ab3 Db3 r:1 / " +
           "Gb3:1.5 Gb3:.5 Gb3 Gb3 Gb3 Gb3 | Db3:2 Db3:1 r:1 / " +
           "Ab3:1.5 Ab3:.5 Ab3 Ab3 Ab2 Ab2 | Db3:2 Db3:1 r:1 / " +
           "Db3:1.5 Db3:.5 Db3 Db3 F3 Gb3 | Ab3:1 Ab2 Db3 / " +
           B_R + "Gb3:1 Gb3 Gb3 / Gb3:.75 Gb3:.25 | Db3:1.5 Db3:.5 Db3:1 Db3:1 | Ab2:1 Ab2:.5 Ab2 Ab2:1 / " +
           B_R + "Gb3:1 Gb3 Gb3:1^ / Gb3:.75^ Gb3:.25 | Db3:.5 Db3 F3 Gb3 Ab3:1 Ab2 | Db3:3 r:1 |"
      },
      crossCheck: [
        { book: "Gospel Bells (J. W. Bischoff, ed.), No. 50 — the first printing", year: 1880, page: 51,
          url: IA + "gospelbellscolle00bisc/page/n54/mode/1up",
          note: "Tomer's tune as first printed, in E-flat. Not compared note for note: the 1887 Gospel Hymns setting is the one Kolob keeps, and it is the one the later hymnals follow." }
      ],
      notes: "Four parts, as Gospel Hymns No. 5 prints them: treble and alto on the upper staff, tenor and bass on the lower, read bar by bar from the 400 dpi leaf with a pitch ruler. " +
             "In the refrain the upper voices hold 'meet' (the treble's slurred A-flat–D-flat–F, then B-flat–D-flat; the alto's F–A-flat, then G-flat–B-flat) while the tenor and bass answer 'Till we meet!' in quavers; the men rest on each 'Till we' pickup and sing 'feet' and 'meet a-gain' with the women. " +
             "The second held 'meet' and the following 'God' carry fermatas in the treble (above the staff) and in the men's staff (below it). " +
             "The cadences at 'meet a-gain' put the tenor and bass in unison on A-flat (the six-four) before the V7, as printed. " +
             "v0.30's incipit had nearly the right pitches but even rhythm; the tune's dotted 'God be' and the refrain's held, slurred 'meet' are restored."
    });
  })();

  // ---- BETHANY ---------------------------------------------------------------------------
  // "Nearer, my God, to thee." Lowell Mason's tune (1856), here from his own
  // Sabbath Hymn and Tune Book (1859), p. 244, in G, six crotchets to the bar,
  // four parts on two staves (soprano and alto above, tenor and bass below).
  SOURCES.push({
    slug: "bethany", nameEn: "BETHANY", nameDs: "𐐺𐐯𐑃𐐲𐑌𐐨", number: 244,
    source: { book: "The Sabbath Hymn and Tune Book (Lowell Mason et al.)", year: 1859, page: 244,
              url: IA + "sabbathhymntuneb00maso/page/n249/mode/1up" },
    meter: "64.64.66.64", time: "6/4", beatS: 0.42, pickup: 0,
    key: { tonic: "G", sig: "1#", name: "G major" }, scale: "ionian",
    melody: "S", dialect: "tabernacle",
    order: ["S", "A", "T", "B"], clefs: { S: "treble", A: "treble", T: "bass", B: "bass" },
    syllables: [6, 4, 6, 4, 6, 6, 6, 4],
    parts: {
      S: "B4:3 A4:2 G4:1 | G4:2 E4:1 E4:3 | / D4:3 G4:2 B4:1 | A4:3~ A4:2 r:1 | / " +
         "B4:3 A4:2 G4:1 | G4:2 E4:1 E4:3 | / D4:2 _G4:1 F#4:2 A4:1 | G4:3~ G4:2 r:1 | / " +
         "D5:3 E5:2 D5:1 | D5:2 B4:1 D5:3 | / D5:3 E5:2 D5:1 | D5:2 B4:1 A4:3 | / " +
         "B4:3 A4:2 G4:1 | G4:2 E4:1 E4:3 | / D4:2 _G4:1 F#4:2 A4:1 | G4:3~ G4:2 r:1 |",
      A: "D4:3 C4:2 B3:1 | E4:2 C4:1 C4:3 | / D4:3 D4:2 D4:1 | D4:3~ D4:2 r:1 | / " +
         "D4:3 C4:2 B3:1 | E4:2 C4:1 C4:3 | / B3:2 _D4:1 D4:2 D4:1 | D4:3~ D4:2 r:1 | / " +
         "G4:3 G4:2 G4:1 | G4:2 G4:1 G4:3 | / G4:3 G4:2 G4:1 | D4:2 D4:1 D4:3 | / " +
         "D4:3 C4:2 B3:1 | E4:2 C4:1 C4:3 | / B3:2 _D4:1 D4:2 D4:1 | D4:3~ D4:2 r:1 |",
      T: "G3:3 F#3:2 G3:1 | C4:2 G3:1 G3:3 | / B3:3 G3:2 G3:1 | F#3:3~ F#3:2 r:1 | / " +
         "G3:3 F#3:2 G3:1 | C4:2 G3:1 G3:3 | / G3:2 _B3:1 A3:2 C4:1 | B3:3~ B3:2 r:1 | / " +
         "B3:3 C4:2 B3:1 | B3:2 G3:1 B3:3 | / B3:3 C4:2 B3:1 | A3:2 G3:1 F#3:3 | / " +
         "G3:3 F#3:2 G3:1 | C4:2 G3:1 G3:3 | / G3:2 _B3:1 A3:2 C4:1 | B3:3~ B3:2 r:1 |",
      B: "G3:3 D3:2 E3:1 | C3:2 C3:1 C3:3 | / G2:3 B2:2 G2:1 | D3:3~ D3:2 r:1 | / " +
         "G3:3 D3:2 E3:1 | C3:2 C3:1 C3:3 | / D3:3 D3:2 D3:1 | G2:3~ G2:2 r:1 | / " +
         "G3:3 G3:2 G3:1 | G3:2 G3:1 G3:3 | / G3:3 C3:2 G3:1 | F#3:2 G3:1 D3:3 | / " +
         "G3:3 D3:2 E3:1 | C3:2 C3:1 C3:3 | / D3:3 D3:2 D3:1 | G2:3~ G2:2 r:1 |"
    },
    notes: "Four parts, as Mason prints them: soprano and alto on the treble staff, tenor and bass on the bass staff (the tenor sounds where it is written). Read bar by bar from the 2092×3550 archive.org leaf (and the 400 dpi PDF plate) with a pitch ruler. " +
           "The first chord of each 'Nearer, my God, to thee' line puts tenor and bass on the same G (one head, stems both ways). In 'That raiseth me' / 'Nearer to thee' every part slurs with the soprano (the alto B–D, the tenor G–B) over a bass that holds D: the cadential six-four, then the dominant. " +
           "Mason's own rhythm differs from later hymnals in 'That raiseth me' / 'Nearer to thee' at the line ends: a slurred half–quarter D–G, then F-sharp half, A quarter. The long last notes of lines 2, 4 and 8 are a dotted half tied to a half, then a crotchet rest, in all parts, as printed. " +
           "v0.30's incipit had the first line's pitches right (mi re do do la la sol) but a guessed rhythm; Mason's long-short-shorter 'Near-er, my' and the six-beat bars are restored."
  });

  // ---- NETTLETON (HALLELUJAH) ------------------------------------------------------------
  // "Come, thou fount of every blessing." First printed in Wyeth's Repository
  // of Sacred Music, Part Second (1813), p. 112, as HALLELUJAH; here from the
  // Missouri Harmony (1820), p. 72, which reprints Wyeth's two-part setting
  // (air in the tenor, and a bass) in F. The second strain is sung twice, the
  // second time to the camp-meeting chorus "Hallelujah! we are on our
  // journey home" that gives the tune its old name.
  (function () {
    var T1 = "A4:1 G4 F4:2 | A4:2 G4:1 F4 | G4:2 G4:2 | / A4:1 C5 D5:2 | C5:1.5 _Bb4:.5 A4:1 G4 | F4:3 r:1 | / ";
    var B1 = "D3:1 E3 F3:2 | D3:2 C3:1 Bb2 | C3:2 C3:2 | / F3:1 F3 G3:2 | A3:1.5 G3:.5 F3:1 C3 | F3:3 r:1 | / ";
    var T2 = "D5:1 E5 F5:2 | E5:2 D5:1 C5 | D5:2 A4:2 | / D5:1 E5 F5:2 | E5:2 D5:1 C5 | D5:2 / C5:1 A4 | " +
             "F4:2 A4:2 | G4:1 F4 G4:2 | G4:2 / A4:1 C5 | D5:2 C5:1.5 _Bb4:.5 | A4:1 G4 F4:2 | ";
    var B2 = "A3:1 G3 F3:2 | A3:2 G3:1 F3 | G3:2 A3:2 | / Bb3:1 G3 F3:2 | A3:2 D3:1 E3 | D3:2 / F3:1 F3 | " +
             "F3:2 F3:2 | C3:1 C3 C3:2 | C3:2 / F3:1 F3 | G3:2 A3:1.5 G3:.5 | F3:1 C3 F3:2 | ";
    SOURCES.push(harp({
      slug: "nettleton", nameEn: "NETTLETON (HALLELUJAH)", nameDs: "𐑌𐐯𐐻𐐲𐑊𐐻𐐲𐑌", number: 72,
      source: { book: "The Missouri Harmony (Allen D. Carden)", year: 1820, page: 72, tuneName: "HALLELUJAH",
                url: IA + "missouriharmonyo00card_0/page/n87/mode/1up" },
      meter: "87.87D", time: "4/4", beatS: 0.42, pickup: 0,
      key: { tonic: "F", sig: "1b", name: "F major" }, scale: "ionian",
      order: ["T", "B"], clefs: { T: "treble8", B: "bass" }, melody: "T",
      syllables: [8, 7, 8, 7, 8, 7, 8, 7, 8, 7, 8, 7],
      parts: {
        T: T1 + T1 + T2 + "/ " + T2.replace(/ \| $/, " |"),
        B: B1 + B1 + B2 + "/ " + B2.replace(/ \| $/, " |")
      },
      crossCheck: [
        { book: "Wyeth's Repository of Sacred Music, Part Second (2nd ed.; first ed. 1813, same page)", year: 1820, page: 112,
          url: "https://digitalcollections-baylor.quartexcollections.com/Documents/Detail/wyeths-repository-of-sacred-music-part-second-...-for-the-use-of-christian-churches-singing-schools-and-private-societies-together-with-a-plain-and-concise-introduction-to-the-grounds-of-music-and-rules-for-learners/2132565",
          note: "Baylor University's copy, p. 112: HALLELUJAH, 8 & 7, 'Major Key on F', the same two parts. Its scan is low-resolution; the opening bars were compared by shape and they agree." }
      ],
      notes: "Two parts only, as printed (Wyeth's air and bass); the later SATB NETTLETON of 19th-century hymnals smooths the rhythm (even pairs 'Come, thou | fount of') and is not this. " +
             "The book's time mark is the reversed C (the 'third mood' of common time: two minim beats); stored as 4/4 in crotchets. " +
             "The second strain carries repeat dots and first and second endings (both a minim F); it is written out twice, the second time being the 'Hallelujah' chorus the bass's words give. " +
             "One bass note is doubtful: in 'to sing' the slurred quaver after A is printed with a diamond (mi) head where the staff position says G (sol); read as G, the tenth under the tenor's B-flat."
    }));
  })();

  // ---- SIMPLE GIFTS -------------------------------------------------------------------------
  // The Shaker dancing song (Alfred, Maine, 1848, credited to Elder Joseph
  // Brackett). The source is a Shaker manuscript hymnal page in "letteral"
  // notation (letters for pitches, strokes for time), Western Reserve
  // Historical Society, as reproduced by Roger Lee Hall's American Music
  // Preservation. It gives the first strain whole, with its repeat marks,
  // and the first seven notes of the second strain before the page ends; the
  // rest of the second strain comes from a transcription of another Shaker
  // manuscript (Mary Hazzard's, New Lebanon), which agrees with this page
  // everywhere the two overlap except the opening pickup. Each strain is
  // sung twice, as the page's repeat signs ask: A A B B.
  (function () {
    var A = "C5:.5 C5:.25 D5:.25 E5:.25 C5:.25 E5:.25 F5:.25 | G5:.5 G5:.25 F5:.25 E5:.5 / D5:.25 C5:.25 | " +
            "D5:.5 D5:.5 D5:.5 D5:.5 | D5:.25 E5:.25 D5:.25 B4:.25 G4:.5 / G4:.5 | " +
            "C5:.25 B4:.25 C5:.25 D5:.25 E5:.5 D5:.25 D5:.25 | E5:.5 F5:.5 G5:.75 / G5:.25 | " +
            "D5:.5 D5:.25 E5:.25 D5:.5 C5:.25 C5:.25 | D5:.5 C5:.25 B4:.25 ";
    var B = "G5:1 E5:.75 D5:.25 | E5:.25 F5:.25 E5:.25 D5:.25 C5:.75 / D5:.25 | " +
            "E5:.5 E5:.25 F5:.25 G5:.5 E5:.5 | D5:.5 D5:.25 E5:.25 D5:.75 / G4:.25 | " +
            "C5:1 C5:.75 D5:.25 | E5:.5 E5:.25 F5:.25 G5:.5 / G5:.25 G5:.25 | " +
            "D5:.5 D5:.5 E5:.5 E5:.25 D5:.25 | C5:.5 C5:.5 C5:1 |";
    var SECOND = "Second strain: the manuscript page ends after 'When true simplicity is'; from 'gained' on, the notes follow the transcription of Mary Hazzard's manuscript (Wikimedia Commons), not a facsimile.";
    SOURCES.push({
      slug: "simple-gifts", nameEn: "SIMPLE GIFTS", nameDs: "𐑅𐐮𐑋𐐹𐐲𐑊 𐑀𐐮𐑁𐐻𐑅", number: 1848,
      source: { book: "Shaker manuscript hymnal, 'Dancing Song' (Western Reserve Historical Society; facsimile via American Music Preservation)",
                year: 1848, page: "ms. leaf", tuneName: "Dancing Song",
                url: "https://www.americanmusicpreservation.com/Images/Simple%20Gifts%20manuscript2.jpg" },
      // beatS 1.1 (♩ ≈ 55): the manuscript writes the tune in quavers and semiquavers under a
      // 2/4 signature, so at the house 0.5 s it ran at twice a singing pace (owner, 2026-09-27)
      meter: "irregular", time: "2/4", beatS: 1.1, pickup: 0.5,
      key: { tonic: "C", sig: "", name: "C major (letteral)" }, scale: "ionian",
      melody: "S", dialect: "shaker", order: ["S"], clefs: { S: "treble" },
      syllables: [13, 11, 11, 11, 13, 11, 11, 11, 8, 10, 8, 10, 8, 10, 8, 10],
      lineNotes: { 4: "The first strain again (the manuscript's repeat sign); the pickup cuts the last note of the first time short, as the dancers take it.", 8: SECOND, 12: "The second strain again (the manuscript's repeat sign). " + SECOND },
      parts: {
        S: "G4:.25 G4:.25 | " + A + "C5:.5 / G4:.25 G4:.25 | " + A + "C5:1 | / " + B + " / " + B
      },
      crossCheck: [
        { book: "Mary Hazzard's manuscript (New Lebanon), as transcribed by C. A. Meacham: Wikimedia Commons, 'SimpleGifts.png' (note values doubled there; halved back here)",
          year: 1848, page: "ms.", url: "https://commons.wikimedia.org/wiki/File:SimpleGifts.png",
          note: "A modern transcription, not a facsimile. Its first strain agrees with the WRHS page note for note and stroke for stroke except the opening pickup (two quavers there, two semiquavers here), and its second strain begins exactly as the WRHS page's last seven letters do; so it is trusted for the rest of the second strain, which no facsimile found shows." }
      ],
      notes: "Letteral notation gives the pitches unambiguously (g g | c c d e c e f | g …) but not the octave (read from the tune's contour); time is read from the strokes: a letter standing alone is a crotchet, joined by a single stroke a quaver, by a double stroke a semiquaver, and a dot lengthens by half. " +
             "Round 2 re-read every stroke at full size: 'place just right' ends g-dotted-quaver, g-semiquaver ('Twill'), 'valley of' is d-quaver, c–c semiquavers, and 'love and delight' is d-quaver, c–b semiquavers, c crotchet. These now agree with the Hazzard transcription. " +
             "The page marks the first strain to be repeated and opens the second with a repeat sign (:||:), so each strain is written out twice (A A B B); the first time through, the last c is a quaver so the pickup can come in on time. " +
             "The second strain from 'gained' on is taken from the Hazzard transcription (see the cross-check): the WRHS page is cut off after 'When true simplicity is', and no complete facsimile or pre-1929 printing was found (Andrews's 'The Gift to Be Simple' is 1940). " +
             "v0.30's incipit had the right pitches for the first phrase but in plain quarters and eighths; the manuscript's snap (the semiquaver 'Tis the, the running 'simple, 'tis the') is its character."
    });
  })();

  // ==========================================================================
  var problems = [];
  var list = SOURCES.map(function (t) { return build(t, problems); });
  var index = {};
  list.forEach(function (h) { index[h.id] = h; });

  // v0.30's OLD_TUNES names → the tunes that replace them (for the lab's A/B
  // and for the integrator's migration).
  var OLD = {
    "all is well": "earth:all-is-well", "kingsfold": "earth:kingsfold", "bethany": "earth:bethany",
    "foundation": "earth:foundation", "nettleton": "earth:nettleton", "simple gifts": "earth:simple-gifts",
    "god be with you": "earth:god-be-with-you"
  };

  return {
    list: list,
    byId: function (id) { return index[id] || null; },
    old: OLD,
    problems: problems,
    ratio: ratio
  };
})();

// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE SINGING SCHOOL (KOLOB.GuestSingingSchool) — EXPERIMENTAL
//
// American hymnody was taught before it was sung. The tunebooks came out of
// the singing schools — William Billings's New-England Psalm-Singer (1770)
// opens with the rudiments, for classes that met in the evenings with a
// master, a pitch pipe and a candle; Sacred Harp singing schools still run
// every summer — and pioneer Utah kept its singing classes in the ward
// houses. And every ward choir practises in the chapel before the meeting.
//
// So on some Sundays you arrive while the choir is still practising:
//   1. the chorister strikes a TUNING FORK and sets its stem on the music
//      stand (the wood sings it louder); she hums its note, then sings the
//      hymn's home note on its shape syllable, and the sections hum their
//      first notes — the chord the hymn begins on;
//   2. the choir sings the first line of the day's first hymn, and ONE part
//      goes plainly wrong — one of three slips a section makes while it is
//      still learning its line: it CLIMBS where the line turns down; it
//      HOLDS ON where the line turns down (it stays on the note it had,
//      the commonest slip of all, and in a tune sung in unison the only
//      wrong note that clashes with the tune a step away); or it comes in
//      a BEAT LATE — each a real clash against the others (a second or a
//      seventh, never a comma off);
//   3. the chorister raps the stand, and the choir stops on a breath —
//      raggedly, as people do, the part that went wrong a moment after the
//      others;
//   4. she gives that part its note, and they sing the passage ALONE,
//      slowly, ON THE NOTES (fa, sol, la, mi — the four shapes): she says
//      the syllables whole, and the section sings them after her with
//      their l and m but without their f and s (CONSONANTS, below — a
//      section's f and s, sung at a dozen slightly different moments, are
//      the brushing the owner heard between the notes);
//   5. two soft raps set the beat, and everyone sings it again, from the
//      pickup through the cadence, right.
// One correction, never two: it is a charming rehearsal, not a glitch. The
// first hymn, when it comes, comes in correctly.
//
// EXPERIMENTAL (PLAN-COMPOSITION §15.3). The owner asked for this to be
// switched off easily if it proves too much of a mess: the planner asks
// KOLOB.Experimental ("singingSchool") before it seats it — or reads
// meetingInfo.experimental, which the engine fills from that registry. Off,
// it is never seated; its dice are thrown all the same.
//
// THE SEAT. The prelude only, on about one Sunday in ten, in the first
// seconds (you arrive during the practice), for 30–50 s. Never at a
// funeral; never beside another guest in the prelude (the trombones, the
// steeples, the old tune), nor with one in the section after it (§8.13 —
// the handbells in the invocation, say); weighted up a little at Christmas
// (the choir has a number to learn) and down at conference (they would
// have it by now).
//
// THE MATERIAL. The day's first hymn (a SCORE §5 Hymn — the composer's, or
// an Earth tune with its parts), and the keynote. With no hymn handed over,
// the guest asks KOLOB.Composer for a Tabernacle hymn of its own.
//
// THE VOICES. The ward choir is KOLOB.VoicesVocal: two desks a part, three
// people a desk — twenty-four singers, each with their own vibrato, scoop
// and timing — and the chorister, one singer, standing in front. Tabernacle
// hymns sing their four parts; the Sacred Harp its three or four (the
// tenors carry the tune, so "the tenors climb where the tune turns down"
// is literally the tune); a tune sung in unison (the Old Way) is the women
// on the tune and the men an octave under it — and then it is the men who
// climb or hold on, or the women who come in late. On a phone
// (material.phone) the choir is one desk a part: twelve singers, half the
// nodes (the practice peaks at 290–420 singer nodes with its eight desks).
//
// PURE PLANNING. plan(), decide(), lesson() and score() touch no
// AudioContext, DOM, clock or Math.random; every die is the stream's
// (guest:singingschool:<n>), on forks: "seat" (the odds and the moment),
// "lesson" (which mistake, which part, where), "vowels" (the syllables the
// choir sings until the words exist — the same on both passes: they are the
// same words), "material" (a hymn composed here, when none is handed over)
// and "synth" (the singers' own voices, and how raggedly they stop:
// sound-level). perform() reads no clock: everything is placed at or after
// the t it is given.
//
// Public surface: window.KOLOB.GuestSingingSchool
//   plan(meetingInfo, stream) → { guest, seat: "prelude", at, dur, holdUntil,
//        mistake?, estimated, odds, experimental: true, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections, guests, material?,
//       experimental?: { singingSchool }, force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the lesson's material (pure; itself material)
//   lesson(material, stream) → the mistake, the passage, the pass (pure)
//   score(material, stream, t0) → the whole rehearsal as data (pure)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { onNote({freq, t, dur, part, stage, wrong, layer}),
//              onStage({stage, t0, t1, label}),
//              defer(at, fn) (the engine's clock: each sung line is laid out
//              at `at`, a little before its throat is born, instead of the
//              whole practice inside one cue — the hook the trombones take;
//              a lab with no clock lays everything out at once) }
//     material: prepare()'s, or { hymn, keynoteHz, phone? }
//   ODDS, EXPERIMENT, NAME, LABEL, LEVEL, CONSONANTS
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestSingingSchool = (function () {
  "use strict";

  var NAME = "singingschool";
  var LABEL = "guest:singingschool:";
  var EXPERIMENT = "singingSchool";

  // ==========================================================================
  // THE ODDS — about one Sunday in ten (for the owner's ear)
  // ==========================================================================
  // conditional: refused when another guest holds the prelude (the
  // trombones, the steeples, the old tune: about a fifth of meetings) and
  // at funerals; the lab's odds card runs plan() over a stand-in of the
  // engine's planner: at a base of 0.125 it seated 9 % of meetings (another
  // guest holds the prelude in a quarter of them); at 0.14, one in ten.
  var ODDS = {
    base: 0.14,
    weight: {
      ordinary: 1.1, fast: 0.8, conference: 0.6, jubilee: 1,
      christmas: 1.4, easter: 1, wedding: 0.7, dedication: 0.5, pioneer: 1, funeral: 0,
    },
    cap: 0.6,
  };
  var AT = [1.5, 8];                               // s into the prelude: you arrive during the practice
  // the practice's bus: calibrated in the lab so its loudest three seconds
  // (everyone, the second time, singing out) sit level with the organ
  // reference — a choir in the chapel, not a choir in the doorway
  var LEVEL = 0.55;
  // THE CONSONANTS OF THE SHAPES. "fa" and "sol" begin with the only noisy
  // sounds a voice here makes, f and s. One person saying them is diction;
  // a section saying them is six small hisses at six slightly different
  // moments, smeared into a brush at every note change — the owner's
  // "brushing s sound… like air being released out of a tire… in between
  // notes". Measured, dry, in the practice's passage alone (noise against
  // tone at the joins between notes; −38 to −44 dB inside the notes, seven
  // practices): with a voice whose f and s are at full strength, −15 to
  // −21 dB (the worst join −9 to −15); with the softer consonants
  // kolob-voices-vocal.js has (its f and s a third as strong), −27 to −37
  // (the worst −24 to −28) — still eight to twelve dB over the middle of a
  // note as a rule. So by default the SECTION sings the shapes with their
  // voiced consonants only — la and mi keep their l and m; fa and sol are
  // sung on their vowels, ah and oh, re-articulated by the voice's own
  // attack — and the CHORISTER, one clear voice, says all four whole when
  // she gives the note or sings them the passage first ("auto": whole with
  // a voice that exports its mouth, VoicesVocal._mouth — the voice loaded
  // today; voiced with one that does not, whose single s would stand 17–22
  // dB over the middle of her notes). Measured so, every stage the choir
  // sings sits at its joins within about 3 dB of the middle of its notes;
  // the chorister's own f and s about 8 dB over hers — one voice's diction,
  // heard only when she sings a quick tune's passage to them first.
  //   section / chorister: "voiced" (l and m; no f, no s) · "all" (the shapes
  //   whole) · "vowels" (ah oh ah ee: no consonant at all) · "auto"
  // Settable (KOLOB.GuestSingingSchool.CONSONANTS = {section, chorister});
  // once the voice can say a line's f and s lightly, the section's "all" at
  // a third of the ward's strength is the better sound. The score says the
  // shapes (each shape-note keeps `shape`); this decides only what the
  // mouths make of them.
  var CONSONANTS = { section: "voiced", chorister: "auto" };
  var SAID = {
    all: { fa: "fa", sol: "sol", la: "la", mi: "mi" },
    voiced: { fa: "ah", sol: "oh", la: "la", mi: "mi" },
    vowels: { fa: "ah", sol: "oh", la: "ah", mi: "ee" },
  };
  // (cast: whether the voice loaded exports its mouth, VoicesVocal._mouth —
  // perform() knows, score() does not and writes what that voice would say)
  function said(shape, who, cast) {
    var w = CONSONANTS[who];
    if (w === "auto") w = cast === false ? "voiced" : "all";
    return (SAID[w] || SAID.voiced)[shape] || shape;
  }

  function oddsFor(info) {
    // (the meeting hands this room its odds from Calendar.GUEST_ODDS,
    // info.odds; a lab without them reads the room's own ODDS)
    if (info && info.odds != null) return Math.max(0, Math.min(1, +info.odds));
    var w = ODDS.weight;
    var k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestSingingSchool: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function experimentOn(info) {
    if (info && info.experimental && typeof info.experimental[EXPERIMENT] === "boolean") return info.experimental[EXPERIMENT];
    var X = window.KOLOB.Experimental;
    return X ? X.isOn(EXPERIMENT) : true;
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), atU = rs.next();                           // DICE: every die, first
    var p = oddsFor(info), why = null;
    var secs = info.sections || [], guests = info.guests || [];
    var prelude = null;
    for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === "prelude") { prelude = secs[i]; break; }
    var taken = null, beside = null;
    guests.forEach(function (g) { if (g && g.section === "prelude" && g.type !== NAME && !taken) taken = g.type; });
    // (PLAN §8.13: never two guests in adjacent sections — so a guest seated
    // in the section after the prelude refuses the practice too, whichever
    // the engine planned first)
    var pi = secs.indexOf(prelude), next = pi >= 0 && secs[pi + 1] ? secs[pi + 1].type : null;
    guests.forEach(function (g) { if (g && next && g.section === next && g.type !== NAME && !beside) beside = g.type + " in the " + next; });
    if (!experimentOn(info)) why = "switched off (KOLOB.Experimental." + EXPERIMENT + ")";
    else if (info.sunday === "funeral" || info.kind === "funeral") why = "never at a funeral";
    else if (!prelude) why = "no prelude";
    else if (taken) why = "the prelude is taken (" + taken + ")";
    else if (beside) why = "a guest beside the prelude (" + beside + ")";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var mat = info.material && info.material.prepared ? info.material : null;
    var sc = mat ? score(mat, stream, 0) : null;
    var dur = sc ? sc.end : 40;
    var at = AT[0] + (AT[1] - AT[0]) * atU;
    return {
      seat: {
        guest: NAME, seat: "prelude", section: "prelude", at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 3).toFixed(2),
        mistake: sc ? sc.lesson.mistake.says : null,
        estimated: !mat, odds: +p.toFixed(3), experimental: true, logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // PITCH
  // ==========================================================================
  var PARENT = {
    ionian:     [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8],
    mixolydian: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 16 / 9],
    dorian:     [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 16 / 9],
    aeolian:    [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 16 / 9],
  };
  PARENT.penta = PARENT.hexa = PARENT.ionian;
  // where do sits, counted from the final (the composer's DO_OF): the four
  // shapes are read from do
  var DO_OF = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };
  var SHAPES = ["fa", "sol", "la", "fa", "sol", "la", "mi"];      // do re mi fa sol la ti
  function modeName(m) { return PARENT[m] ? m : "ionian"; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function degRatio(mode, d) { return PARENT[modeName(mode)][mod(d, 7)] * Math.pow(2, Math.floor(d / 7)); }
  function monzoRatio(m) { m = m || [0, 0, 0, 0]; return Math.pow(2, m[0] || 0) * Math.pow(3, m[1] || 0) * Math.pow(5, m[2] || 0) * Math.pow(7, m[3] || 0); }
  function cents(r) { return 1200 * Math.log(r) / Math.LN2; }
  function shapeOf(mode, deg) { return SHAPES[mod(deg - DO_OF[modeName(mode)], 7)]; }
  function num(x, d) { x = +x; return isFinite(x) && x > 0 ? x : d; }
  // A REAL CLASH: a second or a seventh, or the tritone — never a comma, never
  // a consonance (interval classes in cents, octaves folded)
  function clashOf(r1, r2) {
    var c = mod(cents(r1 / r2), 1200);
    if ((c >= 70 && c <= 235) || (c >= 965 && c <= 1130)) return c <= 235 ? (c < 150 ? "a minor second" : "a major second") : (c < 1050 ? "a minor seventh" : "a major seventh");
    if (c >= 560 && c <= 640) return "a tritone";
    return null;
  }

  // ==========================================================================
  // THE MATERIAL — the day's first hymn, read into parts
  // ==========================================================================
  var PARTS = ["S", "A", "T", "B"];
  var PART_NAME = { S: "sopranos", A: "altos", T: "tenors", B: "basses", W: "women", M: "men" };
  function lineLength(ln) {
    var K = window.KOLOB;
    if (K.Score && K.Score.lineLength) return K.Score.lineLength(ln);
    var end = 0;
    Object.keys(ln.notes || {}).forEach(function (p) { (ln.notes[p] || []).forEach(function (n) { end = Math.max(end, n.beat + n.beats); }); });
    return end;
  }
  function readLine(ln) {
    var parts = {};
    PARTS.forEach(function (p) {
      var src = (ln.notes && ln.notes[p]) || [], out = [];
      for (var k = 0; k < src.length; k++) {
        var n = src[k];
        if (!n || n.monzo == null) continue;
        var b1 = n.beat + n.beats;
        while (src[k].tie && k + 1 < src.length && src[k + 1] && Math.abs(monzoRatio(src[k + 1].monzo) - monzoRatio(n.monzo)) < 1e-9) { k++; b1 = src[k].beat + src[k].beats; }
        out.push({ beat: n.beat, beats: b1 - n.beat, ratio: monzoRatio(n.monzo), deg: n.deg != null ? n.deg : Math.round(cents(monzoRatio(n.monzo)) / 171.4), syl: n.syl, stress: n.stress != null ? n.stress : 1 });
      }
      if (out.length) parts[p] = out;
    });
    return { parts: parts, beats: lineLength(ln), barStart: ln.barStart || 0, fermata: (ln.fermataBeats || []).length ? Math.max.apply(null, ln.fermataBeats) : null };
  }
  function prepare(material, stream) {
    if (material && material.prepared) return material;
    var M = material || {};
    var h = M.hymn && M.hymn.lines && M.hymn.lines.length ? M.hymn : null, source = h ? (h.provenance === "earth" ? "an Earth tune" : "the day's first hymn") : null;
    if (!h && window.KOLOB.Composer) {
      try { h = window.KOLOB.Composer.compose(need(stream).fork("material").fork("hymn"), { dialect: "tabernacle", mode: M.mode ? modeName(M.mode) : undefined }); source = "a hymn composed for the practice"; }
      catch (e) { h = null; }
    }
    if (!h) throw new Error("KOLOB.GuestSingingSchool: a hymn is required (material.hymn), or KOLOB.Composer loaded");
    var K = num(M.keynoteHz, 260);
    var lines = h.lines.slice(0, 2).map(readLine);
    var present = PARTS.filter(function (p) { return lines[0].parts[p]; });
    return {
      prepared: true, hymnId: h.id, hymnName: h.nameEn || null, dialect: h.dialect || null, mode: modeName(h.mode),
      melodyPart: h.melodyPart || "S", beatS: num(h.beatS, 0.7), keynoteHz: K, finalHz: K * monzoRatio(h.keyMonzo),
      lines: lines, unison: present.length === 1, source: source + (h.nameEn ? " (" + h.nameEn + ", " + (h.dialect || "?") + ")" : ""),
      phone: !!M.phone,
    };
  }

  // ==========================================================================
  // THE CHOIR — eight desks, and what each sings
  // ==========================================================================
  // desk: { id, voice (the VoicesVocal part), sings (a Score part), oct, group
  // (who the chorister would name), pan } — the choir faces us: sopranos at
  // the audience's left, then the altos, the tenors, the basses at the right
  // (on a phone, one desk a part, standing between the two places)
  function choir(M) {
    var L0 = M.lines[0].parts, has = function (p) { return !!L0[p]; }, desks = [];
    var PAN = M.phone ? { S: [-0.52], A: [-0.14], T: [0.17], B: [0.54] } : { S: [-0.62, -0.42], A: [-0.22, -0.06], T: [0.08, 0.26], B: [0.44, 0.64] };
    ["S", "A", "T", "B"].forEach(function (v) {
      for (var k = 0; k < PAN[v].length; k++) {
        var sings = v, oct = 1, group = v;
        if (M.unison) { sings = M.melodyPart; oct = v === "T" || v === "B" ? 0.5 : 1; group = v === "T" || v === "B" ? "M" : "W"; }
        else if (!has(v)) {
          // a part this tune does not print: the altos double the tune (the
          // Sacred Harp's tenor, an octave up) or the treble
          if (v === "A") { sings = has("T") && M.melodyPart === "T" ? "T" : "S"; oct = sings === "T" ? 2 : 1; }
          else { sings = M.melodyPart; oct = v === "B" ? 0.5 : 1; }
        }
        desks.push({ id: v + k, voice: v, sings: sings, oct: oct, group: group, pan: PAN[v][k] });
      }
    });
    return desks;
  }
  function groupsOf(desks) { var g = []; desks.forEach(function (d) { if (g.indexOf(d.group) < 0) g.push(d.group); }); return g; }

  // ==========================================================================
  // THE LESSON — which mistake, where; the passage; the pass (pure)
  // ==========================================================================
  function lesson(material, stream) {
    var M = prepare(material, stream);
    var r = need(stream).fork("lesson");
    var kindU = r.next(), partU = r.next(), spotU = r.next();         // DICE: every die, first
    var desks = choir(M), L = M.lines[0], mode = M.mode, fz = M.finalHz;
    // what a group sings, in Hz ratios over the final (its octave applied)
    function lineOf(group) {
      var d = null; desks.forEach(function (x) { if (x.group === group && !d) d = x; });
      return (L.parts[d.sings] || []).map(function (n) { return { beat: n.beat, beats: n.beats, ratio: n.ratio * d.oct, deg: n.deg + 7 * Math.round(Math.log(d.oct) / Math.LN2), stress: n.stress }; });
    }
    function sounding(group, b0, b1) {
      var out = [];
      groupsOf(desks).forEach(function (g) {
        if (g === group) return;
        lineOf(g).forEach(function (n) { if (n.beat < b1 - 1e-6 && n.beat + n.beats > b0 + 1e-6) out.push({ group: g, n: n }); });
      });
      return out;
    }
    var PREF = {
      climb: M.unison ? [["M", 1]] : M.dialect === "sacredharp" ? [["T", 4], ["S", 1]] : [["T", 3], ["A", 1], ["B", 0.6]],
      late: M.unison ? [["W", 1]] : M.dialect === "sacredharp" ? [["A", 2], ["B", 1.4], ["S", 1]] : [["A", 3], ["B", 1.2], ["T", 1]],
    };
    function pickPart(list, u) {
      var ok = list.filter(function (x) { return groupsOf(desks).indexOf(x[0]) >= 0; });
      var tot = 0; ok.forEach(function (x) { tot += x[1]; });
      var v = u * tot;
      for (var i = 0; i < ok.length; i++) { v -= ok[i][1]; if (v <= 0) return ok[i][0]; }
      return ok.length ? ok[ok.length - 1][0] : null;
    }
    // THE CLIMB: where the line turns down, the part goes up instead — by the
    // same step (the mirror), or a step or a third over the note before —
    // and carries on from there, shifted; the first such place (after two
    // notes sung) whose wrong note clashes, preferring a clash against the
    // tune or the bass
    function climb(group) {
      var ns = lineOf(group), cands = [];
      var top = -Infinity; ns.forEach(function (n) { top = Math.max(top, n.deg); });
      for (var k = 1; k < ns.length - 1; k++) {
        if (!(ns[k].deg < ns[k - 1].deg)) continue;
        var down = ns[k - 1].deg - ns[k].deg;
        // (the mirror, a step up, a third up — or, where the tune falls by a
        // step, holding on: in a unison the only wrong notes that clash are
        // a second or a seventh from the tune itself)
        [ns[k - 1].deg + down, ns[k - 1].deg + 1, ns[k - 1].deg + 2, ns[k - 1].deg].forEach(function (w, wi) {
          if (w - ns[k].deg < (wi === 3 ? 1 : 2)) return;                        // a real wrong note, not a neighbour's slip
          if (w > top + 3) return;                                                // (and one the section could reach)
          var wr = degRatio(mode, w);
          var others = sounding(group, ns[k].beat, ns[k].beat + Math.min(ns[k].beats, 1));
          var hits = [], sal = 0;
          others.forEach(function (o) {
            var c = clashOf(wr, o.n.ratio);
            if (c) { hits.push({ group: o.group, what: c }); if (o.group === "B" || o.group === M.melodyPart || o.group === "W") sal++; }
          });
          var right = others.some(function (o) { return clashOf(ns[k].ratio, o.n.ratio); });
          if (!hits.length) return;
          cands.push({ k: k, w: w, wr: wr, hold: wi === 3, hits: hits, score: hits.length + 2 * sal - wi * 0.6 - (k < 2 ? 1.5 : 0) - (right ? 1 : 0) - Math.abs(k - ns.length * 0.45) * 0.15 });
        });
      }
      if (!cands.length) return null;
      cands.sort(function (a, b) { return b.score - a.score || a.k - b.k; });
      // the best few are all good lessons: the die picks among them
      top = cands.filter(function (c) { return c.score >= cands[0].score - 1; });
      var c0 = top[Math.floor(spotU * top.length)];
      var off = c0.w - ns[c0.k].deg;
      var wrong = [];
      for (var j = c0.k; j < ns.length && j <= c0.k + 2; j++) {
        var wd = ns[j].deg + off;
        wrong.push({ index: j, deg: wd, rightDeg: ns[j].deg, ratio: j === c0.k ? c0.wr : degRatio(mode, wd), right: ns[j].ratio });
      }
      return { kind: "climb", group: group, at: c0.k, beat: ns[c0.k].beat, wrong: wrong, clash: c0.hits[0], clashes: c0.hits.length,
               says: "the " + PART_NAME[group] + (c0.hold ? " hold on" : " climb") + " where the " + (group === M.melodyPart || group === "M" || group === "W" ? "tune" : "line") + " turns down (" + c0.hits[0].what + " against the " + PART_NAME[c0.hits[0].group] + ")" };
    }
    // THE LATE ENTRY: the part a beat behind from its first note; the
    // clashes it makes in its first bars
    function late(group) {
      var ns = lineOf(group);
      if (ns.length < 4) return null;
      var moments = [];
      ns.slice(0, 6).forEach(function (n, i) {
        var others = sounding(group, n.beat + 1, n.beat + 1 + Math.min(n.beats, 1));
        others.forEach(function (o) {
          var c = clashOf(n.ratio, o.n.ratio);
          if (c && !moments.some(function (m) { return m.i === i; })) moments.push({ i: i, beat: n.beat + 1, what: c, against: o.group });
        });
      });
      if (moments.length < 2) return null;
      return { kind: "late", group: group, at: moments[1].i, beat: moments[1].beat, wrong: [], clash: { group: moments[0].against, what: moments[0].what }, clashes: moments.length, moments: moments,
               says: "the " + PART_NAME[group] + " come in a beat late (" + moments[0].what + " against the " + PART_NAME[moments[0].against] + ", then " + moments[1].what + ")" };
    }
    var order = kindU < 0.6 ? ["climb", "late"] : ["late", "climb"];
    var mistake = null;
    for (var oi = 0; oi < order.length && !mistake; oi++) {
      var kind = order[oi], first = pickPart(PREF[kind], partU);
      var tries = [first].concat(PREF[kind].map(function (x) { return x[0]; }).filter(function (g) { return g !== first && groupsOf(desks).indexOf(g) >= 0; }));
      for (var ti = 0; ti < tries.length && !mistake; ti++) if (tries[ti]) mistake = kind === "climb" ? climb(tries[ti]) : late(tries[ti]);
    }
    if (!mistake) {
      // (a line with no down-turn that clashes and no late entry that does:
      // some part sings some note a step or a third out — the first that
      // clashes — a plain wrong note, and a clear lesson still)
      groupsOf(desks).some(function (g) {
        var ns0 = lineOf(g);
        for (var k0 = 1; k0 < ns0.length - 1 && !mistake; k0++) {
          [1, -1, 2, -2].some(function (off) {
            var w0 = ns0[k0].deg + off, wr0 = degRatio(mode, w0), hit = null;
            sounding(g, ns0[k0].beat, ns0[k0].beat + Math.min(ns0[k0].beats, 1)).forEach(function (o) { var c = clashOf(wr0, o.n.ratio); if (c && !hit) hit = { group: o.group, what: c }; });
            if (!hit) return false;
            mistake = { kind: "climb", group: g, at: k0, beat: ns0[k0].beat, wrong: [{ index: k0, deg: w0, rightDeg: ns0[k0].deg, ratio: wr0, right: ns0[k0].ratio }], clash: hit, clashes: 1,
                        says: "the " + PART_NAME[g] + " sing a wrong note (" + hit.what + " against the " + PART_NAME[hit.group] + ")" };
            return true;
          });
        }
        return !!mistake;
      });
    }
    if (!mistake) {
      // (nothing clashes anywhere in the line — one part and one note: the
      // tune in unison, a step out)
      var g1 = groupsOf(desks)[groupsOf(desks).length - 1], ns2 = lineOf(g1), k1 = Math.min(2, ns2.length - 1);
      mistake = { kind: "climb", group: g1, at: k1, beat: ns2[k1].beat, wrong: [{ index: k1, deg: ns2[k1].deg + 1, rightDeg: ns2[k1].deg, ratio: degRatio(mode, ns2[k1].deg + 1), right: ns2[k1].ratio }], clash: { group: null, what: "a wrong note" }, clashes: 0, says: "the " + PART_NAME[g1] + " sing a wrong note" };
    }
    // THE PASSAGE the part sings alone: from two notes before the mistake
    // (from the start, for a late entry) to the first long note at least two
    // past it, or the line's end
    var ns1 = lineOf(mistake.group);
    var from = mistake.kind === "late" ? 0 : Math.max(0, mistake.at - 2);
    var to = Math.min(ns1.length - 1, mistake.kind === "late" ? Math.max(3, mistake.at) : mistake.at + 2);
    while (to < ns1.length - 1 && to < mistake.at + 4 && ns1[to].beats < 1.5 - 1e-6) to++;
    to = Math.min(to, from + 5);                                   // six notes at most: a passage, not the line
    mistake.passage = { from: from, to: to, notes: ns1.slice(from, to + 1).map(function (n) { return { deg: n.deg, ratio: n.ratio, beats: n.beats, shape: shapeOf(mode, n.deg) }; }) };
    return { mistake: mistake, desks: desks, groups: groupsOf(desks), prepared: M, fz: fz };
  }

  // ==========================================================================
  // THE SCORE — the rehearsal as data (pure)
  // ==========================================================================
  // items: { kind: "sing", desk, t, notes: [{f, dur, vowel, stress, rest?}],
  //          stage, wrong: [indices] } · { kind: "fork", t, f } ·
  //          { kind: "tap", t, v } · { kind: "chorister", t, notes }
  var VOWELS = [["ah", 3], ["oh", 2], ["ee", 1.5], ["oo", 1.2], ["eh", 1.5]];
  function score(material, stream, t0) {
    t0 = +t0 || 0;
    var LS = lesson(material, stream), M = LS.prepared, mk = LS.mistake, desks = LS.desks;
    var vr = need(stream).fork("vowels"), vowels = [];
    for (var vi = 0; vi < 48; vi++) vowels.push(vr.pickW(VOWELS));
    var react = need(stream).fork("synth").fork("react");            // how raggedly they stop: sound-level
    var fz = M.finalHz, mode = M.mode, L = M.lines[0];
    // (a practice sings at a working pace: the Old Way's very slow beat is
    // taken nearer a walk; the passage alone at about 0.6 of it, and never
    // longer than eight seconds)
    var spb = Math.max(0.42, Math.min(1.0, M.beatS)), slow = Math.min(1.15, spb / 0.62);
    var psBeats = 0; mk.passage.notes.forEach(function (n) { psBeats += Math.max(0.5 / slow, n.beats); });
    slow = Math.max(spb * 1.15, Math.min(slow, 7 / Math.max(1, psBeats * 1.12)));
    var items = [], stages = [], notesOut = [];
    function stage(name, a, b, label) { stages.push({ stage: name, t0: t0 + a, t1: t0 + b, label: label }); }
    function vowelOf(n, i) { return vowels[(n.syl != null ? n.syl : i) % vowels.length]; }
    // a desk's notes for one line, from `fromBeat`, shifted `lateBeats`,
    // wrong notes swapped in, stopped at `stopAt` (s from the line's start)
    function deskLine(d, ln, o) {
      o = o || {};
      var src = ln.parts[d.sings] || [], out = [], t = null, first = null;
      var bpS = o.spb || spb;
      var stretch = function (b) { return (b + (ln.fermata != null && b > ln.fermata + 1e-6 ? (o.hold || 0) : 0)) * bpS; };
      src.forEach(function (n, i) {
        var a = stretch(n.beat + (o.late || 0)), e = stretch(n.beat + n.beats + (o.late || 0));
        if (o.stopAt != null && a >= o.stopAt - 0.02) return;
        if (o.stopAt != null && e > o.stopAt) e = o.stopAt;
        var ratio = n.ratio * d.oct, wrong = false;
        if (o.wrong) o.wrong.forEach(function (w) { if (w.index === i) { ratio = w.ratio; wrong = true; } });
        if (first == null) { first = a; t = a; }
        if (a > t + 0.01) out.push({ rest: true, dur: a - t });
        out.push({ f: fz * ratio, dur: Math.max(0.08, e - a), vowel: o.shapes ? said(shapeOf(mode, n.deg), "section") : vowelOf(n, i), stress: n.stress, _wrong: wrong, _i: i });
        t = e;
      });
      return { start: first, notes: out };
    }
    // ---- 1. THE FORK, THE PITCH ----------------------------------------------
    var forkF = M.keynoteHz * 2;
    while (forkF > 700) forkF /= 2;
    while (forkF < 380) forkF *= 2;
    items.push({ kind: "fork", t: 0, f: forkF });
    // (she sings in the alto's compass, whoever she is giving the note to)
    function inChorRange(f) { while (f > 620) f /= 2; while (f < 200) f *= 2; return f; }
    var homeF = inChorRange(fz);
    var cT = 1.3;
    items.push({ kind: "chorister", t: cT, notes: [{ f: inChorRange(forkF), dur: 1.0, vowel: "hum" }], what: "hums the fork's note" });
    items.push({ kind: "chorister", t: cT + 1.45, notes: [{ f: homeF, dur: 0.95, vowel: said(shapeOf(mode, 0), "chorister"), shape: shapeOf(mode, 0) }], what: "sings the home note on its shape (" + shapeOf(mode, 0) + ")" });
    var pitchT = cT + 2.75;
    desks.forEach(function (d, i) {
      var ln = deskLine(d, L);
      if (!ln.notes.length) return;
      var n0 = null; ln.notes.forEach(function (x) { if (!x.rest && !n0) n0 = x; });
      var st = pitchT + (i % 4) * 0.07 + Math.floor(i / 4) * 0.05;
      items.push({ kind: "sing", desk: i, t: st, notes: [{ f: n0.f, dur: 1.5 - (st - pitchT), vowel: "hum", stress: 1 }], stage: "pitch" });
    });
    stage("fork", 0, pitchT + 1.6, "the chorister strikes the fork; she hums its note and gives the home note; the sections hum their first notes");
    // ---- 2. THE FIRST TRY, AND THE MISTAKE -----------------------------------
    var tryT = pitchT + 2.3;
    var errBeat = mk.beat, tCutRel;
    if (mk.kind === "late") tCutRel = errBeat * spb + Math.min(1.5, Math.max(0.75, 0.9 * spb + 0.3));
    else tCutRel = errBeat * spb + Math.min(1.7, Math.max(0.8, 1.0 * spb + 0.35));
    var tCut = tryT + tCutRel;
    // the others stop within a fifth of a second of the rap; the part that
    // went wrong a moment after (it takes them longer to notice)
    desks.forEach(function (d, i) {
      var isWrong = d.group === mk.group;
      var stopRel = tCutRel + 0.12 + react.rnd(0, 0.18) + (isWrong ? 0.15 + react.rnd(0, 0.25) : 0);
      var ln = deskLine(d, L, { late: isWrong && mk.kind === "late" ? 1 : 0, wrong: isWrong ? mk.wrong : null, stopAt: stopRel });
      if (!ln.notes.length) return;
      items.push({ kind: "sing", desk: i, t: tryT + ln.start, notes: ln.notes, stage: "try", wrongPart: isWrong });
    });
    items.push({ kind: "tap", t: tCut, v: 1 }, { kind: "tap", t: tCut + 0.13, v: 0.85 });
    stage("try", tryT, tCut + 0.6, "the choir sings the first line; " + mk.says);
    stage("cut", tCut, tCut + 1.5, "the chorister raps the stand; the choir stops on a breath");
    // ---- 3. THE PART ALONE, ON THE NOTES ---------------------------------------
    var giveT = tCut + 1.6;
    var ps = mk.passage, pn = ps.notes;
    // (a quick tune whose rehearsal would come out under half a minute: the
    // chorister first sings them the passage herself, on the notes — "listen"
    // — as a singing master does; otherwise she gives them their first note)
    var passS0 = 0; pn.forEach(function (n) { passS0 += Math.max(0.5, n.beats * slow); });
    var lineS0 = 0; M.lines.forEach(function (ln) { lineS0 += (ln.beats + 0.8) * spb * 0.97; });
    var demo = giveT + 1.45 + passS0 * 1.15 + 1.5 + 2 * spb + lineS0 + 1.4 < 31;
    var demoLen = 0;
    if (demo) {
      var dn = pn.map(function (n) { var d0 = Math.max(0.45, n.beats * slow * 0.9); demoLen += d0; return { f: inChorRange(fz * n.ratio), dur: d0, vowel: said(n.shape, "chorister"), shape: n.shape }; });
      items.push({ kind: "chorister", t: giveT, notes: dn, what: "sings the passage to them first, on the notes" });
      demoLen += 0.6;
    } else items.push({ kind: "chorister", t: giveT, notes: [{ f: inChorRange(fz * pn[0].ratio), dur: 0.85, vowel: said(pn[0].shape, "chorister"), shape: pn[0].shape }], what: "gives the " + PART_NAME[mk.group] + " their note" });
    var aloneT = giveT + (demo ? demoLen + 0.3 : 1.45), at = 0, passNotes = [];
    pn.forEach(function (n, i) {
      // (the note they missed is held a little longer: they are listening)
      var isSpot = mk.kind === "climb" ? i === mk.at - ps.from : i === 0;
      var d = Math.max(0.5, n.beats * slow) * (isSpot ? 1.3 : 1) * (i === pn.length - 1 ? 1.35 : 1);
      passNotes.push({ f: fz * n.ratio, dur: d, vowel: said(n.shape, "section"), shape: n.shape, stress: 1, _i: ps.from + i });
      at += d;
    });
    desks.forEach(function (d, i) {
      if (d.group !== mk.group) return;
      items.push({ kind: "sing", desk: i, t: aloneT, notes: passNotes.map(function (x) { return { f: x.f, dur: x.dur, vowel: x.vowel, shape: x.shape, stress: x.stress, _i: x._i }; }), stage: "alone" });
    });
    stage("alone", giveT, aloneT + at + 0.4, (demo ? "she sings the passage to the " + PART_NAME[mk.group] + " first; then they sing it" : "she gives the " + PART_NAME[mk.group] + " their note; they sing the passage") + " alone, slowly, on the notes (" + pn.map(function (n) { return n.shape; }).join(" ") + ")");
    // ---- 4. EVERYONE, AGAIN ------------------------------------------------------
    var passSpb = spb * 0.97;
    var countT = aloneT + at + 1.5;
    var pickup = L.barStart || 0;                                   // beats before the first bar (the pickup)
    // two raps a beat apart, the choir in on the beat after (or on the
    // pickup's own beat)
    items.push({ kind: "tap", t: countT, v: 0.55 }, { kind: "tap", t: countT + passSpb, v: 0.5 });
    var againT = countT + 2 * passSpb;
    var hold = 0.8;                                                 // the cadence held (beats)
    var lines = [L];
    var lineLen = function (ln) { return (ln.beats + (ln.fermata != null ? hold : 0)) * passSpb; };
    // (a short line, or a lesson that came out short: through the second
    // line's cadence too, so the rehearsal lasts its 30 s)
    if (M.lines[1] && (againT + lineLen(L) + 1.4 < 31)) lines.push(M.lines[1]);
    // (each desk sings the whole pass in one breath group — one throat for
    // both lines, a rest between them — so a phone builds the desk once)
    var tl = againT, per = desks.map(function () { return { start: null, notes: [], at: null }; });
    lines.forEach(function (ln, li) {
      var lnOn = tl;
      desks.forEach(function (d, i) {
        var dl = deskLine(d, ln, { spb: passSpb, hold: hold });
        if (!dl.notes.length) return;
        var p = per[i], on = lnOn + dl.start;
        if (p.start == null) { p.start = on; p.at = on; }
        if (on > p.at + 0.01) p.notes.push({ rest: true, dur: on - p.at });
        dl.notes.forEach(function (n) { p.notes.push(n); });
        p.at = on + dl.notes.reduce(function (a, n) { return a + n.dur; }, 0);
      });
      tl = lnOn + lineLen(ln) + (li < lines.length - 1 ? 0.35 * passSpb : 0);
    });
    per.forEach(function (p, i) { if (p.notes.length) items.push({ kind: "sing", desk: i, t: p.start, notes: p.notes, stage: "again" }); });
    stage("again", countT, tl + 0.8, "two raps, and everyone sings it again " + (pickup > 0 ? "from the pickup" : "from the top") + " through the cadence" + (lines.length > 1 ? " (and on through the second line)" : ""));
    var end = tl + 1.4;
    // every sung note, as the engine would report it (a note as written)
    items.forEach(function (it) {
      it.noteFrom = notesOut.length;
      if (it.kind === "sing" || it.kind === "chorister") {
        var tt = it.t;
        it.notes.forEach(function (n) {
          if (!n.rest) notesOut.push({ freq: n.f, t: t0 + tt, dur: n.dur, part: it.kind === "chorister" ? "chorister" : desks[it.desk].voice, stage: it.stage || "chorister", wrong: !!n._wrong, layer: "choir" });
          tt += n.dur;
        });
      } else if (it.kind === "fork") notesOut.push({ freq: it.f, t: t0 + it.t, dur: 4, part: "fork", stage: "fork", wrong: false, layer: "ambient" });
      it.noteTo = notesOut.length;
    });
    items.forEach(function (it) { it.t += t0; });
    return {
      prepared: M, lesson: { mistake: mk, groups: LS.groups }, desks: desks, items: items, stages: stages, notes: notesOut,
      t0: t0, end: t0 + end, tempo: { spb: spb, slow: slow, passSpb: passSpb }, lines: lines.length,
    };
  }

  // ==========================================================================
  // PERFORM — the choir, the chorister, the fork and the stand (synthesis)
  // ==========================================================================
  var TAPS = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function tapBuf(ctx) {
    var b = TAPS && TAPS.get(ctx);
    if (b) return b;
    // a pencil on a wooden music stand: a dry click and the stand's short
    // hollow note (a fixed recipe — a texture, the same every rap)
    var sr = ctx.sampleRate, len = Math.floor(sr * 0.09), s = 0x7a95;
    b = ctx.createBuffer(1, len, sr);
    var d = b.getChannelData(0), lp = 0, a = 1 - Math.exp(-2 * Math.PI * 2600 / sr), peak = 0;
    for (var i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var w = s / 0x7fffffff * 2 - 1, t = i / sr;
      lp += a * (w - lp);
      var v = lp * Math.exp(-t / 0.0022) + 0.55 * Math.sin(2 * Math.PI * 410 * t) * Math.exp(-t / 0.018) + 0.25 * Math.sin(2 * Math.PI * 1130 * t) * Math.exp(-t / 0.008);
      v *= Math.min(1, i / (0.0003 * sr));
      d[i] = v; peak = Math.max(peak, Math.abs(v));
    }
    for (var j = 0; j < Math.floor(0.004 * sr); j++) d[len - 1 - j] *= j / (0.004 * sr);
    for (var k = 0; k < len; k++) d[k] /= peak || 1;
    if (TAPS) TAPS.set(ctx, b);
    return b;
  }
  // THE TUNING FORK: struck on the knee — a pure tone, the "clang" of its
  // second mode (about 6.3 times up, gone in a tenth of a second) and a tick;
  // then its stem is set on the stand, and the wood sings it louder
  function fork(ctx, dest, t, f) {
    var out = ctx.createGain(); out.gain.value = 1; out.connect(dest);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 0.004);
    g.gain.setTargetAtTime(0.012, t + 0.004, 0.5);
    g.gain.setValueAtTime(0.0125, t + 0.85);
    g.gain.linearRampToValueAtTime(0.04, t + 0.93);                  // the stem on the stand
    g.gain.setTargetAtTime(0, t + 0.93, 1.3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 9);
    var c = ctx.createOscillator(), cg = ctx.createGain();
    c.type = "sine"; c.frequency.setValueAtTime(f * 6.27, t);
    cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.012, t + 0.002); cg.gain.setTargetAtTime(0, t + 0.002, 0.03);
    c.connect(cg); cg.connect(out); c.start(t); c.stop(t + 0.4);
    var k = ctx.createBufferSource(), kg = ctx.createGain();
    k.buffer = tapBuf(ctx); kg.gain.value = 0.02;
    k.connect(kg); kg.connect(out); k.start(t);
    var k2 = ctx.createBufferSource(), kg2 = ctx.createGain();       // the stem touching the wood
    k2.buffer = tapBuf(ctx); kg2.gain.value = 0.012;
    k2.connect(kg2); kg2.connect(out); k2.start(t + 0.86);
    return 9;
  }
  function perform(ctx, dest, t, material, stream, hooks) {
    var VV = window.KOLOB.VoicesVocal;
    if (!VV || !VV.desk) throw new Error("KOLOB.GuestSingingSchool: load kolob-voices-vocal.js first");
    hooks = hooks || {};
    var sc = score(material, stream, t);
    var synth = need(stream).fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL; bus.connect(dest);
    // THE CHOIR: two desks a part, three people a desk; how sure each desk is
    // (the section that goes wrong is a little less sure of itself). Their
    // breath is kept light: the owner hears breath between sung notes as a
    // fault, and a practice in a quiet chapel carries it far.
    var mk = sc.lesson.mistake;
    var desks = sc.desks.map(function (d) {
      var r = synth.fork("desk:" + d.id);
      var wrongOnes = d.group === mk.group;
      return VV.desk({
        part: d.voice, voices: 3, rand: r, name: "school-" + d.id,
        age: r.pick(["young", "mid", "mid", "old"]),
        confidence: wrongOnes ? r.rnd(0.5, 0.65) : r.rnd(0.62, 0.85),
        brightness: r.rnd(0.38, 0.6), breath: r.rnd(0.12, 0.22),
        lag: r.rnd(0, 0.04), spreadMs: r.rnd(16, 30), detuneCents: r.rnd(6, 11),
        pan: d.pan,
      });
    });
    var chorister = VV.singer({ part: "A", age: "mid", confidence: 0.95, brightness: 0.55, breath: 0.2, rand: synth.fork("chorister"), name: "chorister", pan: 0.02, vibrato: { rate: 5.3, depth: 26, onsetDelay: 0.4 } });
    // (a phone's choir is one desk a part: each desk carries what two did)
    var G_DESK = 0.42 * (sc.prepared.phone ? Math.SQRT2 : 1), G_CHOR = 0.75;
    // THE DOOR. A voice that lets one sample of its breath noise through at
    // the instant each sung line's throat is built, 0.45 s before the
    // line's first vowel — its noise starting on the same sample as its
    // gains' first automation, while they still stand at their default of 1
    // — makes, thirty-two singers a line, a tick in every breath between
    // lines. For such a voice each line sings through a door of its own,
    // shut for the first 4 ms of the throat's life and open well before the
    // inhale (0.42 s before the vowel): one gain node a line. The voice
    // kolob-voices-vocal.js loads is born silent (measured: nothing before
    // the sound) and exports its mouth (VoicesVocal._mouth), so CAST is
    // always true today and the DOOR branch never runs; it is kept for a
    // voice that is not born silent.
    var CAST = !!VV._mouth, DOOR = !CAST;
    function door(t) {
      if (!DOOR) return bus;
      var born = t - 0.45, g = ctx.createGain();
      g.gain.setValueAtTime(0, Math.max(0, born - 0.01));
      g.gain.setValueAtTime(0, Math.max(0, born + 0.004));
      g.gain.linearRampToValueAtTime(1, Math.max(0, born + 0.02));
      g.connect(bus);
      return g;
    }
    // LAID OUT A LINE AT A TIME (hooks.defer — the engine's clock): each
    // sung line is built AHEAD seconds before its throat is born, and the
    // desks that start together are laid a fifth of a second apart, each in
    // a tick of the clock of its own — a practice built in one cue cost 120–
    // 250 ms of main thread (measured in a live context); a lab with no
    // clock lays everything out at once
    var AHEAD = 2.5, BORN = 0.5, STAGGER = 0.2;
    function lay(it, fn) {
      var when = it.t - (it.kind === "sing" || it.kind === "chorister" ? BORN : 0.05) - AHEAD - (it.kind === "sing" ? STAGGER * it.desk : 0);
      if (hooks.defer && when > t + 0.05) hooks.defer(when, fn);
      else fn();
    }
    sc.items.forEach(function (it) {
      lay(it, function () {
        if (it.kind === "sing") {
          var notes = it.notes.map(function (n) { return n.rest ? { rest: true, dur: n.dur } : { f: n.f, dur: n.dur, vowel: n.vowel, stress: n.stress }; });
          var g = G_DESK * (it.stage === "pitch" ? 0.55 : it.stage === "alone" ? 1.12 : it.stage === "again" ? 1.06 : 1);
          desks[it.desk].sing(ctx, door(it.t), it.t, notes, g);
        } else if (it.kind === "chorister") {
          chorister.sing(ctx, door(it.t), it.t, it.notes.map(function (n) { return { f: n.f, dur: n.dur, vowel: n.shape ? said(n.shape, "chorister", CAST) : n.vowel }; }), G_CHOR);
        } else if (it.kind === "fork") {
          fork(ctx, bus, it.t, it.f);
        } else if (it.kind === "tap") {
          var s = ctx.createBufferSource(), g2 = ctx.createGain();
          s.buffer = tapBuf(ctx); g2.gain.value = 0.16 * it.v;
          var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
          s.connect(g2);
          if (p) { p.pan.value = 0.04; g2.connect(p); p.connect(bus); } else g2.connect(bus);
          s.start(it.t);
        }
        // (each line's notes told as it is laid out, as the trombones' are)
        if (hooks.onNote && it.noteTo > it.noteFrom) sc.notes.slice(it.noteFrom, it.noteTo).forEach(function (n) { hooks.onNote(n); });
      });
    });
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
    var sg = ctx.createGain(); sg.gain.value = 0;
    sent.connect(sg); sg.connect(bus);
    sent.onended = function () { try { sg.disconnect(); sent.disconnect(); bus.disconnect(); } catch (e) { /* gone */ } };
    sent.start(Math.max(0, t)); sent.stop(sc.end + 2);
    perform.last = { score: sc };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, lesson: lesson, score: score, perform: perform,
    clashOf: clashOf, ODDS: ODDS, EXPERIMENT: EXPERIMENT, NAME: NAME, LABEL: LABEL,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
    get CONSONANTS() { return { section: CONSONANTS.section, chorister: CONSONANTS.chorister }; },
    set CONSONANTS(v) { v = v || {}; ["section", "chorister"].forEach(function (k) { if (SAID[v[k]] || v[k] === "auto") CONSONANTS[k] = v[k]; }); },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-singingschool.js"] = true;   // the load guard's roll call

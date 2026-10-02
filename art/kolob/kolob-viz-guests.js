// ============================================================================
// KOLOB — kolob-viz-guests.js: the new guests on the staff
//
// One of the page's six files (kolob-viz.js raises KolobViz over them; THE
// SIX FILES there, and _viz.php's list): the far tower's change ringing, the
// gulls, the far ward, the handcart company, the Social Hall's fiddle and its
// caller, the testimony-bearers and the reed that answers them, the gift of
// tongues and the ward's hum, the organist's variations — each taken from the
// call that wrote it (takeNewGuests, which kolob-viz-intake.js's flushIntake
// hands every call) and printed in the page's own vocabulary (below). Lends
// NEW_GUEST_LAYERS and takeNewGuests; borrows the intake's reading and setting
// of notes and the hymnal's of its hymns; reads the conductor's report
// (VS.cond) from kolob-viz.js.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  // The page's shared state. Each of the page's files lends what the others
  // need onto VS (the LENT block at its foot); a name written VS.x belongs to
  // another of them; a bare name is this file's own or borrowed below.
  var VS = window.KOLOB._viz = window.KOLOB._viz || {};

  // ---- BORROWED — the other files' functions, bound late through VS (every
  // file is loaded before the first frame, so the call always finds its owner;
  // each wrapper is named after the lend it calls and passes its arguments
  // through in order — tools/lends.js checks), and their values that are
  // never reassigned, taken once at load from a file loaded before this one ----
  // from kolob-viz-atlas.js
  function clamp(x, a, b) { return VS.clamp(x, a, b); }
  // from kolob-viz-intake.js
  function noteQ(freq) { return VS.noteQ(freq); }
  function estimateBeat(durs, fallback) { return VS.estimateBeat(durs, fallback); }
  function takeLayer(layer, ns, beat, opt) { return VS.takeLayer(layer, ns, beat, opt); }
  function ledgerCost(st, q) { return VS.ledgerCost(st, q); }
  var COLLECTIONS = VS.COLLECTIONS;
  var Q_MID = VS.Q_MID;
  var groups = VS.groups;
  var lastBeat = VS.lastBeat;
  var marks = VS.marks;
  // from kolob-viz-hymnal.js
  function hymnOf(id) { return VS.hymnOf(id); }
  function shapeOfDeg(mode, deg) { return VS.shapeOfDeg(mode, deg); }
  function monzoCents(m) { return VS.monzoCents(m); }
  function keySteps(m) { return VS.keySteps(m); }
  function timeSig(mot) { return VS.timeSig(mot); }
  function makeBeam(gs, st) { return VS.makeBeam(gs, st); }
  // (the other files' state, read through VS: VS.cond)

  // ==========================================================================
  // THE NEW GUESTS ON THE STAFF
  //
  // Nine guests came into the meeting after the staff was laid out, and it
  // sat nearly blank under most of them. Each prints in the page's own
  // vocabulary, as plainly as it can be written truly, in the one green ink;
  // the far ones paler, as the far choir and the old tune are:
  //
  //  · THE FAR TOWER's change ringing: every stroke a bell's ringed head,
  //    small and pale across the valley — rounds a stair of heads down the
  //    scale, the changes the same stair with its steps changed a pair at a
  //    time (takeTower);
  //  · THE HANDCART COMPANY's unison in octaves: the women's line (and the
  //    child's, the same heads) on the treble, the men's and the captain's
  //    an octave under it on the bass, in the key the company chose, pale as
  //    the road is far and fullest where it passes nearest (takeHandcart);
  //  · THE GULLS: each cry a small head with no stem, the lead gull's in the
  //    first hymn's own shapes — the head of the hymn, cried — and the
  //    flock's chatter round, not ours (takeGulls);
  //  · THE FAR WARD: the same hymn a line behind, in closed score, pale, as
  //    the far choir prints, and small, stepping aside for ours (takeFarWard);
  //  · THE SOCIAL HALL: the fiddle's reel (or jig, or quadrille) in small heads,
  //    the hymn's own notes in it a heavier head, its running eighths beamed
  //    by the beat, a bar at each bar, a double bar where a strain goes
  //    round or the next begins, the final bar after its last double stop;
  //    its cuts and slides marked; the open string it leans on a whole note
  //    under the tune; the caller's calls as spoken heads (takeFiddle,
  //    takeSpoken);
  //  · THE TESTIMONY-BEARERS: speech written as speech — a cross for each
  //    syllable at its pitch, no stem (it keeps no beat), the stressed ones
  //    heavier; the reed that plays the words back does so in the words'
  //    own rhythm, so its heads have no stems either, and a note it plays
  //    with the speaker shares the speaker's head; the tune it makes of them
  //    prints as any tune (takeSpoken, takeReedWords);
  //  · THE GIFT OF TONGUES: one line on the staff that suits it, a slur over
  //    each melisma, its quick notes a singer's run (small, beamed); the
  //    ward's hummed chord in its four parts (takeTongues);
  //  · THE ORGANIST'S VARIATIONS: the organ alone, as it prints, with a bar
  //    where the Score has one (the theme, the trio's tune in the pedals,
  //    the finale; the re-barred dances keep none), and the bitonal
  //    interlude's own bass (takeVariations).
  //
  // The Hosanna never prints (the owner's ruling: audio-only; onNote).
  // Nothing here is text, and nothing moves but the scroll and the drying.
  // ==========================================================================
  var NEW_GUEST_LAYERS = { fiddle: 1, handcart: 1, gulls: 1, tower: 1, farward: 1 };
  // A note's place and shape in a key of its own, as the note names it: its
  // degree (deg), else its interval (monzo), else its sound — counted from
  // the key's tonic (keyM, from the day's keynote), in the octave it sounds
  // in; its shape the syllable it is sung on in that key's mode.
  function keyedQ(freq, keyM, deg, monzo, mode) {
    var tonic = (VS.cond.f0 || 65) * 4 * Math.pow(2, (keyM ? monzoCents(keyM) : 0) / 1200);
    var c = typeof deg === "number" ? null : monzo ? monzoCents(monzo) : 1200 * Math.log2(freq / tonic);
    var st = c == null ? deg : Math.round(c * 7 / 1200);
    st += 7 * Math.round(Math.log2(freq / tonic) - (c == null ? deg / 7 : c / 1200));
    var q = Q_MID + keySteps(keyM) + st;
    while (q < -24) q += 7;                        // (a guard only: the page folds at draw time)
    while (q > 44) q -= 7;
    return { q: q, shape: shapeOfDeg(mode || VS.cond.mode, st) };
  }
  // (the groups one takeLayer call made, and a guest's own cap on them; line:
  // the one line they make, which reads in the order it is sung — orderAt)
  function madeSince(g0, cap, line) {
    var out = groups.slice(g0);
    if (cap != null) out.forEach(function (gr) { gr.cap = cap; gr.tight = true; if (line) gr.line = line; });
    return out;
  }
  // "free" notes — a cry, a syllable, a bell's stroke: heads with no stem
  function unstemmed(gs, open) {
    gs.forEach(function (gr) {
      gr.noStem = true; gr.flags = 0;
      gr.heads.forEach(function (h) { h.open = !!open; h.dots = 0; });
    });
  }
  // One call's notes, read by guest. The guests with layers of their own
  // come whole; those on the house's layers (the gift and the caller on the
  // choir's, the reeds that answer a testimony, the organist's variations)
  // are taken out of theirs by what their notes say, and the rest of the
  // house's notes print as they always have.
  function takeNewGuests(byLayer) {
    function pull(layer, test) {
      var ns = byLayer[layer];
      if (!ns) return [];
      var mine = ns.filter(test), rest = ns.filter(function (n) { return !test(n); });
      if (rest.length) byLayer[layer] = rest; else delete byLayer[layer];
      return mine;
    }
    function own(layer, fn) { if (byLayer[layer]) { fn(byLayer[layer]); delete byLayer[layer]; } }
    own("tower", takeTower);
    own("handcart", takeHandcart);
    own("gulls", takeGulls);
    own("farward", takeFarWard);
    own("fiddle", takeFiddle);
    own("voice", function (ns) { takeSpoken(ns, "voice"); });
    var calls = pull("choir", function (n) { return n.guest === "socialhall"; });
    if (calls.length) takeSpoken(calls, "choir");
    var gift = pull("choir", function (n) { return n.guest === "tongues" && n.role === "tongues"; });
    if (gift.length) takeTongues(gift);
    var hum = pull("choir", function (n) { return n.guest === "tongues" && n.role === "hum"; });
    if (hum.length) takeHum(hum);
    ["harmonium", "clarinet"].forEach(function (ly) {
      var words = pull(ly, function (n) { return n.testimony && (n.move === "echo" || n.move === "double"); });
      if (words.length) takeReedWords(words, ly);
    });
    var vars = pull("organ", function (n) { return n.variations; });
    if (vars.length) takeVariations(vars);
  }

  // ---- change ringing from a far tower ----------------------------------------
  // Each stroke a bell's head, ringed as the steeples' bells are, small and
  // pale: the tower is across the valley. Rounds print as a stair of heads
  // down the scale, row after row, the handstroke's pause the page's own
  // time; the changes as the same stair with its steps swapped a pair at a
  // time, so the method can be read from the heads alone (the ringers' blue
  // line is the path one bell's head takes through the rows; the page leaves
  // it to the eye, as it leaves the words). A muffled touch is paler still.
  // (The head is filled, and its ring stands a fifth of a space off
  // it — a hollow head in a ring that hugged it read as two outlines, one
  // inside the other: the second stroke the owner ruled out. The ring is the
  // bell's one outline, 0.4 sp round about a smaller head: two strokes a
  // step apart (1.15 sp at the page's rate) stand clear of each other with
  // room to spare, so a stroke pushed aside catches up within a few. The
  // peal is one line, printed in the order it is rung — the method is read
  // from that order.)
  var TOWER_INK = 0.5, TOWER_MUFFLED = 0.32, TOWER_SCALE = 0.3, TOWER_RING = 1.333;   // (small: a peal's strokes come a staff space apart at the page's rate; the ring, in the head's own size: 0.4 sp)
  function takeTower(ns) {
    var g0 = groups.length;
    takeLayer("tower", ns, 1, { scale: TOWER_SCALE, ink: ns[0].muffled ? TOWER_MUFFLED : TOWER_INK,
      qOf: function (n) { return keyedQ(n.freq, null, null, n.monzo, VS.cond.mode); } });
    var gs = madeSince(g0, 1, "peal");
    unstemmed(gs, false);
    gs.forEach(function (gr) { gr.ring = true; gr.ringK = TOWER_RING; });
  }

  // ---- the gulls ---------------------------------------------------------------
  // A cry is not a note of a tune, and keeps no beat: each prints as a small
  // head with no stem, where it is cried and as loud as it carries. The lead
  // gull's cries trace the head of the day's first hymn, so its heads are the
  // hymn's own shapes on the hymn's own degrees (the joke, made visible); the
  // flock's chatter prints round, as a stranger's notes do.
  var GULL_SCALE = 0.6, CHATTER_SCALE = 0.5;
  function takeGulls(ns) {
    ns.forEach(function (n) {
      var h = n.hymnId ? hymnOf(n.hymnId) : null, lead = typeof n.deg === "number", g0 = groups.length;
      takeLayer("gulls", [n], 1, { scale: lead ? GULL_SCALE : CHATTER_SCALE, ink: clamp(0.2 + 0.8 * (n.loud == null ? 0.5 : n.loud), 0.25, 0.9),
        qOf: function (m) {
          if (lead) return keyedQ(m.freq, h && h.keyMonzo, m.deg, null, h && h.mode);
          return { q: noteQ(m.freq).q, shape: "round" };
        } });
      unstemmed(madeSince(g0, 1, "gulls"), false);   // (the flock's cries print in the order they are cried, a hair apart where they come together)
    });
  }

  // ---- the far ward ------------------------------------------------------------
  // Another congregation across the valley, singing our hymn a line behind
  // us in its own tuning: printed as the far trombone choir is, in closed
  // score and pale, each part on its own staff with its own stem, placed by
  // the degree it sings in the hymn's key and written in our verse's beat —
  // at grace size (it is across the valley, and it sings on our beats: four
  // voices to a staff, where full heads would crowd our bars), and it gives
  // way to our hymn: on a beat it shares with us our notes are set first and
  // its notes step aside for them, and it waits for a bar of ours just after
  // it (barWaits). Nothing of either is printed over the other.
  var FARWARD_INK = 0.42, FARWARD_SCALE = 0.6;
  function takeFarWard(ns) {
    var h = hymnOf(ns[0].hymnId), mode = h.mode || VS.cond.mode;
    var beat = h.bs || estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.farward || lastBeat.choir || 1.15);
    if (!h.bs && ns.length >= 3) lastBeat.farward = beat;
    var g0 = groups.length;
    takeLayer("farward", ns, beat, { strict: true, ink: FARWARD_INK, fineBeat: !!h.bs, scale: FARWARD_SCALE,
      qOf: function (n) { return typeof n.deg === "number" ? keyedQ(n.freq, h.keyMonzo, n.deg, null, mode) : null; } });
    // (and on each staff its notes read left to right in the
    // order they are sung, whichever part sings them — a part's note set
    // late no longer prints after a later note of the other part: orderAt)
    madeSince(g0, 1.5, "farward").forEach(function (gr) { gr.yields = true; });
  }

  // ---- the handcart company ----------------------------------------------------
  // ALL IS WELL in unison as the company walks: the women (and the child
  // among them) on the treble, the men and the captain an octave under them
  // on the bass — one line in octaves, each voice its own stem. The company
  // sings in a key of its own choosing (the day's, its dominant's or its
  // subdominant's), read from its notes, and the heads are that key's shapes.
  // Its beat is the tune's own (each note says where it falls in its line).
  // It is always far off: pale, and palest at either end of the road. Each
  // throat's line comes on its own, so a head another voice has already
  // printed at that place is not printed again (the unison shares a head).
  var COMPANY_KEYS = [[0, 0, 0, 0], [-1, 1, 0, 0], [2, -1, 0, 0]];
  var company = null;
  function companyKey(ns) {
    var K0 = (VS.cond.f0 || 65) * 4, best = null, bc = 1e9, R = COLLECTIONS.ionian.concat([2]);
    COMPANY_KEYS.forEach(function (k) {
      var tonic = K0 * Math.pow(2, monzoCents(k) / 1200), cost = 0;
      ns.forEach(function (n) {
        var r = Math.log2(n.freq / tonic); r -= Math.floor(r);
        var e = 1;
        for (var i = 0; i < R.length; i++) e = Math.min(e, Math.abs(r - Math.log2(R[i])));
        cost += e;
      });
      if (cost < bc - 1e-9) { bc = cost; best = k; }
    });
    return best;
  }
  function takeHandcart(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var t0 = ns[0].startTime;
    if (!company || t0 - company.t1 > 40) company = { key: companyKey(ns), t1: t0, seen: {}, beat: 0 };
    var rs = [], loud = 0;
    for (var i = 1; i < ns.length; i++) {
      var a = ns[i - 1], b = ns[i];
      if (a.line === b.line && a.verse === b.verse && typeof a.beat === "number" && typeof b.beat === "number" && b.beat > a.beat)
        rs.push((b.startTime - a.startTime) / (b.beat - a.beat));
    }
    rs.sort(function (x, y) { return x - y; });
    if (rs.length >= 2) company.beat = clamp(rs[rs.length >> 1], 0.3, 3);
    var beat = company.beat || estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.choir || 1.15);
    // (a walking company sings its notes short of their length, and breathes:
    // each note is written for as long as the tune gives it, to the next
    // note's beat in its line — the last of a line as it is sung)
    var written = {};
    if (company.beat) ns.forEach(function (n, i) {
      for (var j = i + 1; j < ns.length; j++) {
        var m = ns[j];
        if (m.voice !== n.voice || m.verse !== n.verse || m.line !== n.line || typeof m.beat !== "number" || typeof n.beat !== "number") continue;
        if (m.beat > n.beat) { written[i] = (m.beat - n.beat) * beat; break; }
      }
    });
    var key = company.key, mine = [];
    ns.forEach(function (n, i) {
      var nq = keyedQ(n.freq, key, null, null, "ionian"), at = company.seen[nq.q] = company.seen[nq.q] || [];
      company.t1 = Math.max(company.t1, n.startTime + n.duration);
      for (var j = 0; j < at.length; j++) if (Math.abs(at[j] - n.startTime) < 0.12) return;
      at.push(n.startTime);
      loud += n.loud == null ? 0.5 : n.loud;
      mine.push({ freq: n.freq, startTime: n.startTime, duration: written[i] || n.duration, part: n.octave < 0 ? "B" : "S", nq: nq });
    });
    Object.keys(company.seen).forEach(function (q) { company.seen[q] = company.seen[q].filter(function (t) { return t > t0 - 30; }); });
    if (!mine.length) return;
    var g0 = groups.length;
    takeLayer("handcart", mine, beat, { strict: true, fineBeat: !!company.beat, ink: clamp(0.14 + 0.42 * loud / mine.length, 0.18, 0.56),
      qOf: function (n) { return n.nq; } });
    madeSince(g0, 1.5, "company");
  }

  // ---- the Social Hall ---------------------------------------------------------
  // The fiddle's dance, made of one of the day's hymns, printed as a fiddler's
  // tunebook prints a reel: on the treble in small heads (it runs in eighths
  // a staff space apart at the page's rate, and each bar must find its room
  // between them: at full size the bars would stand on the ink), the hymn's
  // own notes in it a heavier head — the tune marked, as in the hymns — and
  // the fiddler's figures between them plain; a double stop two heads on one
  // stem; the running eighths beamed within the beat (in pairs in 2/4, in
  // threes in 6/8); a bar at each bar; a double bar where a strain goes round again or
  // the next begins; the final bar after its last double stop. Its cuts and
  // slides are marked where the fiddler plays them (the Old Way's signs: a
  // grace, a slide). The open string it leans on is a whole note, where it
  // sounds. The notes are placed in the danced hymn's key, by their degree.
  // The fiddle is in the room with us, a step nearer than the ward: full ink.
  var FIDDLE_SCALE = 0.55, FIDDLE_CAP = 3;
  var FIDDLE_TUNE = { tune: 1, cad: 1 }, FIDDLE_ORN = { cut: "grace", slide: "slide" };
  var hall = null;                                 // the dance being printed: its hymn, its eighth, where its bars fall
  function fiddleEighth(ns) {                      // the running note: the shortest length the fiddle keeps to
    var bins = {}, mx = 0;
    ns.forEach(function (n) {
      if (n.part === "drone" || n.part === "stop" || !(n.duration > 0.08 && n.duration < 0.6)) return;
      var k = Math.round(Math.log2(n.duration) * 25);
      bins[k] = (bins[k] || 0) + 1; mx = Math.max(mx, bins[k]);
    });
    var ks = Object.keys(bins).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < ks.length; i++) if (bins[ks[i]] >= 0.25 * mx && bins[ks[i]] >= 2) return Math.pow(2, ks[i] / 25);
    return 0;
  }
  function takeFiddle(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var id = ns[0].dances || null, t0 = ns[0].startTime;
    if (!hall || hall.id !== id || t0 - hall.t1 > 20) hall = { id: id, e: 0, last: null, bars: [], lens: [], finalAt: 0, finalBar: null, t1: t0 };
    var h = id ? hymnOf(id) : {}, keyM = h.keyMonzo || null, mode = h.mode || VS.cond.mode;
    if (!hall.e) hall.e = fiddleEighth(ns);
    var beat = 2 * (hall.e || 0.19);
    ns.forEach(function (n) { hall.t1 = Math.max(hall.t1, n.startTime + n.duration); });
    var line = ns.filter(function (n) { return n.part !== "drone"; }), drones = ns.filter(function (n) { return n.part === "drone"; });
    var qOf = function (n) { return keyedQ(n.freq, keyM, n.deg, n.monzo, mode); };
    var g0 = groups.length;
    if (line.length) takeLayer("fiddle", line, beat, { staff: "T", scale: FIDDLE_SCALE, fineBeat: true, qOf: qOf,
      head: function (n, hd) { if (FIDDLE_TUNE[n.part]) hd.heavy = true; if (FIDDLE_ORN[n.orn]) hd.orn = FIDDLE_ORN[n.orn]; } });
    var made = madeSince(g0, FIDDLE_CAP, "fiddle");
    if (drones.length) {
      var d0 = groups.length;
      takeLayer("fiddle", drones, beat, { scale: FIDDLE_SCALE, qOf: qOf });
      madeSince(d0, FIDDLE_CAP);
    }
    fiddleBars(made, line);
    fiddleBeams(made);
  }
  // Where the dance's bars fall: each note names its strain, the time
  // through, its line and its bar, and a bar begins wherever that changes.
  // A double bar where a strain begins, or goes round again (its line or its
  // bar going back: the AA, the BB, the tag), the final bar where the last
  // double stop ends. Each bar is set as the hymn's are (barPlace): clear of
  // the ink either side, its downbeat's notes making room for it if they must.
  function fiddleBars(made, ns) {
    var at = {};
    made.forEach(function (gr) { if (gr.st === "T") { var k = Math.round(gr.tp * 1000); (at[k] = at[k] || []).push(gr); } });
    ns.forEach(function (n) {
      if (n.part === "stop") return;
      var fin = n.part === "final" || n.strain == null, L = hall.last;
      var cur = fin ? { strain: "final" } : { strain: n.strain + "|" + n.time, line: n.line, bar: n.bar };
      if (fin) hall.finalAt = Math.max(hall.finalAt || 0, n.startTime + n.duration);
      if (L && L.strain === cur.strain && L.line === cur.line && L.bar === cur.bar) return;
      hall.last = cur;
      var prev = hall.bars.length ? hall.bars[hall.bars.length - 1] : null;
      hall.bars.push(n.startTime);                  // (the dance's first note begins its first bar: no bar before it)
      if (!L || prev == null || n.startTime <= prev + 1e-6) return;
      var round = L.strain === cur.strain && (cur.line < L.line || (cur.line === L.line && cur.bar < L.bar));
      var type = !fin && (L.strain !== cur.strain || round) ? "double" : "single";
      fiddleBar(type, n.startTime, at[Math.round(n.startTime * 1000)] || []);
      hall.lens.push(Math.round((n.startTime - prev) / (hall.e || 0.19)));
    });
    if (hall.bars.length > 64) hall.bars.splice(0, hall.bars.length - 64);
    if (hall.lens.length > 64) hall.lens.splice(0, hall.lens.length - 64);
    if (hall.finalAt && !hall.finalBar) hall.finalBar = fiddleBar("final", hall.finalAt, []);
  }
  function fiddleBar(type, tp, nx) {
    var bm = { kind: "bar", type: type, tp: tp, sts: ["T"], off: type === "final" ? 0 : -1, pv: [], pvRests: [], nx: nx, sys: { hymnId: null } };
    nx.forEach(function (gp) { gp.barIn = bm; });
    marks.push(bm);
    return bm;
  }
  // The running eighths beamed within the beat: in threes where the bar
  // holds six of them (a jig, a 6/8 quadrille), else in pairs; a longer note
  // or a bar breaks the beam. The beam takes the position rule over its notes.
  function fiddleBeams(made) {
    var six = 0;
    hall.lens.forEach(function (k) { if (k === 6 || k === 3) six++; });
    var win = (six * 2 > hall.lens.length ? 3 : 2) * (hall.e || 0.19);
    var run = [], key = null;
    function close() { if (run.length > 1) { makeBeam(run, "T"); run[0].beam.fixed = 0; } run = []; key = null; }
    made.filter(function (gr) { return gr.st === "T" && !gr.noStem; }).sort(function (a, b) { return a.tp - b.tp; }).forEach(function (gr) {
      if (gr.barIn || !(gr.flags >= 1) || (run.length && Math.abs(run[run.length - 1].tp - gr.tp) < 1e-6)) close();
      if (!(gr.flags >= 1)) return;
      var ref = gr.tp;                             // (the bar it lies in)
      for (var i = 0; i < hall.bars.length; i++) if (hall.bars[i] <= gr.tp + 1e-6) ref = hall.bars[i];
      var k = ref + ":" + Math.floor((gr.tp - ref) / win + 0.02);
      if (key != null && k !== key) close();
      key = k; run.push(gr);
    });
    close();
  }

  // ---- speech: the testimony-bearers, and the caller ------------------------------
  // Speech is written as speech has long been written in music: a cross for
  // each syllable, at the pitch it is spoken on, and no stem — it keeps no
  // beat. A stressed syllable is a heavier cross. The caller's calls are the
  // same (chanted on the tune's fifth, but spoken, not sung).
  var spoken = [];                                 // (the syllables just printed: a reed that plays with the speaker shares them)
  // (two crosses side by side keep a fifth of a space between them —
  // closer, their arms met tip to tip and read as one mark, XX)
  var SPOKEN_AIR = 0.2;
  function takeSpoken(ns, layer) {
    var g0 = groups.length;
    takeLayer(layer === "voice" ? "voice" : "caller", ns, 1, { shape: "x",
      head: function (n, hd) { if (n.accent) hd.heavy = true; } });
    var gs = madeSince(g0, 3, "speech"), tl = 0;             // (a call on a strain's downbeat stands clear of its double bar)
    unstemmed(gs, false);
    gs.forEach(function (gr) { tl = Math.max(tl, gr.tp); gr.air = SPOKEN_AIR; gr.heads.forEach(function (h) { spoken.push({ tp: gr.tp, q: h.q }); }); });
    while (spoken.length && spoken[0].tp < tl - 40) spoken.shift();
  }
  // The reed that answers a testimony: where it plays the words back, or
  // with the speaker, it keeps the words' own rhythm, so its heads have no
  // stems either (its size the reed's own: the harmonium's grace, the
  // clarinet's cue); a note it plays with the speaker, on the speaker's
  // place, is the speaker's head already. The tune it makes of the words
  // prints as a tune (it is left to the house's own reading).
  function takeReedWords(ns, layer) {
    var mine = ns.filter(function (n) {
      if (n.move !== "double") return true;
      var q = noteQ(n.freq).q;
      for (var i = spoken.length - 1; i >= 0; i--) if (spoken[i].q === q && Math.abs(spoken[i].tp - n.startTime) < 0.06) return false;
      return true;
    });
    if (!mine.length) return;
    var g0 = groups.length;
    takeLayer(layer, mine, 1, {});
    unstemmed(madeSince(g0, 1), false);
  }

  // ---- the gift of tongues -----------------------------------------------------
  // One of the ward rises and sings a free song: one line on the staff it
  // sits best on (as the old tune is set), at its values in the beat it is
  // sung to, its stems by where its heads lie; a slur over each melisma, from
  // the syllable's first note to its last. The ward's hummed chord at the end
  // prints in its four parts, a head a part (takeHum, below).
  var TONGUES_RUN = 0.55;
  function takeTongues(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var beat = estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.tongues || lastBeat.choir || 1.15);
    if (ns.length >= 3) lastBeat.tongues = beat;
    var cT = 0, cB = 0, line = ns.map(function (n) {
      var nq = keyedQ(n.freq, null, n.deg, n.monzo, VS.cond.mode);
      cT += ledgerCost("T", nq.q); cB += ledgerCost("B", nq.q);
      return { freq: n.freq, startTime: n.startTime, duration: n.duration, nq: nq, slur: !!n.slur };
    });
    var st = cT <= cB ? "T" : "B", g0 = groups.length;
    takeLayer("choir", line, beat, { staff: st, qOf: function (n) { return n.nq; } });
    var at = {};
    madeSince(g0, 1.5, "tongues").forEach(function (gr) { at[Math.round(gr.tp * 1000)] = gr; });
    var first = null, last = null, run = [], seg = [];
    function slur() {
      if (first && last && last.grp !== first.grp) marks.push({ kind: "slur", tp: first.grp.tp, tp2: last.grp.tp, g1: first.grp, g2: last.grp, q1: first.q, q2: last.q, st: st, line: seg.slice() });
      first = last = null; seg = [];
    }
    function beamRun() { if (run.length > 1) { makeBeam(run, st); run[0].beam.fixed = 0; } run = []; }
    line.forEach(function (x) {
      var grp = at[Math.round(x.startTime * 1000)];
      if (!grp) return;
      if (!x.slur) { beamRun(); slur(); first = { grp: grp, q: x.nq.q }; seg = [grp]; }
      else if (first) { last = { grp: grp, q: x.nq.q }; if (seg.indexOf(grp) < 0) seg.push(grp); }
      // (a melisma's quick notes, quicker than the page can print full
      // heads, are the singer's run: small notes, beamed, under the slur)
      if (x.slur && x.duration < 0.6 * beat) { grp.scale = TONGUES_RUN; if (grp.flags >= 1 && !grp.noStem) run.push(grp); else beamRun(); }
      else if (x.slur) beamRun();
    });
    beamRun();
    slur();
  }
  // The ward hums the song's last note: every throat of a part on one note,
  // each entering a moment after the last, over a second or two and across
  // the engine's calls. A part prints once, one head however many throats
  // hum it (as the whole ward's unison does), from its first throat's entry.
  var hummed = [];
  function takeHum(ns) {
    var mode = VS.cond.mode, fresh = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; }).filter(function (n) {
      var q = keyedQ(n.freq, null, n.deg, n.monzo, mode).q;
      for (var i = 0; i < hummed.length; i++) if (hummed[i].part === n.part && hummed[i].q === q && Math.abs(n.startTime - hummed[i].t) < 3) return false;
      hummed.push({ part: n.part, q: q, t: n.startTime });
      return true;
    });
    while (hummed.length > 32) hummed.shift();
    if (!fresh.length) return;
    var g0 = groups.length;
    takeLayer("choir", fresh, lastBeat.tongues || lastBeat.choir || 1.15, { qOf: function (n) { return keyedQ(n.freq, null, n.deg, n.monzo, mode); } });
    madeSince(g0, 1.5);
  }

  // ---- the organist's variations ------------------------------------------------
  // The organ alone, printed as the organ alone prints (chords on shared
  // stems, only where no one sings over it), in the beat the set is played
  // to — the theme's notes say where they fall in their line, so the beat is
  // read from them, as the old tune's is — with a bar wherever the Score has
  // one: at each note that falls on a downbeat of the hymn's mode of time,
  // counted from its line's place in the bar. The dances are re-barred (a
  // minuet in 3/4, a march in 2/4) and their notes say no beat: they keep no
  // bars rather than the wrong ones. The pedal doubles the manuals' bass
  // through the set (a 16′ under it, not written, as ever) — except in the
  // bitonal interlude, where it plays the other key's bass alone: that line
  // is written.
  var varBars = [];                                // (the downbeats already barred: a phrase's notes may come in two calls)
  var varSet = null;                               // (the set being printed: its hymn, each part's last note, the beats read)
  function takeVariations(ns) {
    ns = ns.filter(function (n) {
      if (n.part !== "pedal" && !n.pedal) return true;
      for (var i = 0; i < ns.length; i++) {
        var m = ns[i], d = Math.log2(m.freq / n.freq);
        if (m.part === "B" && Math.abs(m.startTime - n.startTime) < 0.03 && Math.abs(d - Math.round(d)) < 0.02) return false;
      }
      return true;
    });
    if (!ns.length) return;
    // (the organist lays the set a chord at a time, so the beat is read
    // across the calls: each part's note against its last in the same line)
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var h = ns[0].hymnId ? hymnOf(ns[0].hymnId) : null, sc = h && h.score;
    if (!varSet || varSet.id !== (h && h.id) || ns[0].startTime - varSet.t1 > 12) varSet = { id: h && h.id, prev: {}, rs: [], t1: 0 };
    ns.forEach(function (n) {
      varSet.t1 = Math.max(varSet.t1, n.startTime + n.duration);
      if (typeof n.beat !== "number" || n.line == null) return;
      var k = n.part + "|" + n.line, p = varSet.prev[k];
      if (p && n.beat > p.beat && n.startTime > p.t + 0.02) varSet.rs.push((n.startTime - p.t) / (n.beat - p.beat));
      varSet.prev[k] = { t: n.startTime, beat: n.beat };
    });
    while (varSet.rs.length > 24) varSet.rs.shift();
    var rs = varSet.rs.slice().sort(function (a, b) { return a - b; });
    var fine = rs.length >= 2, beat = fine ? clamp(rs[rs.length >> 1], 0.3, 2.4)
      : estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.organ || lastBeat.choir || 1.15);
    ns.forEach(function (n) {                      // (where the beat falls: the last note that names its beat)
      if (typeof n.beat === "number" && Math.abs(n.beat - Math.round(n.beat)) < 1e-6) varSet.ref = { t: n.startTime, b: n.beat };
    });
    var g0 = groups.length;
    takeLayer("organ", ns, beat, { fineBeat: fine, head: function (n, hd) { if (n.part === "fig") hd.fig = true; } });
    var made = madeSince(g0, 2);
    varFigures(made, fine ? beat : 0);
    if (!sc || !sc.lines) return;
    var vl = sc.lines.concat(sc.refrain || []), ts = timeSig(h.modeOfTime), downs = [];
    // (in the canon, and in the two keys' interlude, a voice
    // follows the leader a beat or two behind, counting the tune's beats as
    // its own — and its downbeats are not the bar's. Barred at both, the
    // canon had a bar every half bar, and each pushed the notes after it
    // further from their time, until they stood 14 spaces late. A canon is
    // barred by its leader: a note names a downbeat only where its line's
    // count began with the earliest voice's — lead)
    varSet.lead = varSet.lead || {};
    function lead(n) {
      var o = n.startTime - n.beat * beat, ls = varSet.lead[n.line] || (varSet.lead[n.line] = []);
      var win = 2 * ts.bar * beat, tol = 0.25 * beat;
      for (var i = ls.length - 1; i >= 0; i--) {
        var d = o - ls[i];
        if (d <= -win || d >= win) continue;
        if (d < -tol) { ls[i] = o; return true; }  // (an earlier voice: the leader after all)
        return d < tol;
      }
      ls.push(o);
      if (ls.length > 8) ls.shift();
      return true;
    }
    ns.forEach(function (n) {
      var ln = typeof n.beat === "number" && n.line != null ? vl[n.line] : null;
      if (!ln || !lead(n)) return;
      var pos = ((n.beat + (ln.barStart || 0)) % ts.bar + ts.bar) % ts.bar;
      if (pos > 1e-6 && ts.bar - pos > 1e-6) return;
      if (!downs.some(function (t) { return Math.abs(t - n.startTime) < 0.03; })) downs.push(n.startTime);
    });
    // (every note on a bar's downbeat stands after it, whichever
    // call brought it — the organist lays a chord at a time, and the pedal or
    // the figure on the downbeat may come a call before the bar or after it.
    // Only notes not yet set: nothing printed moves)
    function onDown(gr, bm) { return gr.layer === "organ" && !gr.col && !gr.noCol && gr.drawnAt == null && Math.abs(gr.tp - bm.tp) < 0.03; }
    made.forEach(function (gr) {
      for (var i = 0; i < varBars.length; i++) {
        var vb = varBars[i];
        if (vb.at || !onDown(gr, vb) || vb.nx.indexOf(gr) >= 0) continue;
        if (!vb.nx.some(function (m) { return m.col; })) vb.push = null;   // (its room worked out again, while none of its notes is set)
        vb.nx.push(gr); gr.barIn = vb;
      }
    });
    downs.sort(function (a, b) { return a - b; }).forEach(function (tb) {
      if (varBars.some(function (vb) { return Math.abs(vb.tp - tb) < 0.03; })) return;
      var before = groups.some(function (gr) { return gr.layer === "organ" && gr.tp < tb - 0.03 && gr.tp > tb - 6; });
      if (!before) return;                         // (no bar before the set's first note)
      // (through both staves, as an organ's bars run: a figure laid in a
      // call of its own keeps clear of the bar where it falls — clearance)
      var bm = { kind: "bar", type: "single", tp: tb, sts: ["T", "B"], off: -1, pv: [], pvRests: [], nx: [], sys: { hymnId: null } };
      groups.forEach(function (gr) { if (onDown(gr, bm)) bm.nx.push(gr); });
      bm.nx.forEach(function (gp) { gp.barIn = bm; });
      varBars.push(bm);
      marks.push(bm);
    });
    while (varBars.length > 64) varBars.shift();
  }
  // The organist's running figure (the trio's right hand, a dance's
  // accompaniment: its notes say no line) runs a staff space apart at the
  // page's rate: it prints small, the tune and its parts full, and its
  // quick notes are beamed within the beat. (0.6, near the fiddle's
  // reel. At cue size a head and its air all but filled the time between two
  // of its notes at 860 px, so a note pushed once could never catch up, and
  // the figure and the bars after it drifted a dozen spaces from their
  // time.) The organist lays them a note at
  // a time, seconds ahead, so a beam is joined across the calls — only while
  // none of its notes has yet been set on the page (nothing printed moves).
  // (While the figure runs over them on the treble — the trio's
  // flutes over the hymn's chords, the alto held under them — the staff is
  // two voices, set as two voices share a staff: the figure's stems up, the
  // chords' down. Else a figure's head fell on a chord's stem at the same
  // beat, and the two leapfrogged each other along the page. Only notes not
  // yet set are turned: nothing printed moves.)
  var VAR_FIG_SCALE = 0.6, VAR_UNDER_S = 1.5;
  function figOnly(gr) { return gr.heads.every(function (h) { return h.fig; }); }
  function varUnder(t) {
    groups.forEach(function (A) {
      if (A.layer === "organ" && A.st === "T" && !A.col && A.drawnAt == null && !A.beam && Math.abs(A.tp - t) < VAR_UNDER_S && !figOnly(A)) { A.dir = -1; A.alt = 0; }
    });
  }
  function varFigures(made, beatS) {
    made.forEach(function (gr) {
      if (!figOnly(gr)) {
        if (gr.st === "T" && varSet.figT != null && Math.abs(gr.tp - varSet.figT) < VAR_UNDER_S) { gr.dir = -1; gr.alt = 0; }
        return;
      }
      gr.scale = VAR_FIG_SCALE; gr.line = "fig";
      if (gr.st === "T") { gr.dir = 1; gr.alt = 0; varSet.figT = gr.tp; varUnder(gr.tp); }
      var run = varSet.run, ref = varSet.ref;
      if (!(gr.flags >= 1) || gr.noStem || !(beatS > 0) || !ref) { varSet.run = null; return; }
      var key = gr.st + ":" + (ref.b + Math.floor((gr.tp - ref.t) / beatS + 0.02));
      var open = run && run.key === key && run.gs[run.gs.length - 1].tp < gr.tp - 1e-6 &&
        run.gs.every(function (m) { return !m.col && m.drawnAt == null; }) && !(run.gs[0].beam && run.gs[0].beam.laid);   // (nor once its line has been looked along: beamLay)
      if (!open) { varSet.run = { key: key, gs: [gr] }; return; }
      run.gs.push(gr);
      if (run.gs[0].beam) { run.gs[0].beam.members.push(gr); gr.beam = run.gs[0].beam; gr.beam.geo = null; }
      else { makeBeam(run.gs, gr.st); gr.beam.fixed = 0; }
    });
  }

  // ==========================================================================
  // LENT — what this file shares with the rest of the page (KOLOB._viz)
  // ==========================================================================
  VS.NEW_GUEST_LAYERS = NEW_GUEST_LAYERS;
  VS.takeNewGuests = takeNewGuests;
})();

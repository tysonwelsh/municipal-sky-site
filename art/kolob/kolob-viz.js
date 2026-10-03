// ============================================================================
// KOLOB — the open hymnal (visualizer)
//
// Three instruments of seeing, all printed things:
//  · THE ORGAN — the black pipe silhouettes of the tabernacle facade, standing
//    on the wheel's horizon INSIDE the wheel, under the arch of its hour ring
//    the way a case's pipes stand under an arch, breathing with the actual
//    sound: a spectrum analyzer racked the way real pipes are racked (gravest
//    in the middle, alternating outward), each with the paper-colored mouth
//    near its foot. Fed by an AnalyserNode on the master bus; at rest it
//    settles into the quiet stepped skyline of the hymnbook cover.
//  · THE PAGE — "The Colony Tunebook": a grand
//    staff engraved the way a tunebook is engraved — two staves a
//    grand-staff gap apart, a brace, treble and bass clefs (baked outlines,
//    no font needed). Notes print as 4-shape SHAPE-NOTE heads (fa △, sol ○,
//    la ▭, mi ◇) with real stems, open/filled heads, flags and dots read from
//    their lengths, in one hymnbook-green ink from the moment they sound;
//    the ink dries as the page turns at 60 px/s. Just the notes: no signs
//    or words on the staff. Each voice is staffed by the part it reports
//    (closed score: S and A on the treble, T and B on the bass). A composed
//    hymn prints from its Score as a hymnal prints it: barlines
//    in its mode of time, double bars at its lines' ends and the final bar
//    at its end, beams, rests, fermatas and ties, its two voices a staff
//    sharing stems where they move together, the tune's heads heavier; the
//    Old Way one line with its ornaments; the organ's giving-out too, but
//    never the organ under the singing. The
//    clarinet prints cue-size, the harmonium grace-size, bells and handbells
//    as ringed heads; the trombone choir at dawn prints its chorale in closed score,
//    the far choir pale and the near one full; an old tune remembered prints
//    faint and fine in round notes; the telegraph punches its holes
//    straight into the paper down the middle; a visiting band slides
//    through in round notes on its own layer. (The shelved Question's
//    cartouches left this file on 2026-10-01:
//    shelved/kolob-question-setpiece.js.) The staves and
//    clefs are a static layer; the ink is re-engraved from data each frame,
//    and nothing moves but the scroll and the drying.
//    In the sacrament the page dries almost blank.
//  · THE WHEEL — the order of service seated round the rim of one great
//    wheel, of which the page shows only the crown: a sun low on a far
//    horizon. The section now playing is lettered at the crown beneath ONE
//    gilt arc fixed to the page, which fills as the section plays; when it
//    is full the wheel turns anticlockwise a seat beneath it and the arc
//    fills again. Spokes and hour-marks beneath the banner make the turning
//    visible; the disc inside the hour ring is left clear for the organ.
//    Postlude turns into the next meeting's prelude like any other seat — the
//    cycle is the picture.
//
// No neon, no glitch, no CRT. A printed thing.
// Public surface: window.KolobViz = { init(canvas, wheelCanvas),
//   setConductor, setWheelLabels, wheelSeatAt, setTuningMarks, probe,
//   freezeAt }
// Dev (never used by the app): ?kolobFreeze=<secs> or freezeAt(secs) holds
// the page at that second of the meeting and stops painting, so two
// captures of one seed are the same page pixel for pixel (THE FRAME-EXACT
// CAPTURE, below; tools/screens.js --freeze).
//
// THE SIX FILES. The page's drawing is six files behind this one surface,
// loaded in the order _viz.php lists them (index.php prints their tags):
//   kolob-viz-atlas.js   the ink, the clefs' outlines, the heads and the
//                        hymnal's signs, struck once a size into the atlas
//   kolob-viz-intake.js  each note's place on the staff, the notes taken in
//                        a call at a time and set as heads on stems, the
//                        trombones at dawn, the old tune, the telegraph and
//                        the band; what STOP lifts from the page; the page's
//                        notes and marks
//   kolob-viz-guests.js  THE NEW GUESTS ON THE STAFF
//   kolob-viz-hymnal.js  THE HYMNAL ON THE STAFF: a composed hymn read from
//                        its Score, the fuging, the organ under the singing
//   kolob-viz-wheel.js   the wheel and the organ facade inside it
//   kolob-viz.js         this file, last: the page's state, its geometry,
//                        its clock, the engraving and the ward's page (where
//                        each note is set, how it is struck), the band's
//                        layer, the frame, the page's lifecycle; it raises
//                        window.KolobViz over the other five
// They share what they must through one bag, KOLOB._viz (VS in each file),
// the way the engine's rooms share KOLOB._s: each lends what the others
// read in a LENT block at its foot, and borrows in a BORROWED block at its
// top — a function by a one-line wrapper named after it (tools/lends.js
// checks each is exact), a value never reassigned taken once at load from a
// file before it, and the page's state that is reassigned (the conductor's
// report, the device's pixel ratio, the wheel's plate…) read where it is
// used as VS.name, through the getter its owner lends. The cut moved code
// and changed none: `node art/kolob/tools/samecode.js --split kolob-viz.js
// --ref <the commit before it>` holds every statement of the one closure
// to its place, and `_harness.js <secs> <seed> staff` traces everything the
// page draws (PLAN-REFACTOR §3.5).
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KolobViz = (function () {
  "use strict";
  var K = window.KolobAudio;
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
  function rgba(c, a) { return VS.rgba(c, a); }
  function clamp(x, a, b) { return VS.clamp(x, a, b); }
  function shapeKey(shape, dir) { return VS.shapeKey(shape, dir); }
  function anchorOf(k, dir) { return VS.anchorOf(k, dir); }
  function headSprite(k, open, px, rgb, heavy) { return VS.headSprite(k, open, px, rgb, heavy); }
  function drawGlyph(c, name, x, y, s, rgb) { return VS.drawGlyph(c, name, x, y, s, rgb); }
  var C_INK = VS.C_INK;
  var CLEF_TREBLE = VS.CLEF_TREBLE;
  var CLEF_BASS = VS.CLEF_BASS;
  var HEAVY = VS.HEAVY;
  var GLYPHS = VS.GLYPHS;
  // from kolob-viz-intake.js
  function onNote(n) { return VS.onNote(n); }
  function onEvent(ev) { return VS.onEvent(ev); }
  function flushIntake() { return VS.flushIntake(); }
  function silence(cut) { return VS.silence(cut); }
  var groups = VS.groups;
  var tapes = VS.tapes;
  var bandNotes = VS.bandNotes;
  var visits = VS.visits;
  var marks = VS.marks;
  // from kolob-viz-hymnal.js
  function restQ(st, v, voice, qs) { return VS.restQ(st, v, voice, qs); }
  function organAlone(gr) { return VS.organAlone(gr); }
  function drawnHeads(grp, g) { return VS.drawnHeads(grp, g); }
  var REST_OF = VS.REST_OF;
  // from kolob-viz-wheel.js
  function drawWheel(dt) { return VS.drawWheel(dt); }
  function wheelSeatAt(x, y) { return VS.wheelSeatAt(x, y); }
  function setWheelLabels(display, spoken) { return VS.setWheelLabels(display, spoken); }


  var canvas = null, ctx2d = null;
  var staffLayer = null;                           // static: the staves, brace and clefs (the ink and band layers are below, with the page)
  var wheel = null, xctx = null;                   // the order of service, with the facade inside it
  var W = 0, H = 0, XW = 0, XH = 0, dpr = 1;
  var running = false;

  var cond = { section: null, local: 0, intensity: 0, f0: 65, mode: "ionian", hush: false, fuging: false };
  var playing = false;
  var paused = false;                              // the meeting held: the page stops turning and drying
  var trebPath = null, bassPath = null;            // Path2D, built on first resize (the clefs' outlines: kolob-viz-atlas.js)

  // ==========================================================================
  // THE PAGE — "The Colony Tunebook" (the owner's Direction A, of the three
  // in mockups/). A grand staff engraved the way a tunebook is
  // engraved: four shapes with their stems grown from the shape's own
  // corner, open and filled heads, flags and augmentation dots read from
  // each note's length and broad-nib contrast on the open heads, each head
  // one clean strike (a halo or a pale letterpress edge reads as a blurred
  // second stroke, which the owner ruled out), pre-rendered once per size
  // at device resolution (the sprite atlas). One ink, hymnbook green, from the
  // moment a note sounds; the ink dries as the page turns. Just the notes:
  // no signs or words on the staff. Nothing prints outside the plate: a
  // note beyond the ledger room folds silently by octaves until it fits.
  //
  // q is a diatonic-step lattice: bass rules at q = 0,2,4,6,8, middle C (the
  // meeting's tonic-root) at q = 10, treble rules at q = 12..20. The staves
  // stand a normal grand-staff gap apart (5 sp): a treble note at q10 hangs
  // on its ledger under the treble, a bass note at q10 on its ledger over the
  // bass, and the telegraph punches its holes along the middle of the gap.
  //
  // Everything on the page is kept as data, stamped with the audio time it
  // sounds at, and re-engraved each frame from the page clock (the audio
  // clock, smoothed), so the scroll is exact: x is time, and a page that
  // falls behind catches up whole. Nothing on the page moves but the scroll
  // and the drying.
  // (Each note reports its SATB part, and is staffed by it. A composed
  // hymn is engraved from its Score — barlines,
  // double and final bars, beams, rests, fermatas, ties, closed score with
  // the tune marked: THE HYMNAL ON THE STAFF, kolob-viz-hymnal.js. Words and the running
  // head stay off the page, by the owner's ruling.)
  // ==========================================================================

  // ---- geometry -------------------------------------------------------------------
  // The plate runs from just under the wheel's horizon rule (the staff canvas
  // is drawn 20px up over the wheel band) to just above the console (drawn
  // 12px up into the canvas foot). Nothing is inked outside it.
  var G = null;
  function pageGeom() {
    var top = 20, bot = H - 13;
    var sp = clamp((bot - top) / 19, 6, 11.5);
    var g = { sp: sp, top: top, bot: bot };
    g.T = Math.round(top + (bot - top - 13 * sp) / 2);   // treble top line (q20)
    g.Tb = g.T + 4 * sp;                                  // treble bottom line (q12)
    g.B = g.Tb + 5 * sp;                                  // bass top line (q8): a grand-staff gap, middle C's ledger in it
    g.Bb = g.B + 4 * sp;                                  // bass bottom line (q0)
    g.tapeY = (g.Tb + g.B) / 2;                           // the telegraph's holes, centred in the gap
    g.xBar = Math.round(1.55 * sp + 4);
    g.clefX = g.xBar + 0.7 * sp;
    g.trebH = 6.9 * sp;
    g.trebW = g.trebH * (CLEF_TREBLE.bbox[2] - CLEF_TREBLE.bbox[0]) / (CLEF_TREBLE.bbox[3] - CLEF_TREBLE.bbox[1]);
    g.bassH = 3.3 * sp;
    g.bassW = g.bassH * (CLEF_BASS.bbox[2] - CLEF_BASS.bbox[0]) / (CLEF_BASS.bbox[3] - CLEF_BASS.bbox[1]);
    g.clefEnd = g.clefX + Math.max(g.trebW, g.bassW);
    g.xE = W - Math.round(3.2 * sp);                     // the engraving point
    g.fade0 = g.clefEnd + 0.4 * sp; g.fade1 = g.fade0 + 6 * sp;
    // the ledger room: beyond it a note folds in by octaves, silently
    g.qMaxT = 20 + Math.floor(2 * (g.T - top - 0.62 * sp) / sp);
    g.qMinB = 0 - Math.floor(2 * (bot - g.Bb - 0.62 * sp) / sp);
    g.yT = function (q) { return g.T + (20 - q) * sp / 2; };
    g.yB = function (q) { return g.B + (8 - q) * sp / 2; };
    g.y = function (st, q) { return st === "T" ? g.yT(q) : g.yB(q); };
    g.mid = function (st) { return st === "T" ? g.yT(16) : g.yB(4); };
    return g;
  }

  // ---- the page clock -----------------------------------------------------------
  // One time base. Every engraved item carries the AUDIO time it
  // sounds at, and PT is the audio clock as the page reads it: smoothed, so
  // the scroll is even though the audio clock ticks in chunks. x and the
  // drying are both worked out from PT at draw time, so when
  // the page has to catch up (a hidden tab, a stall, a slow device) all the
  // ink moves at once and the page simply shows the present — nothing
  // replays late. PT holds while the meeting is held, and after STOP it
  // follows the audio clock on (the clock keeps running) so the last ink
  // drains away. DRY is the drying clock: it advances with PT, faster in the
  // sacrament and the postlude.
  var SCROLL_PX_S = 60;                            // the owner's rate
  var PT = 0, DRY = 0, ptSynced = false, lastAudio = -1, audioMoved = false;
  var PT_SNAP = 0.5;                               // further off than this, the page jumps to the present
  var PT_TAU = 0.25;                               // the smoothing's time constant, in seconds
  var PT_LEAD = 0.1;                               // the page never runs further than this ahead of the sound
  function audioNow() { return K && K.getAudioTime ? K.getAudioTime() : 0; }
  function tickClock(dt) {                         // dt: the real time since the last frame, uncapped
    var a = audioNow(), moving = a > lastAudio + 1e-6;
    lastAudio = a; audioMoved = moving;
    if (paused) return;
    var p0 = PT;
    PT += dt;
    if ((playing || moving) && a > 0) {            // follow the audio clock while it runs
      var err = a - PT;
      if (!ptSynced || Math.abs(err) > PT_SNAP) { PT = a; ptSynced = true; }
      else {
        PT += err * (1 - Math.exp(-dt / PT_TAU));
        if (PT > a + PT_LEAD) PT = Math.max(p0, a + PT_LEAD);   // the sound has stalled: wait for it
      }
    }
    if (freeze) PT = held(PT, a);                  // (dev: never past the moment a capture asked for)
    DRY += Math.max(0, PT - p0) * (1 + (cond.section === "sacrament" ? 30 : 0) + (cond.section === "postlude" ? 5 : 0));
  }

  // ---- the frame-exact capture (dev) ---------------------------------------------
  // Two captures of one seed at one second were never the same page: each
  // caught the page between two frames, wherever the page clock stood, a few
  // pixels of scroll apart, and made of whatever the engine had written
  // ahead by then, in the bunches the browser's timer happened to fire its
  // cues in. A capture asks for a second of the meeting — ?kolobFreeze=<secs>
  // on the page's address, or KolobViz.freezeAt(secs) — counted from the
  // meeting's downbeat (the moment its meeting-start event carries), so it
  // falls on the same note in every run of the seed. From the downbeat on,
  // everything the engine writes is taken in by the music's own time it was
  // written at (KOLOB._s.now: the cue's), a moment's calls at a time — each
  // moment its own intake, however the timer bunched them — and what is
  // written after the moment asked waits. The page runs as ever up to that
  // moment and holds there: PT never passes it, and the drying stops with
  // it. Once the sound is FREEZE_LAG past it (everything written by then has
  // come in) the page is painted there and stops painting, and stays as
  // painted for tools/screens.js to capture: the same page in every run of
  // the build. freezeAt(a later second) lets it run on — what waited is taken
  // in first, as it came — and holds again there; freezeAt(null) lets it go.
  // Ask before PLAY: the downbeat is heard from the event, and a moment the
  // page has already passed is painted where it stands. A held page laid out
  // again (a resize: a capture beyond the viewport widens it by the
  // scrollbar) is painted again at its moment, at its new width.
  // probe("freeze") says where the page is held, and the plate's top and
  // foot. A page that asks for neither is not touched: the clock, the loop,
  // the intake and the ink are as they always are.
  // (Exact where the ink dries at its own rate. In the sacrament and the
  // postlude it dries faster, by the section the console last reported — a
  // poll that keeps no frame's time — so a page there can differ by a shade.
  // Only the staff is held: the wheel is painted with the page's last frame
  // as ever, its organ the live sound's spectrum and its arc the console's
  // last report, and the staff's canvas lies over the wheel's foot.)
  var freeze = null;                               // { at: the second of the meeting, frozen, later: [what is written, waiting], due } while a capture is asked
  var downbeat = null, heardDownbeat = false;      // the meeting's downbeat on the audio clock, heard once a capture is asked
  var FREEZE_LAG = 1;                              // seconds of sound past the moment before it is painted
  var replaying = false;                           // (taking in what waited)
  function freezeAt(secs) {
    var was = !!(freeze && freeze.frozen), later = freeze ? freeze.later : [];
    freeze = secs == null || !(+secs >= 0) ? null : { at: +secs, frozen: false, later: [], due: false };
    if (!heardDownbeat && K && K.setEventListener) {
      heardDownbeat = true;
      K.setEventListener(function (ev) { if (ev && ev.type === "meeting-start") downbeat = ev.t; });
    }
    takeIn(later);
    if (was && !running && (canvas || wheel)) { running = true; requestAnimationFrame(frame); }   // (frozen: run on to the next, or go)
  }
  function held(pt, a) {
    if (downbeat == null) return pt;               // (no meeting yet: the page runs as ever)
    var t = downbeat + freeze.at;
    if (a >= t + FREEZE_LAG) freeze.frozen = true;
    return Math.min(pt, t);
  }
  // onNote and onEvent hand everything over here once the downbeat is known;
  // it is taken in when the task that wrote it is done
  function holdsBack(fn, x) {
    if (replaying || downbeat == null) return false;
    var S0 = window.KOLOB && window.KOLOB._s, f = freeze;
    f.later.push({ fn: fn, x: x, w: S0 && S0.now ? S0.now() : audioNow() });
    if (!f.due) {
      f.due = true;
      Promise.resolve().then(function () {
        f.due = false;
        if (freeze !== f) return;
        var later = f.later;
        f.later = [];
        takeIn(later);
      });
    }
    return true;
  }
  // what was written by the moment asked, a moment's calls at a time, each
  // its own intake (as the page would take it had every cue fired in a task
  // of its own); the rest waits again
  function takeIn(later) {
    var t = freeze && downbeat != null ? downbeat + freeze.at : Infinity, i, j, k;
    if (!later.length) return;
    flushIntake();
    for (i = 0; i < later.length; i = j) {
      for (j = i; j < later.length && later[j].w === later[i].w;) j++;
      if (later[i].w > t + 1e-9) { for (k = i; k < j; k++) freeze.later.push(later[k]); continue; }
      replaying = true;
      try { for (k = i; k < j; k++) later[k].fn(later[k].x); } finally { replaying = false; }
      flushIntake();
    }
  }
  // ---- Johnston's tuning marks (THE HYMNAL ON THE STAFF, kolob-viz-hymnal.js) --
  // (off until the owner rules: in the Tabernacle a − now and then, but a
  // gospel hymn rings a 7+ before half its notes, and the 7 reads as a
  // figure. true — or KolobViz.setTuningMarks(true) — prints them.)
  var TUNING_MARKS = false;                        // Johnston's − + 7

  // ---- drawing helpers ------------------------------------------------------------
  function snapRect(c, x, y, w, h) {
    var r = dpr, x0 = Math.round(x * r), y0 = Math.round(y * r);
    var x1 = Math.max(x0 + 1, Math.round((x + w) * r)), y1 = Math.max(y0 + 1, Math.round((y + h) * r));
    c.fillRect(x0 / r, y0 / r, (x1 - x0) / r, (y1 - y0) / r);
  }
  function hLine(c, x0, x1, y, th) { snapRect(c, x0, y - th / 2, x1 - x0, th); }
  function vLine(c, x, y0, y1, th) { snapRect(c, x - th / 2, Math.min(y0, y1), th, Math.abs(y1 - y0)); }
  function drawSprite(c, sp, x, y) {
    c.drawImage(sp.cv, Math.round(x * dpr - sp.o) / dpr, Math.round(y * dpr - sp.o) / dpr, sp.cv.width / dpr, sp.cv.height / dpr);
  }
  function ledgersFor(st, q) {
    var out = [], l;
    if (st === "T") { for (l = 10; l >= q; l -= 2) out.push(l); for (l = 22; l <= q; l += 2) out.push(l); }
    else { for (l = 10; l <= q; l += 2) out.push(l); for (l = -2; l >= q; l -= 2) out.push(l); }
    return out;
  }
  // the ink dries: ~3 %/s of page time, far faster in the sacrament (and
  // an item's own dry, when it has one, faster again: the old tune's). An
  // item is anchored at its onset (tp, or tp0 for the spans: an asking, the
  // empty measure, the band's visit); one first drawn late is credited its age.
  function dryA(it) {
    if (it.d0 == null) it.d0 = DRY - Math.max(0, PT - (it.tp != null ? it.tp : it.tp0));
    return Math.exp(-0.03 * (it.dry || 1) * Math.max(0, DRY - it.d0));
  }
  // a rounded rectangle, also where the canvas has no roundRect (Safari < 16)
  function rrect(c, x, y, w, h, r) {
    if (typeof c.roundRect === "function") { c.roundRect(x, y, w, h, r); return; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  // The telegraph yields to the music: while a message is on the page,
  // every head, ledger, stem, dot and bell ring that lands in the middle of
  // the gap records a clearance here (at its own ink's strength), and no
  // hole is punched where one lies.
  var KO = [], koY0 = 0, koY1 = -1, KO_PAD = 0.3;
  function koHit(y0, y1) { return y1 > koY0 && y0 < koY1; }
  function koRect(c, x0, y0, x1, y1) {
    if (koHit(y0, y1)) KO.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, a: koA != null ? koA : c.globalAlpha });   // (koA: a note struck on the proof sheet, at its own strength)
  }
  function koEllipse(c, x, y, rx, ry) {
    if (koHit(y - ry, y + ry)) KO.push({ e: 1, x: x, y: y, rx: rx, ry: ry, a: koA != null ? koA : c.globalAlpha });
  }
  function koCovers(x0, y0, x1, y1) {              // does any visible note's clearance touch this box?
    for (var i = 0; i < KO.length; i++) {
      var k = KO[i];
      if (k.a < 0.02) continue;
      var kx0 = k.e ? k.x - k.rx : k.x, kx1 = k.e ? k.x + k.rx : k.x + k.w;
      var ky0 = k.e ? k.y - k.ry : k.y, ky1 = k.e ? k.y + k.ry : k.y + k.h;
      if (kx0 < x1 && x0 < kx1 && ky0 < y1 && y0 < ky1) return true;
    }
    return false;
  }

  // How far into the gap a stem from staff st may reach (a y): its own half
  // of the gap (the telegraph's line, less a little air); or, for a hymn's
  // note whose moment the other staff leaves open (room: the other staff's
  // nearest head then, or none), as far as that head allows, short of the
  // other staff's own lines.
  function gapLimit(g, st, room) {
    var sp = g.sp, y;
    if (!room) return st === "T" ? g.tapeY - 0.3 * sp : g.tapeY + 0.3 * sp;
    if (st === "T") {
      y = room.q != null ? Math.min(g.B - 0.45 * sp, g.yB(room.q) - 0.95 * sp) : g.B - 0.45 * sp;
      if (room.div != null) y = Math.min(y, g.B - (room.div + 0.3) * sp);     // (the gap divided with a bass stem: shareGap)
      return y;
    }
    y = room.q != null ? Math.max(g.Tb + 0.45 * sp, g.yT(room.q) + 0.95 * sp) : g.Tb + 0.45 * sp;
    if (room.div != null) y = Math.max(y, g.B - (room.div - 0.3) * sp);
    return y;
  }
  // a group of heads on one stem (a chord, or a single note): where its
  // heads and stem fall. Shared by drawGroup and the column check.
  function layoutGroup(g, X, heads, st, dir, o) {
    var sp = g.sp, sc = o.scale || 1, s = sp * sc, th = o.thin || 1;   // thin: a finer burin (the old tune)
    var sw = Math.max((th < 1 ? 1 : 1.4) / dpr, 0.12 * sp * (sc < 1 ? 0.85 : 1) * th);
    var hs = heads.slice().sort(function (a, b) { return a.q - b.q; });
    var stem = dir !== 0 && !o.noStem;
    // A stem never crosses the middle of the gap, where the other staff's
    // stems and the telegraph's holes lie: one reaching into the gap stops
    // short of it, and one whose head already lies too near it to grow a
    // stem there turns away from the gap instead (a tenor high over the
    // bass staff, an alto deep under the treble). (A composed
    // hymn's note may reach further where the other staff leaves the gap
    // open at that moment — gapLimit, o.room.) Before that, a voice's own
    // stem (o.alt: the position rule's way) that the plate's edge or the gap
    // would cut under 3 sp past its head turns the position rule's way, if
    // that stem grows longer. (Where both staves send a
    // stem into the gap at once, the line has divided it between them —
    // shareGap — at the telegraph's line when both fit, else nearer the
    // voice with room to give, the tune's stem first.)
    var mid = g.mid(st);
    var yHi = g.y(st, hs[hs.length - 1].q), yLo = g.y(st, hs[0].q);
    // (o.keep: a voice of a closed score — the alto under a soprano, the
    // tenor over a bass — keeps its own stem even near the gap: shortened
    // there, down to 1.3 sp past its head, rather than turned into the
    // other voice's. o.tune: the tune's own stem is never turned — a Sacred
    // Harp tenor high over the bass staff keeps its stem up, as short as the
    // gap leaves it, down to 1 sp)
    var minS = o.tune ? 1.0 : o.keep ? 1.3 : 2.2, gapY = gapLimit(g, st, o.room);
    // (each flag past the first lengthens its stem by the
    // flags' own step, so a sixteenth's second flag clears its head as an
    // eighth's one flag does)
    var sL = 3.5 + (o.flags > 1 && !o.beamY ? 0.8 * (o.flags - 1) : 0);
    function stemEnd(d) {                          // where a stem turned d ends
      var ye;
      // (o.ferm: a fermata stands beyond this stem — over the treble, under
      // the bass — and the plate's edge must hold both)
      var edgeT = g.top + (o.ferm > 0 ? 1.65 : 0.3) * sp, edgeB = g.bot - (o.ferm < 0 ? 1.65 : 0.3) * sp;
      if (d > 0) {
        ye = Math.min(yHi - sL * s, mid);
        ye = Math.max(ye, Math.min(edgeT, yHi - 2.2 * s));   // a stem stays on the plate
        if (st === "B") ye = Math.max(ye, Math.min(gapY, yHi - minS * s));   // …and on its side of the gap
      } else {
        ye = Math.max(yLo + sL * s, mid);
        ye = Math.min(ye, Math.max(edgeB, yLo + 2.2 * s));
        if (st === "T") ye = Math.min(ye, Math.max(gapY, yLo + minS * s));
      }
      return ye;
    }
    function reach(d) { return d > 0 ? yHi - stemEnd(1) : stemEnd(-1) - yLo; }   // past the stem's last head
    // (a beamed group's stem is the beam's: its direction and its end are
    // the beam's own, already kept off the gap's middle — beamGeo)
    if (!o.beamY && !o.tune) {
      if (stem && o.alt && o.alt !== dir && reach(dir) < 3 * s && reach(o.alt) > reach(dir)) dir = o.alt;
      if (stem && st === "B" && dir > 0 && yHi - gapY < minS * s) dir = -1;
      else if (stem && st === "T" && dir < 0 && gapY - yLo < minS * s) dir = 1;
    }
    // (a flag is one clean strike, clear of its own head —
    // the owner's rule. A stem turned down hangs its flags back up over its
    // lowest head; where the plate's edge or the gap cuts it too short for
    // them to clear that head — the trio's tune two ledgers under the bass
    // staff — it turns up, and its flags hang beside the head instead)
    if (stem && !o.beamY && !o.tune && o.flags > 0 && dir < 0 && reach(-1) < flagClear(o.flags, s) && reach(1) > reach(-1)) dir = 1;
    // (and the same the other way: a stem up held short under
    // the plate's top edge hangs its flag down beside its head — the organ's
    // high eighths at 390 px — so it turns down where that stem is longer;
    // a voice of a closed score keeps its stem, and its flag is shortened)
    else if (stem && !o.beamY && !o.tune && !o.keep && o.flags > 0 && dir > 0 && reach(1) < flagClear(o.flags, s) && reach(-1) > reach(1)) dir = -1;
    // (and where neither way is long enough — a high note under the plate's
    // top edge, its stem down stopped at the gap — its flags are drawn a
    // little shorter, to clear the head by the same hair: fk)
    var fk = stem && !o.beamY && o.flags > 0 ? clamp((reach(dir < 0 ? -1 : 1) - flagClear(o.flags, s) + 2.8 * s) / (2.8 * s), 0.5, 1) : 1;
    var sx = X + dir * (0.57 * s - sw / 2);
    // (a heavy head — the tune's — is drawn HEAVY times the size: its stem
    // meets its own edge, hs2)
    var placed = hs.map(function (h) {
      var k = shapeKey(h.shape, dir || 1), hx = X, hs2 = h.heavy ? s * HEAVY : s;
      if (stem) { var an = anchorOf(k, dir); hx = sx - an[0] * hs2 + dir * sw / 2; }
      return { h: h, k: k, x: hx, y: g.y(st, h.q), hs: hs2 };
    });
    // a second on one stem: the upper (stem up) / lower (stem down) head crosses to the other side
    for (var i = 1; i < placed.length; i++) {
      if (placed[i].h.q - placed[i - 1].h.q === 1) {
        var d = dir || 1, mv = d > 0 ? placed[i] : placed[i - 1];
        mv.x += d * (0.57 * (placed[i].hs + placed[i - 1].hs) - sw);
      }
    }
    var top = placed[placed.length - 1], bot = placed[0], y0 = null, yEnd = null;
    if (stem) {
      if (dir > 0) { var an0 = anchorOf(bot.k, 1); y0 = bot.y + an0[1] * bot.hs; }
      else { var an1 = anchorOf(top.k, -1); y0 = top.y + an1[1] * top.hs; }
      yEnd = o.beamY ? o.beamY(sx) : stemEnd(dir);
    }
    // augmentation dots sit right of the heads (and of an up-stem)
    var right = -1e9;
    placed.forEach(function (p) { right = Math.max(right, p.x + 0.64 * p.hs); });
    if (dir > 0 && stem) right = Math.max(right, sx + sw / 2);
    var ledgers = [];
    placed.forEach(function (p) {
      if (p.h.ghost) return;                       // (a second voice's head that is the first's: its ledgers are drawn once)
      var ls = ledgersFor(st, p.h.q);
      for (var li = 0; li < ls.length; li++) ledgers.push([p.x - 0.98 * s, g.y(st, ls[li]), p.x + 0.98 * s]);
    });
    // augmentation dots, each in a space (a head on a line has its dot in
    // the space above), clear of the stem; two heads that would share a
    // space step down
    var dots = [], used = {};
    placed.slice().reverse().forEach(function (p) {
      if (!p.h.dots || p.h.ghost) return;
      var dq = p.h.q % 2 === 0 ? p.h.q + 1 : p.h.q;
      while (used[dq]) dq -= 2;
      used[dq] = 1;
      dots.push([right + 0.5 * s, g.y(st, dq)]);
    });
    return { s: s, sw: sw, sx: sx, stem: stem, dir: dir, placed: placed, top: top, bot: bot, y0: y0, yEnd: yEnd, right: right, ledgers: ledgers, dots: dots, st: st, g: g, fk: fk };
  }
  // The ink a laid-out group covers, as boxes — every stroke drawGroup lays
  // for it: its heads (a bell's ring, a breve's strokes), its ledgers, its
  // dots, the signs before and over a head (signsOf: the same geometry the
  // drawing uses), its stem, its flags and a grace's slash. The one measure
  // of a note's ink: it keeps two voices at one x out of
  // each other's way, and it is what a bar stands clear of. [4]: a ledger,
  // [5]: a head, [6]: a sign, [7]: a stem.
  var HEAD_EXT = { mi: [0.66, 0.54], x: [0.5, 0.5] };           // (a head's half-width and half-height, in its own size: the diamond is the widest)
  function headExt(p, o, s) {
    var he = HEAD_EXT[p.k] || [0.64, 0.52], rim = p.h.heavy ? 0.07 * s : 0;   // (the tune's head: its rim struck once more)
    return [o.breve ? 1.1 * s : o.ring ? ((o.ringK || 0.98) + 0.07) * s : he[0] * p.hs + rim, o.ring ? ((o.ringK || 0.98) + 0.07) * s : he[1] * p.hs + rim];   // (a bell's ring is part of its head)
  }
  function groupBoxes(L, o) {
    var s = L.s, out = [], lh = 0.1 * s;
    L.ledgers.forEach(function (l) { out.push([l[0], l[1] - lh, l[2], l[1] + lh, 1]); });
    L.placed.forEach(function (p) {
      if (p.h.ghost) return;
      var e = headExt(p, o, s);
      out.push([p.x - e[0], p.y - e[1], p.x + e[0], p.y + e[1], 0, 1]);
      if (p.h.acc || p.h.jm || p.h.orn) signsOf(p, L).forEach(function (it) { out.push([it.b[0], it.b[1], it.b[2], it.b[3], 0, 0, 1]); });
    });
    var dr = 0.22 * s;                                   // (a dot's ink, 0.19 sp, and its edge)
    L.dots.forEach(function (d) { out.push([d[0] - dr, d[1] - dr, d[0] + dr, d[1] + dr]); });
    if (L.stem) {
      var ya = Math.min(L.y0, L.yEnd), yb = Math.max(L.y0, L.yEnd), dn = L.yEnd < L.y0 ? 1 : -1;
      // (where a stem leaves its head it runs inside that head's box, so
      // its own box starts at the head's edge: the root of a stem is not
      // taken for ink against the other voice's head a third away)
      var ah = dn > 0 ? L.bot : L.top;
      if (!ah.h.ghost) {
        var ah1 = headExt(ah, o, s)[1];
        if (dn > 0) yb = Math.max(ya, Math.min(yb, ah.y - ah1)); else ya = Math.min(yb, Math.max(ya, ah.y + ah1));
      }
      out.push([L.sx - L.sw / 2 - 0.08 * s, ya, L.sx + L.sw / 2 + 0.08 * s, yb, 0, 0, 0, 1]);
      if (o.flags && !o.beamY) {
        var fy = L.yEnd, fl = (0.8 * (o.flags - 1) + 2.8 * L.fk) * s;
        out.push([L.sx, Math.min(fy, fy + dn * fl), L.sx + 1.05 * s, Math.max(fy, fy + dn * fl)]);
      }
    }
    return out;
  }
  function drawGroup(c, g, X, heads, st, dir, o) {
    var sp = g.sp, L = layoutGroup(g, X, heads, st, dir, o);
    dir = L.dir;                                          // (turned away from the gap, if it had to be)
    var s = L.s, sw = L.sw, sx = L.sx, placed = L.placed, top = L.top, bot = L.bot, yEnd = L.yEnd;
    var pad = KO_PAD * sp;
    c.fillStyle = rgba(o.rgb);
    var th = o.thin || 1, lth = Math.max((th < 1 ? 0.9 : 1.2) / dpr, 0.16 * sp * th);
    L.ledgers.forEach(function (l) {
      hLine(c, l[0], l[2], l[1], lth);
      koRect(c, l[0] - pad, l[1] - lth / 2 - pad, l[2] + pad, l[1] + lth / 2 + pad);
    });
    if (L.stem) {
      vLine(c, sx, L.y0, yEnd, sw);
      koRect(c, sx - sw / 2 - pad, Math.min(L.y0, yEnd), sx + sw / 2 + pad, Math.max(L.y0, yEnd));
      if (!o.beamY) for (var f = 0; f < (o.flags || 0); f++) drawFlag(c, sx, yEnd + dir * f * 0.8 * s, dir, s, sw, L.fk);   // (a beamed note's flags are its beams)
    }
    placed.forEach(function (p) {
      if (p.h.ghost) return;
      drawSprite(c, headSprite(p.k, p.h.open, s, o.rgb, p.h.heavy), p.x, p.y);
      koEllipse(c, p.x, p.y, 0.68 * p.hs + pad, 0.55 * p.hs + pad);
      if (p.h.acc || p.h.jm || p.h.orn) headMarks(c, g, p, st, s, sw, o, L);
    });
    if (o.breve) {                                        // the breve's side strokes
      placed.forEach(function (p) {
        [-1, 1].forEach(function (sd) {
          vLine(c, p.x + sd * 0.82 * s, p.y - 0.55 * s, p.y + 0.55 * s, sw);
          vLine(c, p.x + sd * 1.02 * s, p.y - 0.55 * s, p.y + 0.55 * s, sw);
        });
      });
    }
    // augmentation dots, each in a space, clear of the stem (layoutGroup)
    L.dots.forEach(function (d) {
      c.beginPath(); c.arc(d[0], d[1], 0.19 * s, 0, Math.PI * 2); c.fill();
      koEllipse(c, d[0], d[1], 0.19 * s + pad, 0.19 * s + pad);
    });
    return { sx: sx, yEnd: yEnd, topY: top.y, botY: bot.y, topX: top.x, botX: bot.x, sw: sw, L: L };
  }
  // how far past its lowest head a stem turned down must
  // reach for n flags to clear that head: the flags' own run back up the
  // stem (2.8 for the first, 0.8 for each after it — drawGroup), the head's
  // half-height, and a hair of air — so the flag and the head are two marks,
  // each struck once, and never one over the other
  function flagClear(n, s) { return (0.8 * (n - 1) + 3.4) * s; }
  function drawFlag(c, sx, y, dir, s, sw, fk) {       // (fk: its length, where a stem too short for it must keep it off its head)
    c.save(); c.translate(sx - sw / 2, y); c.scale(s, (dir > 0 ? s : -s) * (fk || 1));
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0.13, 0);
    c.bezierCurveTo(0.2, 0.55, 0.58, 0.82, 0.82, 1.22);
    c.bezierCurveTo(1.04, 1.6, 1.02, 2.2, 0.8, 2.72);
    c.lineTo(0.73, 2.68);
    c.bezierCurveTo(0.88, 2.22, 0.82, 1.82, 0.6, 1.56);
    c.bezierCurveTo(0.42, 1.34, 0.2, 1.22, 0, 1.12);
    c.closePath(); c.fill(); c.restore();
  }
  // ---- the hymn's signs ------------------------------------------------------
  // A head's signs, where they are drawn: before it its accidental and (the
  // owner's call) its tuning marks; the Old Way's ornament where the
  // composer placed one. Each is { k: its kind, b: its ink's box, … }; the
  // one place their geometry lives, so what headMarks draws is what
  // groupBoxes measures.
  function signsOf(p, L) {
    var g = L.g, st = L.st, s = L.s, x = p.x - 0.64 * (p.hs || s), y = p.y, h = p.h, out = [], bx;
    function glyph(nm, gx, gy, gs) { var b = GLYPHS[nm].box; out.push({ k: "glyph", nm: nm, x: gx, y: gy, s: gs, b: [gx + b[0] * gs, gy + b[1] * gs, gx + b[2] * gs, gy + b[3] * gs] }); }
    if (h.acc) {
      x -= 0.3 * s;
      var nm = h.acc === "s" ? "sharp" : h.acc === "f" ? "flat" : "natural";
      bx = GLYPHS[nm].box;
      glyph(nm, x - bx[2] * s, y, s);
      x -= (bx[2] - bx[0]) * s;
    }
    if (TUNING_MARKS && h.jm) {                     // Johnston: the comma's sign next to the head, the 7 before it; small
      var ts = 0.78 * s;
      var my = h.q % 2 !== 0 ? y : y - 0.5 * s;     // (in a space, never on a line, where a dash would vanish)
      if (h.jm.c) {
        x -= 0.22 * s;
        var mw = 0.56 * ts, th = Math.max(0.9 / dpr, 0.13 * ts);
        out.push({ k: "comma", x: x, y: my, mw: mw, th: th, plus: h.jm.c > 0, b: [x - mw, h.jm.c > 0 ? my - mw / 2 : my - th / 2, x, h.jm.c > 0 ? my + mw / 2 : my + th / 2] });
        x -= mw;
      }
      if (h.jm.s7) { x -= 0.18 * s; glyph("j7", x - 0.36 * ts, my, ts); x -= 0.72 * ts; }
    }
    if (h.orn === "turn") {                         // above the note (and above its stem, over the staff)
      var top = st === "T" ? g.T : g.B, yt = Math.min(y - 1.5 * s, top - 0.9 * g.sp);
      if (L.stem && L.dir > 0) yt = Math.min(yt, L.yEnd - 0.8 * s);
      yt = Math.max(yt, g.top + 0.7 * g.sp);
      glyph("turn", p.x, yt, s);
    } else if (h.orn === "slide") {                 // a slide up into the note
      var lw = Math.max(1 / dpr, 0.13 * s);
      out.push({ k: "slide", x: p.x, y: y, lw: lw, b: [p.x - 1.75 * s - lw, y + 0.12 * s - lw, p.x - 0.86 * s + lw, y + 0.95 * s + lw] });
    } else if (h.orn === "grace") {                 // a grace note, a step above, slashed
      var gs = 0.6 * s, gx = p.x - 1.7 * s, gy = g.y(st, h.q + 1), gsw = Math.max(1 / dpr, 0.1 * s), gsx = gx + 0.57 * gs;
      out.push({ k: "grace", gs: gs, gx: gx, gy: gy, gsw: gsw, gsx: gsx, shape: h.graceShape || "sol",
                 b: [gx - 0.68 * gs, gy - 3.05 * gs, gsx + 1.0 * gs, gy + 0.56 * gs] });
    }
    return out;
  }
  function headMarks(c, g, p, st, s, sw, o, L) {
    signsOf(p, L).forEach(function (it) {
      if (it.k === "glyph") drawGlyph(c, it.nm, it.x, it.y, it.s, o.rgb);
      else if (it.k === "comma") {
        snapRect(c, it.x - it.mw, it.y - it.th / 2, it.mw, it.th);
        if (it.plus) snapRect(c, it.x - it.mw / 2 - it.th / 2, it.y - it.mw / 2, it.th, it.mw);
      } else if (it.k === "slide") {
        c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = it.lw; c.lineCap = "round";
        c.beginPath(); c.moveTo(it.x - 1.75 * s, it.y + 0.95 * s); c.quadraticCurveTo(it.x - 1.25 * s, it.y + 0.75 * s, it.x - 0.86 * s, it.y + 0.12 * s); c.stroke();
        c.restore();
      } else if (it.k === "grace") {
        var gs = it.gs, gsx = it.gsx, gy = it.gy, gsw = it.gsw;
        drawSprite(c, headSprite(shapeKey(it.shape, 1), false, gs, o.rgb), it.gx, gy);
        vLine(c, gsx, gy - 0.1 * gs, gy - 3.0 * gs, gsw);
        drawFlag(c, gsx, gy - 3.0 * gs, 1, gs, gsw);
        c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = gsw; c.lineCap = "round";
        c.beginPath(); c.moveTo(gsx - 0.7 * gs, gy - 1.1 * gs); c.lineTo(gsx + 0.8 * gs, gy - 2.4 * gs); c.stroke(); c.restore();
      }
    });
  }
  // A beam, laid once per staff size: the stems of its notes turned one way
  // (the voice's own, the pair's shared, or away from the head furthest from
  // the middle line), its slope the melody's, gently (at most 0.9 sp over
  // the group), every stem at least 2.9 sp past its far head, and the whole
  // kept off the gap's middle and on the plate. Where that would leave a
  // stem stubby, a beam free to turn turns. y is the beam's outer edge.
  function beamGeo(bm, g) {
    if (bm.geo && bm.geo.sp === g.sp) return bm.geo;
    var ms = bm.members;
    if (ms.length < 2) return null;
    var sp = g.sp, s = sp, st = bm.st, sw = Math.max(1.4 / dpr, 0.12 * sp);
    var nb = 1;
    ms.forEach(function (m) { nb = Math.max(nb, m.flags || 1); });
    function build(dir) {
      var pts = ms.map(function (m) {
        var hi = 1e9, lo = -1e9;
        drawnHeads(m, g).forEach(function (hd) { var y = g.y(st, hd.q); hi = Math.min(hi, y); lo = Math.max(lo, y); });
        var x = (m.tp - ms[0].tp) * SCROLL_PX_S + (m.col && m.col.sp === sp ? m.col.dx : 0) + dir * (0.57 * s - sw / 2);
        var far = dir > 0 ? hi : lo, near = dir > 0 ? lo : hi;
        return { x: x, far: far, near: near, ideal: far - dir * 3.5 * s, need: far - dir * (2.9 + 0.75 * (nb - 1)) * s };
      });
      var a = pts[0], b = pts[pts.length - 1];
      var m = clamp(b.ideal - a.ideal, -0.9 * s, 0.9 * s) / ((b.x - a.x) || 1), y0 = a.ideal;
      // (a guest's beam lies level. Its notes may be set
      // well after their time — the organist's figure pushed on by the chords
      // under it — and a slope laid where they were expected, followed out to
      // where they stand, ran the beam off the plate and left its stems bare
      // to the edge; level, it meets every stem wherever the note is set)
      if (ms[0].cap != null) m = 0;
      pts.forEach(function (p) {
        var by = y0 + m * (p.x - a.x);
        if (dir > 0 ? by > p.need : by < p.need) y0 += p.need - by;
      });
      // the gap's middle, and the plate's edges
      var yMin = 1e9, yMax = -1e9;
      pts.forEach(function (p) { var by = y0 + m * (p.x - a.x); yMin = Math.min(yMin, by); yMax = Math.max(yMax, by); });
      var lim = dir > 0 ? g.top + 0.3 * sp : g.bot - 0.3 * sp;
      ms.forEach(function (m) {                    // (the gap: the most any of its notes may have)
        if (dir > 0 && st === "B") lim = Math.max(lim, gapLimit(g, st, m.room));
        if (dir < 0 && st === "T") lim = Math.min(lim, gapLimit(g, st, m.room));
      });
      if (dir > 0 && yMin < lim) y0 += lim - yMin;
      if (dir < 0 && yMax > lim) y0 -= yMax - lim;
      var short = 1e9;
      pts.forEach(function (p) { var by = y0 + m * (p.x - a.x); short = Math.min(short, dir * (p.far - by)); });
      return { dir: dir, y0: y0, m: m, x0: a.x, short: short, sp: sp };
    }
    var d0 = bm.fixed;
    if (!d0) {                                     // the position rule, over the whole group
      var mq = st === "T" ? 16 : 4, far = null;
      ms.forEach(function (m) { drawnHeads(m, g).forEach(function (hd) { if (far == null || Math.abs(hd.q - mq) > Math.abs(far - mq)) far = hd.q; }); });
      d0 = far >= mq ? -1 : 1;
    }
    var geo = build(d0);
    if (!bm.fixed && geo.short < 2.4 * s) { var alt = build(-d0); if (alt.short > geo.short) geo = alt; }
    bm.geo = geo;
    return geo;
  }
  function beamYAt(bm, geo) {
    var x0 = X(bm.members[0].tp) + geo.x0;
    return function (x) { return geo.y0 + geo.m * (x - x0); };
  }
  // the beam itself: from its first stem to its last, or, while its notes
  // are still coming, as far as the engraving point — the burin's stroke
  var FRAME = 0;
  function drawBeam(c, g, bm) {
    var geo = bm.geo, ms = bm.members;
    if (!geo || ms.length < 2) return;
    var sp = g.sp, s = sp, sw = Math.max(1.4 / dpr, 0.12 * sp), yAt = beamYAt(bm, geo), dir = geo.dir;
    var xs = [], a = 0;
    ms.forEach(function (m) {
      var drawn = m.drawnAt === FRAME;
      if (drawn) a = Math.max(a, m.lastA || 0);
      xs.push(drawn ? m.lastSx : m.tp > PT ? null : undefined);        // null: not yet reached; undefined: dried or gone
    });
    var i0 = -1, i1 = -1;
    for (var i = 0; i < xs.length; i++) if (typeof xs[i] === "number") { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 < 0 || a < 0.02) return;
    var xa = xs[i0] - sw / 2, xb = xs[i1] + sw / 2;
    if (i1 < ms.length - 1 && xs[i1 + 1] === null) xb = Math.max(xb, Math.min(X(ms[i1 + 1].tp) + dir * (0.57 * s - sw / 2), g.xE));   // (as far as the burin, and no further)
    var th = 0.5 * s * dir;                        // (inward, toward the heads)
    // (struck at full strength with its notes on the proof
    // sheet, and laid on the page with them once, at their one alpha —
    // impress; the ink it covers is returned for the patch)
    c.fillStyle = rgba(C_INK);
    var bb = [xa, 1e9, xb, -1e9];
    function band(x1, x2, off) {
      if (x2 <= x1) return;
      bb[0] = Math.min(bb[0], x1); bb[2] = Math.max(bb[2], x2);
      bb[1] = Math.min(bb[1], yAt(x1) + Math.min(off, off + th), yAt(x2) + Math.min(off, off + th));
      bb[3] = Math.max(bb[3], yAt(x1) + Math.max(off, off + th), yAt(x2) + Math.max(off, off + th));
      c.beginPath();
      c.moveTo(x1, yAt(x1) + off); c.lineTo(x2, yAt(x2) + off); c.lineTo(x2, yAt(x2) + off + th); c.lineTo(x1, yAt(x1) + off + th);
      c.closePath(); c.fill();
      var e1 = Math.min(off, off + th), e2 = Math.max(off, off + th);   // (the telegraph keeps clear of it)
      koRect(c, x1, Math.min(yAt(x1), yAt(x2)) + e1 - KO_PAD * sp, x2, Math.max(yAt(x1), yAt(x2)) + e2 + KO_PAD * sp);
    }
    band(xa, xb, 0);
    // a sixteenth's second beam: between two sixteenths, or a stub toward its neighbour
    var off2 = 0.75 * s * dir;
    for (i = i0; i <= i1; i++) {
      if ((ms[i].flags || 1) < 2) continue;
      var nx = i < i1 && (ms[i + 1].flags || 1) >= 2, pv = i > i0 && (ms[i - 1].flags || 1) >= 2;
      if (nx) band(xs[i] - sw / 2, xs[i + 1] + sw / 2, off2);
      else if (!pv) {
        if (i < i1) band(xs[i] - sw / 2, xs[i] + 1.0 * s, off2);
        else band(xs[i] - 1.0 * s, xs[i] + sw / 2, off2);
      }
    }
    return bb[3] > bb[1] ? bb : null;
  }
  // the hymn's marks, each reached like a note and drying like one
  function drawMarks(c) {
    var g = G, sp = g.sp, keep = 0;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i], x = X(m.tp), xl = m.tp2 != null ? X(m.tp2) : x;
      if (Math.max(x, xl) < -6 * sp) continue;       // gone past the clefs
      marks[keep++] = m;
      if (m.tp > PT || x > g.xE + 3 * sp) continue;
      var a = dryA(m);
      if (a < 0.02) continue;
      c.globalAlpha = a;
      c.fillStyle = rgba(C_INK);
      // (a bar or a rest set a little after its time waits,
      // like a note, until the burin reaches it: nothing prints ahead of it)
      if (m.kind === "bar") { if (x + barPlace(m, g) > g.xE + BURIN_EPS * sp) continue; drawHymnBar(c, g, m, x); }
      else if (m.kind === "rest") { if (x + restPlace(m, g).rx > g.xE + BURIN_EPS * sp) continue; drawRest(c, g, m, x); }
      else if (m.kind === "ferm") drawFermata(c, g, m, x);
      else drawTieOrSlur(c, g, m);
    }
    marks.length = keep;
    c.globalAlpha = 1;
  }
  // A single bar, the double bar at a line's end, the final bar at the
  // hymn's. At 60 px/s a quick note before a downbeat leaves little room,
  // so a bar is set the engraver's way: it stands clear of the ink either
  // side of it — the notes and rests before it (their heads and dots, their
  // stems, an unbeamed note's flag: a stem-up eighth's reaches 1.6 sp past
  // its head) and the notes on its downbeat (an accidental, a head, a stem
  // down, which keeps a little more air so that it never reads as a second
  // bar). Where there is not that much room, the downbeat's notes on both
  // staves make it, together, when they are first set (placeColumn → barPush)
  // — the page's time bends by a staff space or so at the bar, as a
  // hymnal's spacing does. Only the ink between the staff's own lines is
  // weighed: the bar stands there alone.
  var BAR_AIR = 0.35, BAR_AIR_STEM = 0.5;          // in sp: from the ink before a bar; after it, to a head or a stem
  function barInk(m, g) {                          // the bar's own ink, left and right of its x (xb)
    var thin = Math.max(1.2 / dpr, 0.16 * g.sp);
    return { th: thin, wl: m.type === "double" ? 0.5 * g.sp + thin / 2 : m.type === "final" ? 0.8 * g.sp + thin / 2 : thin / 2,
             wr: m.type === "final" ? 0 : thin / 2 };
  }
  // (the staff and a space either side of it: a stem that ends just over the
  // staff, or a head on the ledger by it, would read as one stroke with a bar)
  function inBand(g, st, b) { var top = st === "T" ? g.T : g.B, sp = g.sp; return b[3] > top - sp && b[1] < top + 5 * sp; }
  // a rest's place about its own time's x: after its bar, if one stands at it
  function restPlace(r, g) {
    var sp = g.sp, nm = REST_OF[r.full ? 1 : r.v] || REST_OF[0.25], bx = GLYPHS[nm[0]].box;
    var rx = (r.full ? 1.4 : 0.5) * sp;
    if (r.barIn && r.barIn.relSp === sp) rx = Math.max(rx, r.barIn.rel + BAR_AIR * sp - bx[0] * sp);
    return { rx: rx, nm: nm, x0: rx + bx[0] * sp, x1: rx + Math.max(bx[2] * sp, nm[1] ? 1.13 * sp : 0), y0: bx[1] * sp, y1: bx[3] * sp };
  }
  // What a bar must clear, about its own time's x: pr, the rightmost ink
  // before it; nl, the leftmost after it, less its air (ar: the air the
  // nearest ink after it asks). All of it read from the one measure of a
  // note's ink — groupBoxes on inkLayout's layout, ledgers and all, where
  // the note is set (inkOf) — whether the bar is asking for room (pushing:
  // its downbeat's notes as laid out before they make it) or being placed
  // (as they stand). Before it: its line's notes and rests of the two
  // seconds before it, and a guest's notes on its staves (the clarinet over
  // a psalm tune: not the hymn's to move, so the bar keeps clear of them;
  // a guest's note after a bar keeps clear of the bar instead, placeColumn).
  function barExtents(m, g, pushing) {
    var sp = g.sp, pr = -1e9, nl = 1e9, ar = BAR_AIR * sp;
    function after(x, air) { if (x - air < nl) { nl = x - air; ar = air; } }
    function before(gr) {
      var ik = inkOf(gr, g), off = (gr.tp - m.tp) * SCROLL_PX_S + ik.dx;
      ik.boxes.forEach(function (b) { if (inBand(g, gr.st, b)) pr = Math.max(pr, b[2] + off); });
    }
    (m.pv || []).forEach(function (gr) { if (m.sts.indexOf(gr.st) >= 0 && gr.lastA >= 0.02) before(gr); });
    (m.pvRests || []).forEach(function (r) {
      if (m.sts.indexOf(r.st) < 0 || dryA(r) < 0.02) return;
      var rp = restPlace(r, g), ry = g.y(r.st, r.q != null ? r.q : restQ(r.st, r.full ? 1 : r.v, r.voice, null));
      if (inBand(g, r.st, [0, ry + rp.y0, 0, ry + rp.y1])) pr = Math.max(pr, (r.tp - m.tp) * SCROLL_PX_S + rp.x1);
    });
    for (var i = 0; i < groups.length; i++) {
      var gr = groups[i];
      if (gr.hymn || gr.tp >= m.tp || gr.tp < m.tp - 2 || m.sts.indexOf(gr.st) < 0 || !(gr.col && gr.col.sp === sp) || !(gr.lastA >= 0.02) || (gr.alone && !gr.aloneOk)) continue;
      if (m.nx && m.nx.indexOf(gr) >= 0) continue;   // (a downbeat's note a hair early is after its bar, not before it)
      before(gr);
    }
    (m.nx || []).forEach(function (gr) {
      var bx, off;
      if (pushing) { var pg = prepGroup(gr, g); bx = groupBoxes(inkLayout(gr, g, pg.heads, pg.o), pg.o); off = (gr.tp - m.tp) * SCROLL_PX_S; }
      else {
        if (!(gr.lastA >= 0.02) || !(gr.noCol || (gr.col && gr.col.sp === sp))) return;   // (not set yet: it will clear the bar where it stands, barPush)
        var ik = inkOf(gr, g); bx = ik.boxes; off = (gr.tp - m.tp) * SCROLL_PX_S + ik.dx;
      }
      bx.forEach(function (b) { if (inBand(g, gr.st, b)) after(b[0] + off, (b[7] ? BAR_AIR_STEM : BAR_AIR) * sp); });
    });
    return { pr: pr, nl: nl, ar: ar };
  }
  // The room the downbeat's notes make for their bar (0 if there is room
  // already): worked out once per staff size, the same for every note on
  // that downbeat, so a chord across the staves stays upright; the notes
  // take it as far as HYMN_DX_MAX allows (placeColumn).
  function barPush(m, g) {
    if (m.push && m.push.sp === g.sp) return m.push;
    var p = m.push = { sp: g.sp, dx: 0 };          // (set first: a bar is never asked twice while it is being worked out)
    var e = barExtents(m, g, true), bi = barInk(m, g), aL = BAR_AIR * g.sp;
    if (e.nl < 1e8) {
      // (a bar already placed — a double bar whose next line's first notes
      // come after it — stays where it stands: its notes clear it there)
      if (m.at && m.at.sp === g.sp) p.dx = Math.max(0, m.at.rel + bi.wr - e.nl);
      else if (e.pr > -1e8) p.dx = Math.max(0, e.pr + aL + bi.wl + bi.wr - e.nl);
    }
    return p;
  }
  // A bar is placed once (setDue: when it is due, after the notes either
  // side of it that are due with it have been set), about its own time's
  // x, and then never moves: ink before it drying away, or a guest's note
  // coming after it, leaves it where it was printed. (Nothing on the page
  // moves but the scroll and the drying.) Where the inks either side leave
  // it less than its air, it keeps the same share of its air on each side.
  function barPlace(m, g) {
    var sp = g.sp, bi = barInk(m, g);
    if (!(m.at && m.at.sp === sp)) {
      var e = barExtents(m, g, false), aL = BAR_AIR * sp, rel = (m.off || 0) * sp;
      var lo = e.pr + aL + bi.wl, hi = e.nl - bi.wr;
      if (e.nl < 1e8 && rel > hi) rel = hi;
      if (e.pr > -1e8 && rel < lo) rel = e.nl < 1e8 && hi < lo ? lo + (hi - lo) * aL / (aL + e.ar) : lo;
      m.at = { sp: sp, rel: rel };
    }
    m.rel = m.at.rel + bi.wr; m.relSp = sp;          // (a rest on its downbeat stands after it: restPlace)
    return m.at.rel;
  }
  function drawHymnBar(c, g, m, x) {
    var sp = g.sp, bi = barInk(m, g), thin = bi.th, xb = x + barPlace(m, g);
    m.sts.forEach(function (st) {
      var top = st === "T" ? g.T : g.B, bot = top + 4 * sp;
      if (m.type === "double") { vLine(c, xb - 0.5 * sp, top, bot, thin); vLine(c, xb, top, bot, thin); }
      else if (m.type === "final") { vLine(c, xb - 0.8 * sp, top, bot, thin); snapRect(c, xb - 0.5 * sp, top, 0.5 * sp, 4 * sp); }
      else vLine(c, xb, top, bot, thin);
    });
  }
  // a rest: the whole hanging from the fourth line, the half on the middle
  // line, the rest on the middle; a voice's own raised or lowered a space
  // when the two share the staff. A whole or half rest set off the staff
  // hangs from (or sits on) a ledger line of its own, as a hymnal prints it.
  function drawRest(c, g, m, x) {
    var sp = g.sp, rp = restPlace(m, g), r = rp.nm;
    var q = m.q != null ? m.q : restQ(m.st, m.full ? 1 : m.v, m.voice, null);
    var rx = x + rp.rx, ry = g.y(m.st, q), pad = KO_PAD * sp;
    if (r[0] === "rest1" || r[0] === "rest2") {
      var lth = Math.max(1.2 / dpr, 0.16 * sp);
      ledgersFor(m.st, q).forEach(function (l) {
        var ly = g.y(m.st, l);
        hLine(c, rx - 0.95 * sp, rx + 0.95 * sp, ly, lth);
        koRect(c, rx - 0.95 * sp - pad, ly - lth / 2 - pad, rx + 0.95 * sp + pad, ly + lth / 2 + pad);
      });
    }
    drawGlyph(c, r[0], rx, ry, sp, C_INK);
    koRect(c, x + rp.x0 - pad, ry + rp.y0 - pad, x + rp.x1 + pad, ry + rp.y1 + pad);
    if (r[1]) { var dq = q % 2 === 0 ? q + 1 : q; c.beginPath(); c.arc(rx + 0.95 * sp, g.y(m.st, dq), 0.18 * sp, 0, Math.PI * 2); c.fill(); }
  }
  // a fermata over the treble's topmost ink at its beat (under the bass's lowest)
  function drawFermata(c, g, m, x) {
    var sp = g.sp, hx = null, yInk = m.up ? 1e9 : -1e9;
    m.grps.forEach(function (gr) {
      var L = gr.drawnAt === FRAME ? gr.lastL : null;
      if (!L) return;
      L.placed.forEach(function (p) {
        yInk = m.up ? Math.min(yInk, p.y - 0.6 * sp) : Math.max(yInk, p.y + 0.6 * sp);
        if (hx == null || (m.up ? p.y <= L.top.y : p.y >= L.bot.y)) hx = p.x;
      });
      if (L.stem && (L.dir > 0) === m.up) yInk = m.up ? Math.min(yInk, L.yEnd) : Math.max(yInk, L.yEnd);
    });
    if (hx == null) return;                        // (its notes have dried from the page)
    var top = m.st === "T" ? g.T : g.B, bot = top + 4 * sp;
    if (m.up) drawGlyph(c, "fermU", hx, clamp(Math.min(yInk - 0.45 * sp, top - 0.7 * sp), g.top + 1.2 * sp, 1e9), sp, C_INK);
    else drawGlyph(c, "fermD", hx, clamp(Math.max(yInk + 0.45 * sp, bot + 0.7 * sp), -1e9, g.bot - 1.2 * sp), sp, C_INK);
  }
  // a tie, or the slur over a melisma: a crescent from head to head, drawn
  // as far as the engraving point has reached (and no further: the burin)
  function drawTieOrSlur(c, g, m) {
    var sh = tieShape(g, m);
    if (!sh) return;
    var x1 = sh.x1, x2 = sh.x2, y1 = sh.y1, y2 = sh.y2, h = sh.h, th = sh.th, dx = x2 - x1;
    c.save();
    c.beginPath(); c.rect(0, 0, g.xE, H); c.clip();
    c.beginPath();
    c.moveTo(x1, y1);
    c.bezierCurveTo(x1 + dx * 0.25, y1 + h, x2 - dx * 0.25, y2 + h, x2, y2);
    c.bezierCurveTo(x2 - dx * 0.25, y2 + h - th, x1 + dx * 0.25, y1 + h - th, x1, y1);
    c.closePath(); c.fill();
    c.restore();
  }
  // (the crescent drawTieOrSlur lays, or null while it is not yet to be
  // drawn: its geometry in one place, so the silent checks measure what is
  // drawn — probe("ink"))
  // SETTLED ONCE. A slur or a tie is laid out once, whole,
  // when the last of its notes is set — its side, its ends, its depth — and
  // never again: from then on it only travels with the page. Laid out stroke
  // by stroke before, it read its side from a note not yet set (a slur drawn
  // over a run jumped under it when the run's last note printed), and its
  // tail followed its last note to wherever that note was set. Now nothing
  // of it is drawn until both its notes stand where they will stay; the
  // burin then cuts it as far as it has reached. Its side: on a staff two
  // voices share, the upper voice's above and the lower's below (a tie of
  // the soprano no longer dips into the alto); alone on its staff, away from
  // its notes' stems, or above where they point both ways. An end whose
  // stem stands on the curve's side begins past that stem, or ends before it.
  function tieShape(g, m) {
    var sp = g.sp;
    if (!(m.set && m.set.sp === sp)) {
      if (!setNow(m.g1, g) || !setNow(m.g2, g) || !prints(m.g1) || !prints(m.g2)) return null;
      m.set = settleCurve(g, m);
    }
    var z = m.set, x0 = X(m.tp);
    if (!z.ok) return null;
    return { x1: x0 + z.x1, y1: z.y1, x2: x0 + z.x2, y2: z.y2, side: z.side, h: z.h, th: z.th };
  }
  function setNow(gr, g) { return gr.noCol ? gr.dueSp === g.sp : !!(gr.col && gr.col.sp === g.sp); }
  function prints(gr) { return gr.lastA >= 0.02 && !(gr.alone && gr.aloneOk === false); }
  // (a set note as it is struck, while a curve is settled: its layout about
  // x 0, and its x — the curve's first note's place on the page, and from
  // there the whole device pixels the music between them makes. X rounds
  // each note to the device pixel at the frame it is read in, so two notes'
  // distance came out a pixel either way by the frame a curve happened to
  // settle in, and two runs of a seed could settle one a pixel apart; read
  // from the curve's own note, it is the distance a frame whose first note
  // stands on a whole pixel gives, in every run)
  var settling = null;                             // (the curve's first note: its time and its x, while settleCurve runs)
  function struck(gr, g) {
    var pg = prepGroup(gr, g);
    var x = settling.x + Math.round((gr.tp - settling.tp) * SCROLL_PX_S * dpr) / dpr;
    return { L: inkLayout(gr, g, pg.heads, pg.o), o: pg.o, x: x + (gr.noCol ? coDx(gr, g) : gr.col.dx) };
  }
  // (the curve's one layout: its ends and side about its first note's own
  // time's x, its depth; ok false where it is too short to draw)
  function settleCurve(g, m) {
    settling = { tp: m.tp, x: X(m.tp) };
    try { return settleAbout(g, m); } finally { settling = null; }
  }
  function settleAbout(g, m) {
    var s = g.sp, tie = m.kind === "tie", A = struck(m.g1, g), B = struck(m.g2, g);
    function fq(gr) { var f = gr.fold && gr.fold.sp === s ? gr.fold : null; return f && f.oct ? (m.st === "T" ? -7 : 7) * f.oct : 0; }
    var side = m.vside || 0;                       // (+1: below the heads; the voice's own side, where two share the staff)
    if (!side) {
      if (tie) side = A.L.dir > 0 ? 1 : -1;
      else {
        var up = A.L.dir > 0 && B.L.dir > 0;       // (a slur under stems that all point up; else over)
        (m.line || []).forEach(function (gr) { if (gr !== m.g1 && gr !== m.g2 && setNow(gr, g) && prints(gr) && struck(gr, g).L.dir <= 0) up = false; });
        side = up ? 1 : -1;
      }
    }
    var sw = A.L.sw, over = side < 0, dy0 = tie ? 0.55 : 0.9, gx = (tie ? 0.6 : 0.1) * s, x1 = A.x + gx, x2 = B.x - gx, d1 = dy0, d2 = dy0;
    // (a stem up on the curve's side stands right of its head: the curve
    // begins past it; a stem down on its side stands left: it ends before it.
    // Where that would leave too short a curve — two quick notes a space
    // apart — it is struck from the heads as ever, across the stem's root)
    var sA = A.L.stem && over && A.L.dir > 0, sB = B.L.stem && !over && B.L.dir < 0;
    var xs1 = sA ? A.x + A.L.sx + sw / 2 + 0.25 * s : x1, xs2 = sB ? B.x + B.L.sx - sw / 2 - 0.25 * s : x2;
    if ((sA || sB) && xs2 - xs1 >= 1.5 * s) {
      if (sA) { x1 = xs1; d1 = tie ? 0.55 : 0.6; }
      if (sB) { x2 = xs2; d2 = tie ? 0.55 : 0.6; }
    }
    var y1 = g.y(m.st, m.q1 + fq(m.g1)) + side * d1 * s, y2 = g.y(m.st, m.q2 + fq(m.g2)) + side * d2 * s;
    if (x2 - x1 < 0.6 * s) return { sp: s, ok: false };
    var sh = { x1: x1, y1: y1, x2: x2, y2: y2, side: side,
               h: side * clamp(0.12 * (x2 - x1), 0.4 * s, 1.3 * s), th: side * Math.max(0.9 / dpr, 0.14 * s) };
    if (!tie) {
      // (fitted to its own line; and where that leaves it across another
      // head set in its span — a far choir's pale note, set late, just
      // there — fitted to that head too, if within its bounds that clears
      // every head; else it keeps its own line's fit)
      var pre = { x1: sh.x1, y1: sh.y1, x2: sh.x2, y2: sh.y2, side: sh.side, h: sh.h, th: sh.th };
      slurFit(g, m, sh);
      var near = groups.filter(function (gr) { return gr.st === m.st && gr.tp > m.tp - 3 && gr.tp < m.tp2 + 1 && setNow(gr, g) && prints(gr); });
      if (curveCross(g, sh, near)) {
        slurFit(g, m, pre, near);
        if (!curveCross(g, pre, near)) sh = pre;
      }
    }
    var x0 = settling.x;
    return { sp: s, ok: true, side: side, x1: sh.x1 - x0, y1: sh.y1, x2: sh.x2 - x0, y2: sh.y2, h: sh.h, th: sh.th };
  }
  // A slur passes over every head between its ends. The
  // hymn's melismas are two or three notes, but the gift of tongues' runs
  // dip and climb under one slur, and a crescent struck from the first head
  // to the last cut through the heads between — a second stroke across a
  // head, which the owner ruled out. So the slur curves deeper, as far as
  // 2.2 spaces, to pass them with a quarter space's air; where even that is
  // not enough, both its ends stand further off their heads, alike — but
  // never more than a space further (SLUR_END): a slur keeps beside its own
  // notes. (Heads only: a slur may cross a stem, as in any score.)
  // (fitted once, when it is settled, to the heads of its own
  // line where they stand — the melisma's notes, the singer's run:
  // settleCurve. Fitted before to every head on the staff, wherever it
  // might come, and free to move its ends without limit, the tenor's slur,
  // set under its notes, went looking for the bass's heads under it and hung
  // three spaces below its own notes. Now it lies on its voice's own side,
  // where the other voice is not, and its ends move a space at most: it
  // stays beside its notes. A note set after it keeps out from under it:
  // slurHit)
  var SLUR_DEEP = 2.2, SLUR_AIR = 0.25, SLUR_N = 24, SLUR_END = 1;
  function slurFit(g, m, sh, also) {
    var s = g.sp, sd = sh.side, tt = Math.abs(sh.th), dx = sh.x2 - sh.x1, E = [], pts = [], i;
    (m.line || [m.g1, m.g2]).concat(also || []).forEach(function (gr) {
      if (gr.st !== m.st || !setNow(gr, g) || !prints(gr)) return;
      var k = struck(gr, g);
      k.L.placed.forEach(function (p) {
        if (p.h.ghost) return;
        var e = headExt(p, k.o, k.L.s), x0 = k.x + p.x - e[0], x1 = k.x + p.x + e[0];
        if (x1 < sh.x1 || x0 > sh.x2) return;
        E.push([x0 - tt, x1 + tt, sd > 0 ? p.y + e[1] : -(p.y - e[1])]);   // (its span, and its edge toward the slur, in the slur's sense)
      });
    });
    for (i = 1; i < SLUR_N; i++) {                 // (the curve's inner edge, sampled: where it is, and how much a deeper curve moves it)
      var t = i / SLUR_N, u = 1 - t;
      pts.push({ x: sh.x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t), L: sd * (sh.y1 * u * u * (1 + 2 * t) + sh.y2 * t * t * (3 - 2 * t)), c: 3 * t * u });
    }
    var need = Math.abs(sh.h), rest = 0;
    pts.forEach(function (p) { E.forEach(function (e) { if (p.x >= e[0] && p.x <= e[1]) need = Math.max(need, (e[2] + SLUR_AIR * s - p.L) / p.c + tt); }); });
    var hh = Math.min(need, SLUR_DEEP * s);
    pts.forEach(function (p) { E.forEach(function (e) { if (p.x >= e[0] && p.x <= e[1]) rest = Math.max(rest, e[2] + SLUR_AIR * s - p.L - (hh - tt) * p.c); }); });
    var e = sd * clamp(rest, 0, SLUR_END * s);
    sh.h = sd * hh; sh.y1 += e; sh.y2 += e;
  }
  // (does the crescent sh lie across any head of the groups gs, set where
  // they stand? — its twelfths against each head, as slurHit weighs them)
  function curveCross(g, sh, gs) {
    var s = g.sp, tol = 0.05 * s, dx = sh.x2 - sh.x1, pv = null, sl = [], i;
    for (i = 0; i <= 12; i++) {
      var t = i / 12, u = 1 - t, c3 = 3 * t * u, xx = sh.x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t);
      var yl = sh.y1 * u * u * (1 + 2 * t) + sh.y2 * t * t * (3 - 2 * t), ya = yl + sh.h * c3, yb = yl + (sh.h - sh.th) * c3;
      if (pv) sl.push([pv[0], Math.min(pv[1], pv[2], ya, yb), xx, Math.max(pv[1], pv[2], ya, yb)]);
      pv = [xx, ya, yb];
    }
    for (i = 0; i < gs.length; i++) {
      var k = struck(gs[i], g), ps = k.L.placed;
      for (var j = 0; j < ps.length; j++) {
        if (ps[j].h.ghost) continue;
        var e = headExt(ps[j], k.o, k.L.s), b = [k.x + ps[j].x - e[0], ps[j].y - e[1], k.x + ps[j].x + e[0], ps[j].y + e[1]];
        for (var q = 0; q < sl.length; q++) if (b[0] < sl[q][2] - tol && sl[q][0] < b[2] - tol && b[1] < sl[q][3] - tol && sl[q][1] < b[3] - tol) return true;
      }
    }
    return false;
  }
  function drawBarline(c, g, x, st) {
    var sp = g.sp, top = st === "T" ? g.T : g.B, bot = top + 4 * sp;
    vLine(c, x, top, bot, Math.max(1.2 / dpr, 0.16 * sp));
  }
  // ---- the static staff layer: two staves, a brace, and the two clefs --------
  function buildStaffLayer(c) {
    var g = G, sp = g.sp;
    c.clearRect(0, 0, W, H);
    var lw = Math.max(1, Math.round(0.13 * sp * dpr)) / dpr;
    c.fillStyle = rgba(C_INK, 0.52);
    [12, 14, 16, 18, 20].forEach(function (q) { hLine(c, g.xBar, W, g.yT(q), lw); });
    [0, 2, 4, 6, 8].forEach(function (q) { hLine(c, g.xBar, W, g.yB(q), lw); });
    c.fillStyle = rgba(C_INK);
    vLine(c, g.xBar, g.T - lw / 2, g.Bb + lw / 2, Math.max(1.4 / dpr, 0.16 * sp));   // the system's opening barline
    var bw = 1.25 * sp, bx0 = g.xBar - 0.35 * sp - bw, yt = g.T, bh = g.Bb - g.T;   // the brace
    c.save(); c.translate(bx0, yt); c.scale(bw, bh);
    c.beginPath();
    c.moveTo(1, 0);
    c.bezierCurveTo(0.32, 0.03, 0.26, 0.14, 0.3, 0.26);
    c.bezierCurveTo(0.34, 0.38, 0.32, 0.47, 0, 0.5);
    c.bezierCurveTo(0.32, 0.53, 0.34, 0.62, 0.3, 0.74);
    c.bezierCurveTo(0.26, 0.86, 0.32, 0.97, 1, 1);
    c.bezierCurveTo(0.56, 0.96, 0.62, 0.86, 0.6, 0.74);
    c.bezierCurveTo(0.58, 0.6, 0.5, 0.53, 0.06, 0.5);
    c.bezierCurveTo(0.5, 0.47, 0.58, 0.4, 0.6, 0.26);
    c.bezierCurveTo(0.62, 0.14, 0.56, 0.04, 1, 0);
    c.closePath(); c.fill();
    c.restore();
    if (!trebPath && typeof Path2D === "function") {
      trebPath = new Path2D(CLEF_TREBLE.d);
      bassPath = new Path2D(CLEF_BASS.d);
    }
    function clef(cl, path, left, topY, h) {
      var bb = cl.bbox, s = h / (bb[3] - bb[1]);
      c.save(); c.translate(left - bb[0] * s, topY + bb[3] * s); c.scale(s, -s); c.fill(path); c.restore();
    }
    if (trebPath) {                                   // seated on their lines: the curl on G (q14), the dots round F (q6)
      clef(CLEF_TREBLE, trebPath, g.clefX, g.yT(14) - 0.583 * g.trebH, g.trebH);
      clef(CLEF_BASS, bassPath, g.clefX, g.yB(6) - 0.237 * g.bassH, g.bassH);
    }
  }

  // ---- the ward's page ----------------------------------------------------------
  function X(tp) { return Math.round((G.xE - (PT - tp) * SCROLL_PX_S) * dpr) / dpr; }
  // Two voices at one x. A group is placed once, when it falls due: if
  // its ink would run into a group already placed close by on the same
  // staff (a stem through the other voice's head, heads or dots that
  // touch), it is set to the right, clear of that ink, the way a second
  // voice is set. Quick notes ask a little more air: where either note is
  // flagged, a head that would all but touch a head beside it (the old
  // tune's sixteenths, a quarter of its beat apart at 60 px/s) is set aside
  // the same way. (Heads only: a flag reaching toward the next note of an
  // ordinary run of eighths is left as it was, so a run is not pushed along
  // note by note.) The offset is kept, and worked out again if the staff
  // space changes (a resize).
  // (a hymn's note is set at most HYMN_DX_MAX staff spaces after its time:
  // where the music is denser than 60 px/s can hold — a 6/8 hymn's quick
  // bars — the offsets would otherwise carry on from note to note and bar
  // to bar, and the page drift from the sound; there it lets the inks come
  // close instead. The cap holds a bar's push and the notes that must
  // follow a pushed downbeat alike. One thing may stand
  // past it — a voice stepping aside beside the head of the other voice of
  // its chord (a second, or a head beside the other's dot: at most
  // SIDE_MAX past it), and only where the notes after it can still clear
  // it within the cap (roomAfter). The chord itself, set upright, keeps
  // to the cap: chordPlace. A note is drawn from its first frame to its
  // last at the offset it was set at: setDue.)
  var HYMN_DX_MAX = 2.4, SIDE_MAX = 2.6;
  var STACK = 0.2;                                 // (two heads a third apart, one over the other, as a chord's stand: the tune's heavier head too)
  function placeColumn(gr, g, heads, o) {
    if (gr.col && gr.col.sp === g.sp) return gr.col.dx;
    var dx0 = startOf(gr, g);
    if (gr.hymn) dx0 = Math.max(dx0, chordPlace(gr, g).dx);
    var c = clearance(gr, g, heads, o, dx0, null);
    gr.col = { sp: g.sp, dx: Math.min(c.need, c.lim), boxes: c.bx, ink: c.ink };
    return gr.col.dx;
  }
  // where a group's placing starts: a downbeat's note makes room for its
  // bar first (barPush; within the cap, like any offset)
  function startOf(gr, g) { return gr.barIn ? barPush(gr.barIn, g).dx : 0; }
  // The place of a hymn's chord on one staff (each voice its own group, a
  // stem each): its voices start together, upright, from the furthest any
  // of them must go to clear the ink already set, each within its own
  // bound — so a voice carried by its own run of notes does not leave the
  // other behind, and the other is not set past it as if it were in its
  // way. Worked out once, for all of them.
  function chordPlace(gr, g) {
    if (gr.chord && gr.chord.sp === g.sp) return gr.chord;
    var ms = [], ch = { sp: g.sp, dx: 0 };
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A.hymn && !A.noCol && A.st === gr.st && Math.abs(A.tp - gr.tp) < 1e-6) ms.push(A);
    }
    if (ms.length > 1) ms.forEach(function (A) {
      var pg = prepGroup(A, g), c = clearance(A, g, pg.heads, pg.o, startOf(A, g), ms);
      ch.dx = Math.max(ch.dx, Math.min(c.need, c.lim));
    });
    ms.forEach(function (A) { A.chord = ch; });
    gr.chord = ch;
    return ch;
  }
  // How far a group must go, from dx0, to clear the ink already set on its
  // staff (need), and how far it may go (lim: the cap, or a side-step's
  // place). skip: the groups not reckoned with (its own chord, while the
  // chord's place is being found).
  function clearance(gr, g, heads, o, dx0, skip) {
    var sp = g.sp, tol = 0.05 * sp, gap = (gr.tight ? 0.08 : 0.3) * sp;   // (a new guest's quick notes keep the hymn's close air)
    var ink = groupBoxes(inkLayout(gr, g, heads, o), o), bx = ink;
    // (a hymn's two voices a second apart are set the engraver's way: the
    // second head one head's width over, its ledger running under the
    // first — a ledger is no obstacle between them)
    if (gr.hymn) bx = bx.filter(function (b0) { return !b0[4]; });
    var bL = 1e9;
    for (var q = 0; q < bx.length; q++) bL = Math.min(bL, bx[q][0]);
    // (a new guest's note keeps within its own cap, as a hymn's
    // does, so a quick guest — the fiddle's reel — never drifts from its sound)
    var lim = gr.hymn ? HYMN_DX_MAX * sp : gr.cap != null ? gr.cap * sp : 1e9, dx = dx0;
    var ord = gr.cap != null ? orderAt(gr, g) : -1e9;   // (a guest's line in the order it is sung)
    if (!gr.hymn) ord = Math.max(ord, barAfter(gr, g, bx));   // (and after the bars before it)
    if (ord > dx) dx = ord;
    for (var pass = 0; pass < (gr.hymn ? 4 : 8); pass++) {      // (a guest's note, with beams to clear as well, may need more; so may the house's reeds, stepping round a peal)
      var need = dx;
      for (var i = 0; i < groups.length; i++) {
        var A = groups[i];
        if (A === gr || !A.col || A.col.sp !== sp || A.st !== gr.st || !(A.lastA > 0.05) || (skip && skip.indexOf(A) >= 0)) continue;
        var off = (A.tp - gr.tp) * SCROLL_PX_S + A.col.dx;     // A's origin, from ours
        if (off < dx - 8 * sp || off > dx + 8 * sp) continue;
        var ab = A.col.boxes, hit = false, aR = -1e9, air = o.flags || A.flags ? gap : 0, hy = gr.hymn && A.hymn;
        if (gr.air || A.air) air = Math.max(air, Math.max(gr.air || 0, A.air || 0) * sp);   // (a spoken cross's own air)
        var chord = hy && Math.abs(A.tp - gr.tp) < 1e-6;     // (two voices of one chord: an accidental stands before both heads)
        for (var m = 0; m < ab.length; m++) {
          if (hy && ab[m][4]) continue;
          var ax0 = ab[m][0] + off, ax1 = ab[m][2] + off;
          aR = Math.max(aR, ax1);
          for (var n = 0; !hit && n < bx.length; n++) {
            var b = bx[n], ha = air && ab[m][5] && b[5] ? air : 0;   // two heads, one of them flagged: air between them
            if (hy) ha = (ab[m][6] || b[6]) && !chord ? 0.2 * sp : 0;   // (a hymn's beamed voices need no flag's air; a sharp is not set against the ink before it)
            if (ab[m][4] && b[4]) continue;                     // ledgers may meet
            var ty = hy && ab[m][5] && b[5] ? STACK * sp : tol;
            if (ax0 - ha < b[2] + dx - tol && b[0] + dx < ax1 + ha - tol && ab[m][1] < b[3] - ty && b[1] < ab[m][3] - ty) hit = true;
          }
        }
        if (!hit) continue;
        var req = aR + (hy ? 0.08 * sp : Math.max(gap, air)) - bL;   // (a spoken cross's air is kept, not only asked)
        need = Math.max(need, req);
        if (!hy) continue;
        if (chord) {                                         // its own chord: a side-step, past the cap only where there is room after it
          var side = Math.min(A.col.dx + SIDE_MAX * sp, req);
          if (side > lim && roomAfter(gr, g, bx, side)) lim = side;
        }
      }
      // (a guest's note stands clear of the hymn's bars, as of its notes:
      // the bar was placed first, and does not move)
      if (!gr.hymn) for (var k2 = 0; k2 < marks.length; k2++) {
        var mb = marks[k2];
        if (mb.kind !== "bar" || !(mb.at && mb.at.sp === sp) || mb.sts.indexOf(gr.st) < 0 || Math.abs(mb.tp - gr.tp) > 3) continue;
        var bi = barInk(mb, g), xb = (mb.tp - gr.tp) * SCROLL_PX_S + mb.at.rel, xl = xb - bi.wl - BAR_AIR * sp, xr = xb + bi.wr + BAR_AIR * sp;
        for (var n2 = 0; n2 < bx.length; n2++) {
          if (inBand(g, gr.st, bx[n2]) && bx[n2][0] + dx < xr && bx[n2][2] + dx > xl) { need = Math.max(need, xr - bL); break; }
        }
      }
      // (a guest's note keeps its heads out from under a guest's laid beam)
      if (gr.cap != null) { var be = beamHit(gr, g, bx, dx); if (be != null) need = Math.max(need, be + gap - bL); }
      var su = slurHit(gr, g, bx, dx); if (su != null) need = Math.max(need, su + SLUR_AIR * sp - bL);   // (and out from under a slur)
      if (need <= dx) break;
      dx = need;
    }
    // (past its cap a new guest's note may come close to the ink
    // before it, as a hymn's does, but it never stands on a bar, and no
    // head of either is struck through by the other's ink — a stem, a
    // ledger, a flag, a beam, another head: there it goes on past)
    // (the order of its line lifts its cap only as far as the order
    // asks — past that it goes on only for a bar, a head or a beam, as before)
    if (!gr.hymn && dx > lim && ord > lim) lim = ord;
    if (!gr.hymn && gr.cap != null && dx > lim && (onBar(gr, g, bx, lim) || onHead(gr, g, bx, lim) || beamHit(gr, g, bx, lim) != null || slurHit(gr, g, bx, lim) != null)) lim = dx;
    return { need: dx, lim: lim, bx: bx, ink: ink };
  }
  // A note after a bar in time prints after it on the page.
  // A guest's note is set after the bars placed before it, and it kept clear
  // of one only where it would stand on it: where the bar had been set far
  // along (after notes pushed late), a downbeat's note held at its cap
  // printed before its own bar. The least offset that puts its ink in the
  // staff after every bar placed at or before its time, with the bar's air;
  // -1e9 where none asks.
  function barAfter(gr, g, bx) {
    var sp = g.sp, out = -1e9, bL = 1e9;
    for (var n = 0; n < bx.length; n++) if (inBand(g, gr.st, bx[n])) bL = Math.min(bL, bx[n][0]);
    if (bL > 1e8) return out;
    for (var k = 0; k < marks.length; k++) {
      var mb = marks[k];
      if (mb.kind !== "bar" || !(mb.at && mb.at.sp === sp) || mb.sts.indexOf(gr.st) < 0 || mb.tp > gr.tp + 0.03 || mb.tp < gr.tp - 3) continue;
      var bi = barInk(mb, g), xb = (mb.tp - gr.tp) * SCROLL_PX_S + mb.at.rel;
      out = Math.max(out, xb + bi.wr + BAR_AIR * sp - bL);
    }
    return out;
  }
  // (on a bar, or within a pixel or two of it: the page's pixels round each
  // item's place on its own, so a hair's breadth is not clear)
  function onBar(gr, g, bx, x) {
    var pad = 0.2 * g.sp;
    for (var k = 0; k < marks.length; k++) {
      var mb = marks[k];
      if (mb.kind !== "bar" || !(mb.at && mb.at.sp === g.sp) || mb.sts.indexOf(gr.st) < 0 || Math.abs(mb.tp - gr.tp) > 3) continue;
      var bi = barInk(mb, g), xb = (mb.tp - gr.tp) * SCROLL_PX_S + mb.at.rel;
      for (var n = 0; n < bx.length; n++) if (inBand(g, gr.st, bx[n]) && bx[n][0] + x < xb + bi.wr + pad && bx[n][2] + x > xb - bi.wl - pad) return true;
    }
    return false;
  }
  // (a head struck through: one note's head under another's ink — its stem,
  // a ledger, a flag, a sign, its head — either way round. Every head is
  // one clean strike, the owner's rule: a stem across it is a second stroke)
  function onHead(gr, g, bx, x) {
    var sp = g.sp, tol = 0.05 * sp;
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A === gr || !A.col || A.col.sp !== sp || A.st !== gr.st || !(A.lastA > 0.05)) continue;
      var off = (A.tp - gr.tp) * SCROLL_PX_S + A.col.dx, ab = A.col.ink || A.col.boxes;   // (all its ink: a hymn's ledgers too)
      if (off < x - 5 * sp || off > x + 5 * sp) continue;
      for (var m = 0; m < ab.length; m++) {
        for (var n = 0; n < bx.length; n++) {
          var a = ab[m], b = bx[n];
          if (!a[5] && !b[5]) continue;                          // (ink on ink, no head between: the clearance's own care)
          if (a[0] + off < b[2] + x - tol && b[0] + x < a[2] + off - tol && a[1] < b[3] - tol && b[1] < a[3] - tol) return true;
        }
      }
    }
    return false;
  }
  // A guest's line reads left to right in the order it
  // is sung: a note never prints left of an earlier note of its own line on
  // its staff (the organist's running figure, pushed along by the chords
  // under it, read backwards and lost its beams). Where an earlier note has
  // been set past its time, this one follows it — enough after it to read
  // as after it (0.6 sp, or less where its own time is nearer: two heads
  // that would touch are kept apart by the clearance as ever), and always
  // more than half the way closer than its time would put it, so an offset
  // dies away along the line within a few notes (a note whose neighbour
  // kept its place is not touched). The least offset that keeps the order;
  // -1e9 where nothing asks. Only a guest's one line asks it (madeSince's
  // line): the fiddle's tune (its open string is a voice of its own, held),
  // the organist's figure, the gift's song, the company's unison, the
  // spoken words, the far tower's peal, the gulls' cries, and
  // the far ward's notes on each staff, whichever part sings them — not the
  // organ's chords and pedal, whose voices ran away when held to one order.
  function orderAt(gr, g) {
    var sp = g.sp, out = -1e9;
    if (!gr.line) return out;
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A === gr || A.line !== gr.line || A.layer !== gr.layer || A.st !== gr.st || A.noCol || !(A.col && A.col.sp === sp) || !(A.lastA > 0.05)) continue;
      var d0 = (gr.tp - A.tp) * SCROLL_PX_S;
      if (d0 < 1e-3 || d0 > 12 * sp) continue;
      var adv = Math.min(0.6 * sp, 0.45 * d0);
      out = Math.max(out, A.col.dx - d0 + adv);
    }
    return out;
  }
  // The far ward sings on our beats, a line behind, and its notes can fall
  // where one of our bars must stand (a double bar in our breath between two
  // lines, a bar squeezed before a quick downbeat). A bar keeps clear of the
  // ink before it, and a note keeps clear of a bar placed before it — so a
  // far note that falls just before a bar of ours waits until that bar has
  // been placed, and then keeps clear of it. It prints a moment behind the
  // burin; once printed it never moves.
  // (and on each beat it shares with us, our notes are set first, a
  // moment before it, so it is the far ward's that steps aside)
  // (and a far note sung a hair before one of ours waits for ours too, so
  // that ours is set first and it is the far ward's that keeps clear; never
  // for a note of ours that will not print — the organ under a singer)
  var BAR_WAIT_S = 0.7, YIELD_LAG = 0.08, NOTE_WAIT_S = 0.45;
  function barWaits(gr, g) {
    if (PT < gr.tp + YIELD_LAG) return true;
    for (var k = 0; k < marks.length; k++) {
      var mb = marks[k];
      if (mb.kind === "bar" && !(mb.at && mb.at.sp === g.sp) && mb.sts.indexOf(gr.st) >= 0 && mb.tp >= gr.tp - 1e-6 && mb.tp - gr.tp <= BAR_WAIT_S) return true;
    }
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A === gr || A.yields || A.noCol || A.st !== gr.st || A.tp < gr.tp - 1e-6 || A.tp - gr.tp > NOTE_WAIT_S) continue;
      if (!(A.col && A.col.sp === g.sp) && !(A.alone && A.aloneOk === false)) return true;
    }
    return false;
  }
  // A guest's beam — the fiddle's eighths, the organist's running
  // figure, a singer's run — is laid when its first note is set, and it
  // would run across whatever lies between its stems: a caller's cross, the
  // open string under the tune. So before it is laid it looks along its
  // line; where it would cross another note's head (one set, or one coming
  // in its span, where it will stand: an organ's chord under its figure,
  // the fiddle's open string — the notes of its own line before and after
  // it keep out from under it themselves) it is laid on the other side of
  // its notes, the stems turned; and where that side is crossed too it is
  // not laid, and its notes keep their own flags — which the page steps
  // aside for, as for any ink.
  var beamTally = { laid: 0, turned: 0, cut: 0, by: {} };   // (for the silent checks: probe().beams)
  function beamLay(bm, g) {
    if (bm.laid) return;
    bm.laid = true;
    var ms = bm.members;
    if (ms.some(function (m) { return m.col; })) return;
    var geo = beamGeo(bm, g);
    if (!geo) return;
    var why = beamBlocked(bm, geo, g);
    if (!why) { beamTally.laid++; return; }
    bm.fixed = -geo.dir; bm.geo = null;            // (the other side of its notes: the organist's figure over the chord, not through it)
    var alt = beamGeo(bm, g);
    if (alt && alt.dir !== geo.dir && !beamBlocked(bm, alt, g)) { beamTally.laid++; beamTally.turned++; return; }
    beamTally.cut++; beamTally.by[why] = (beamTally.by[why] || 0) + 1;
    ms.forEach(function (m) { m.beam = null; });
    bm.geo = null;
  }
  // (what its line, geo, would cross — the crossed note's layer, "~" if it
  // is still to come — or null)
  function beamBlocked(bm, geo, g) {
    var ms = bm.members, sp = g.sp, yAt = beamYAt(bm, geo), dir = geo.dir, pad = 0.3 * sp;
    var two = ms.some(function (m) { return (m.flags || 1) >= 2; }), ext = (two ? 1.25 : 0.5) * sp * dir;
    var xa = X(ms[0].tp) + geo.x0 - pad, xb = X(ms[ms.length - 1].tp) + geo.x0 + 0.5 * sp + pad;   // (its last note may be set a little after its time)
    function crosses(b) {                          // (a head's box against the band where the head stands)
      var x0 = Math.max(b[0], xa), x1 = Math.min(b[2], xb);
      if (x1 <= x0) return false;
      var lo = Math.min(yAt(x0), yAt(x1)) + Math.min(0, ext) - pad, hi = Math.max(yAt(x0), yAt(x1)) + Math.max(0, ext) + pad;
      return b[3] > lo && b[1] < hi;
    }
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A.beam === bm || A.st !== bm.st || A.noCol || A.tp < ms[0].tp - 3 || A.tp > ms[ms.length - 1].tp + 1) continue;
      if (!(A.col && A.col.sp === sp) && A.layer === ms[0].layer &&          // (its own line's notes still to come, before or after it, keep
          (A.tp < ms[0].tp - 1e-6 || A.tp > ms[ms.length - 1].tp + 1e-6)) continue;   // out from under it themselves: beamHit)
      var set = A.col && A.col.sp === sp, x0 = X(A.tp) + (set ? A.col.dx : 0), reach = set ? 0 : (A.cap != null ? A.cap : HYMN_DX_MAX) * sp;
      var hb = set ? A.col.ink.filter(function (b) { return b[5]; }).map(function (b) { return [b[0] + x0, b[1], b[2] + x0 + reach, b[3]]; })
        : drawnHeads(A, g).map(function (h) { var y = g.y(A.st, h.q), s = (A.scale || 1) * sp; return [x0 - 0.7 * s, y - 0.55 * s, x0 + 0.7 * s + reach, y + 0.55 * s]; });
      for (var k = 0; k < hb.length; k++) if (crosses(hb[k])) return A.layer + (set ? "" : "~");
    }
    return null;
  }
  // (and a guest's note that comes after such a beam is laid keeps its head
  // out from under it: where one of its heads at x, from its own time's
  // place, would lie under a laid guest beam of another's, the beam's right
  // end, from the same place — the note goes on past it; else null)
  function beamHit(gr, g, bx, x) {
    var sp = g.sp, x0g = X(gr.tp), sw = Math.max(1.4 / dpr, 0.12 * sp), pad = 0.3 * sp, end = null;
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i], bm = A.beam;
      if (!bm || bm === gr.beam || A !== bm.members[0] || !bm.laid || !bm.geo || bm.geo.sp !== sp || bm.st !== gr.st || Math.abs(A.tp - gr.tp) > 4) continue;
      var ms = bm.members, dir = bm.geo.dir, yAt = beamYAt(bm, bm.geo), so = dir * (0.57 * sp - sw / 2);
      var ext = (ms.some(function (m) { return (m.flags || 1) >= 2; }) ? 1.25 : 0.5) * sp * dir;
      var xs = ms.map(function (m) { return X(m.tp) + (m.col && m.col.sp === sp ? m.col.dx : 0) + so; });
      var xa = Math.min.apply(null, xs) - sw / 2 - pad, xb = Math.max.apply(null, xs) + sw / 2 + pad;
      for (var n = 0; n < bx.length; n++) {
        if (!bx[n][5]) continue;
        var h0 = Math.max(x0g + x + bx[n][0], xa), h1 = Math.min(x0g + x + bx[n][2], xb);
        if (h1 <= h0) continue;
        var lo = Math.min(yAt(h0), yAt(h1)) + Math.min(0, ext) - pad, hi = Math.max(yAt(h0), yAt(h1)) + Math.max(0, ext) + pad;
        if (bx[n][3] > lo && bx[n][1] < hi) { end = Math.max(end == null ? -1e9 : end, xb - x0g); break; }
      }
    }
    return end;
  }
  // A slur is settled when its last note is set, and a note
  // that comes after it — the next of the singer's notes, close behind the
  // run's last — keeps its heads out from under it, as from under a beam:
  // where one of its heads at x would lie under a settled slur or tie on
  // its staff, the curve's right end (from its own time's place) — it goes
  // on past; else null.
  function slurHit(gr, g, bx, x) {
    var sp = g.sp, tol = 0.05 * sp, end = null;
    for (var k = 0; k < marks.length; k++) {
      var m = marks[k], z = m.set && m.set.sp === sp ? m.set : null;
      if ((m.kind !== "slur" && m.kind !== "tie") || !z || !z.ok || m.st !== gr.st || m.g1 === gr || m.g2 === gr || Math.abs(m.tp - gr.tp) > 6) continue;
      var o = (m.tp - gr.tp) * SCROLL_PX_S, x1 = o + z.x1, x2 = o + z.x2, dx = x2 - x1, pv = null, sl = [];
      for (var i = 0; i <= 12; i++) {             // (the crescent in twelfths, as probe("ink") slices it)
        var t = i / 12, u = 1 - t, c3 = 3 * t * u, xx = x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t);
        var yl = z.y1 * u * u * (1 + 2 * t) + z.y2 * t * t * (3 - 2 * t), ya = yl + z.h * c3, yb = yl + (z.h - z.th) * c3;
        if (pv) sl.push([pv[0], Math.min(pv[1], pv[2], ya, yb), xx, Math.max(pv[1], pv[2], ya, yb)]);
        pv = [xx, ya, yb];
      }
      for (var n = 0; n < bx.length; n++) {
        var b = bx[n];
        if (!b[5]) continue;
        for (var q = 0; q < sl.length; q++) if (b[0] + x < sl[q][2] - tol && sl[q][0] < b[2] + x - tol && b[1] < sl[q][3] - tol && sl[q][1] < b[3] - tol) { end = Math.max(end == null ? -1e9 : end, x2); break; }
      }
    }
    return end;
  }
  // May a voice step aside past the cap, to x (its ink bx)? Only where the
  // hymn's notes after it on its staff, set at the cap, would still clear
  // it there: then nothing after it has to go past the cap for it, and
  // where the music is too dense for that (a 6/8 hymn's sixteenths) the
  // chord keeps to the cap as before.
  function roomAfter(gr, g, bx, x) {
    var sp = g.sp, tol = 0.05 * sp, cap = HYMN_DX_MAX * sp, bR = -1e9;
    for (var q = 0; q < bx.length; q++) bR = Math.max(bR, bx[q][2]);
    for (var i = 0; i < groups.length; i++) {
      var B = groups[i];
      if (!B.hymn || B.noCol || B.st !== gr.st || B.tp <= gr.tp + 1e-6) continue;
      var off = (B.tp - gr.tp) * SCROLL_PX_S + cap;          // B's origin, set at the cap, from ours
      if (off > x + bR + 3 * sp) continue;
      var pg = prepGroup(B, g), bb = groupBoxes(inkLayout(B, g, pg.heads, pg.o), pg.o);
      for (var m = 0; m < bb.length; m++) {
        if (bb[m][4]) continue;
        for (var n = 0; n < bx.length; n++) {
          var b = bx[n], ty = bb[m][5] && b[5] ? STACK * sp : tol;
          if (bb[m][0] + off < b[2] + x + 0.08 * sp && b[0] + x < bb[m][2] + off && bb[m][1] < b[3] - ty && b[1] < bb[m][3] - ty) return false;
        }
      }
    }
    return true;
  }
  // Everything newly due on the page is set before any of it is drawn, in
  // the order of its time — a note, then the bar that stands after it — so
  // that where a slow frame or a hidden tab brings several notes at once,
  // each is set as it would have been one at a time (a note clears only
  // what came before it), and a bar is placed once the notes either side
  // of it that are due with it have been set.
  function setDue(g) {
    var sp = g.sp, due = [], i;
    for (i = 0; i < groups.length; i++) {
      var gr = groups[i];
      if (gr.tp > PT || X(gr.tp) < -6 * sp || (gr.noCol ? gr.dueSp === sp : gr.col && gr.col.sp === sp)) continue;
      due.push(gr);
    }
    for (i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (m.kind === "bar" && m.tp <= PT && !(m.at && m.at.sp === sp) && X(m.tp) >= -6 * sp) due.push(m);
    }
    if (!due.length) return;
    // (at one time: the hymn's notes, then their bar, then a guest's note,
    // which keeps clear of the bar placed before it)
    function rank(it) { return it.kind === "bar" ? 1 : it.hymn ? 0 : 2; }
    function at(it) { return it.tp + (it.yields ? YIELD_LAG : 0); }   // (the far ward after our notes of its beat)
    due.sort(function (a, b) { return at(a) - at(b) || rank(a) - rank(b); });
    due.forEach(function (it) {
      if (it.kind === "bar") { barPlace(it, g); return; }
      if (it.yields && barWaits(it, g)) return;                // (the far ward's note just before a bar of ours waits for it)
      if (it.alone) {                                          // the organ: only where no one sings over it
        if (it.aloneOk == null) it.aloneOk = organAlone(it);
        if (!it.aloneOk) return;
      }
      it.lastA = dryA(it) * (it.ink || 1);
      if (it.lastA < 0.02) return;
      if (it.noCol) { it.dueSp = sp; return; }
      var pg = prepGroup(it, g);
      placeColumn(it, g, pg.heads, pg.o);
    });
  }
  function drawPage(c) {
    var g = G, sp = g.sp, xR = g.xE + 3 * sp;
    setDue(g);
    // the groups — heads on their stems, in the one ink: each note (a beam
    // with its notes) one impression, laid once at its alpha (impress)
    var keep = 0, units = [];
    proofC.setTransform(1, 0, 0, 1, 0, 0); proofC.globalAlpha = 1;
    proofC.clearRect(0, 0, proofLayer.width, proofLayer.height);
    proofC.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < groups.length; i++) {
      var gr = groups[i], x = X(gr.tp);
      if (x < -6 * sp) continue;                               // gone past the clefs
      groups[keep++] = gr;
      if (gr.tp > PT || x > xR) continue;                      // not yet sung
      if (gr.yields && !(gr.col && gr.col.sp === sp) && barWaits(gr, g)) continue;
      if (gr.alone) {                                          // the organ: only where no one sings over it
        if (gr.aloneOk == null) gr.aloneOk = organAlone(gr);
        if (!gr.aloneOk) continue;
      }
      var a = dryA(gr) * (gr.ink || 1);                    // a guest's own ink: the far choir's, the old tune's
      gr.lastA = a;
      if (a < 0.02) continue;
      var pg = prepGroup(gr, g), heads = pg.heads, o = pg.o;
      x += gr.noCol ? coDx(gr, g) : placeColumn(gr, g, heads, o);
      // (nothing prints ahead of the burin. A note set past
      // its time — stepping aside, making room for a bar — waits where it
      // was set until the burin reaches it, and is struck there, once)
      if (x > g.xE + BURIN_EPS * sp) continue;
      var u, bm = gr.beam && gr.beam.geo ? gr.beam : null;
      if (bm) {
        o.beamY = beamYAt(bm, bm.geo);
        if (bm.uF !== FRAME) { bm.uF = FRAME; bm.u = { a: 0, its: [], bm: bm }; units.push(bm.u); }
        u = bm.u;
      } else units.push(u = { a: 0, its: [], bm: null });
      u.a = Math.max(u.a, a);
      u.its.push({ gr: gr, x: x, heads: heads, o: o });
      gr.drawnAt = FRAME; gr.lastX = x; gr.lastO = o;
    }
    groups.length = keep;
    for (i = 0; i < units.length; i++) impress(c, g, units[i]);
    drawMarks(c);
    c.globalAlpha = 1;
  }
  // ---- one even tone ---------------------------------------------------------
  // The owner, close to a pale note: "as though there's two strokes for each
  // note". There were. A note is several strokes — its head, its stem (whose
  // root lies inside the head), its flags (a sixteenth's two, one over the
  // other), the ledger its head sits on — and each was laid at the note's
  // own alpha, so wherever two met the ink lay twice and printed darker: a
  // dark seam where the stem crosses the head, a darker tongue where the
  // flags meet. Now a note is struck whole, at full strength, on a proof
  // sheet (a scratch layer the page's size), and that patch of the sheet is
  // laid on the page once, at the note's alpha: one even tone however its
  // strokes meet, fresh or drying, near or far. A beam and the notes it joins
  // are one impression (their stems run into it), a bell and its ring
  // another. (The paper's own lines still show through pale ink, as they
  // would through any thin ink.)
  var BURIN_EPS = 0.05;                            // (sp: the burin's own hair)
  var proofLayer = null, proofC = null, koA = null;
  function impress(c, g, u) {
    var pc = proofC, sp = g.sp, bb = [1e9, 1e9, -1e9, -1e9];
    function grow(b) { bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); }
    koA = u.a;                                     // (the telegraph weighs the ink at its own strength)
    for (var i = 0; i < u.its.length; i++) {
      var it = u.its[i], gr = it.gr, r = drawGroup(pc, g, it.x, it.heads, gr.st, gr.dir, it.o);
      gr.lastSx = r.sx; gr.lastL = r.L;
      groupBoxes(r.L, it.o).forEach(grow);
      if (gr.ring) {
        var y = g.y(gr.st, it.heads[0].q), rr = ((gr.ringK || 0.98) * (gr.scale || 1) + 0.1) * sp;
        drawBellRing(pc, g, it.x, y, gr.scale, gr.ringK);
        grow([it.x - rr, y - rr, it.x + rr, y + rr]);
      }
    }
    if (u.bm) { var bb2 = drawBeam(pc, g, u.bm); if (bb2) grow(bb2); }
    koA = null;
    stamp(c, g, u.a, bb);
  }
  // (the patch bb of the proof sheet — every stroke of one impression, and a
  // margin for their soft edges — laid on the page at alpha a; the sheet
  // then wiped there for the next)
  function stamp(c, g, a, bb) {
    if (!(bb[2] > bb[0])) return;
    var pc = proofC, pad = 0.35 * g.sp, d = dpr;
    var x0 = Math.max(0, Math.floor((bb[0] - pad) * d)), y0 = Math.max(0, Math.floor((bb[1] - pad) * d));
    var x1 = Math.min(proofLayer.width, Math.ceil((bb[2] + pad) * d)), y1 = Math.min(proofLayer.height, Math.ceil((bb[3] + pad) * d));
    if (x1 <= x0 || y1 <= y0) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = a;
    c.drawImage(proofLayer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    c.restore();
    pc.save(); pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(x0, y0, x1 - x0, y1 - y0); pc.restore();
  }
  // a group's heads and how it is engraved, this frame (a beamed note's stem is the beam's)
  function prepGroup(gr, g) {
    if (gr.beam && gr.cap != null && !gr.beam.laid) beamLay(gr.beam, g);   // (a guest's beam is not laid across a head)
    var heads = drawnHeads(gr, g), o = inkOpts(gr);
    if (gr.beam) {
      var bg = beamGeo(gr.beam, g);
      if (bg) { gr.dir = bg.dir; o.flags = 0; }
    }
    return { heads: heads, o: o };
  }
  // The one measure of a group's ink: the group laid
  // out as drawPage lays it — a beamed note's stem run to its beam, never
  // turned — at its own time's x (0), its column's offset aside. Where a
  // note is set (placeColumn) and what a bar weighs, both when it asks its
  // downbeat for room and when it is placed (barExtents), are this layout's
  // boxes (groupBoxes, ledger lines included), and drawPage draws this
  // layout: so a bar never stands on ink its push did not see.
  function inkLayout(gr, g, heads, o) {
    var bm = gr.beam, geo = bm && bm.geo && bm.geo.sp === g.sp ? bm.geo : null, o2 = o;
    if (geo) {
      o2 = {};
      for (var k in o) o2[k] = o[k];
      var x0 = (bm.members[0].tp - gr.tp) * SCROLL_PX_S + geo.x0;
      o2.beamY = function (x) { return geo.y0 + geo.m * (x - x0); };
    }
    return layoutGroup(g, 0, heads, gr.st, gr.dir, o2);
  }
  // (a second voice's stem on the first's head goes where that head went)
  function coDx(gr, g) { var p = gr.coOf; return p && p.col && p.col.sp === g.sp ? p.col.dx : 0; }
  // the ink a group will lay, as boxes about its own time's x (every box
  // groupBoxes knows: its ledgers too), and its column's offset: set now
  // if it has not been (a bar asks after the notes before it)
  function inkOf(gr, g) {
    if (gr.noCol) {
      if (!(gr.inkBx && gr.inkBx.sp === g.sp)) {
        var pg = prepGroup(gr, g);
        gr.inkBx = { sp: g.sp, boxes: groupBoxes(inkLayout(gr, g, pg.heads, pg.o), pg.o) };
      }
      return { dx: coDx(gr, g), boxes: gr.inkBx.boxes };
    }
    if (!(gr.col && gr.col.sp === g.sp)) { var p2 = prepGroup(gr, g); placeColumn(gr, g, p2.heads, p2.o); }
    return { dx: gr.col.dx, boxes: gr.col.ink };
  }
  // how a group is engraved (alt: the stem it takes if its voice's own would be stubby)
  function inkOpts(gr) {
    return { scale: gr.scale, rgb: C_INK, noStem: gr.noStem, flags: gr.flags, breve: gr.v && gr.v.breve, ring: gr.ring, ringK: gr.ringK, thin: gr.thin, alt: gr.alt,
             keep: gr.hymn && (gr.voice === "both" || (gr.voice !== "one" && gr.voice !== "hop")), room: gr.room, ferm: gr.ferm || 0,
             tune: !!(gr.hymn && gr.tune && gr.voice !== "one" && gr.voice !== "hop" && gr.voice !== "both") };
  }
  // a bell: a ringed head — one thin ring, drawn with the head, that dries
  // with it (no spreading rings: nothing on the page moves but the scroll)
  function drawBellRing(c, g, x, y, sc, k) {       // (k: the ring's radius in the head's own size — the far tower's)
    var r = (k || 0.98) * g.sp * (sc || 1), lw = Math.max(1 / dpr, 0.07 * g.sp);
    c.save();
    c.strokeStyle = rgba(C_INK); c.lineWidth = lw;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.restore();
    koEllipse(c, x, y, r + lw + KO_PAD * g.sp, r + lw + KO_PAD * g.sp);
  }

  // the telegraph: its message punched straight into the page's paper along
  // the middle of the gap (the owner: no tape, no container) — a round
  // hole for a dit, a slot for a dah, each showing the plate beneath with a
  // little shadow under its upper lip. A hole is punched at the engraving
  // point when its key lifts and then travels with the page like a note (so
  // the message is laid out at the page's own scale); it dries like a note,
  // and it is never punched where a note, ledger or stem has the gap.
  function tapeLive() {
    for (var i = 0; i < tapes.length; i++) if (tapes[i].tp <= PT) return true;
    return false;
  }
  function holeR(T) { return Math.min(0.23 * G.sp, 0.45 * T.U * SCROLL_PX_S); }
  function drawTapes(c) {
    var g = G, sp = g.sp, cy = g.tapeY;
    for (var i = tapes.length - 1; i >= 0; i--) {
      var T = tapes[i];
      if (T.tp > PT) continue;
      if (X(T.tp + T.Tt) < -4 * sp) { tapes.splice(i, 1); continue; }
      var hr = holeR(T), inset = Math.min(0.04 * sp, 0.1 * hr);
      for (var j = 0; j < T.marks.length; j++) {
        var mk = T.marks[j];
        if (mk.tp > PT) break;                           // punched when the key lifts
        var xa = X(T.tp + mk.at) + inset, xb = X(mk.tp) - inset;
        if (xb < -2 * sp) continue;
        var a = dryA(mk);
        if (a < 0.02) continue;
        var hx0 = mk.dah ? xa : (xa + xb) / 2 - hr, hx1 = mk.dah ? Math.max(xb, xa + 2 * hr) : (xa + xb) / 2 + hr;
        if (koCovers(hx0, cy - hr, hx1, cy + hr)) continue;   // the music has the gap here
        c.globalAlpha = a;
        c.beginPath();
        if (!mk.dah) c.arc((xa + xb) / 2, cy, hr, 0, Math.PI * 2);
        else rrect(c, xa, cy - hr, Math.max(2 * hr, xb - xa), 2 * hr, hr);
        c.fillStyle = "#ddd1b4"; c.fill();              // the plate seen through the hole
        c.save(); c.clip();
        c.strokeStyle = "rgba(60, 45, 20, 0.6)"; c.lineWidth = 0.87 * hr;
        var d = 0.39 * hr;
        c.beginPath();
        if (!mk.dah) c.arc((xa + xb) / 2, cy + d, hr, Math.PI, Math.PI * 2);
        else { c.moveTo(xa, cy + 0.1 * hr); c.arcTo(xa, cy - hr + d, xa + hr, cy - hr + d, hr); c.lineTo(xb - hr, cy - hr + d); c.arcTo(xb, cy - hr + d, xb, cy + 0.1 * hr, hr); }
        c.stroke(); c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  // ---- the band's own layer ---------------------------------------------------
  // Round notes in the same green, on their own layer under the ward's ink,
  // sliding through at the band's own (quicker) rate; each note's ink follows
  // the band's approach, crossing and recession. Barlines every two of its
  // beats. No figures or words: the round heads and the pace say "not ours".
  function drawBand(c) {
    var g = G, sp = g.sp, keep = 0;
    for (var i = 0; i < bandNotes.length; i++) {
      var n = bandNotes[i], bd = n.bd;
      var x = Math.round((g.xE - (PT - n.tp) * SCROLL_PX_S * bd.r) * dpr) / dpr;
      if (x < -6 * sp) continue;
      bandNotes[keep++] = n;
      if (n.tp > PT) continue;
      // (each note struck whole on the proof sheet and laid once at its
      // alpha, as the ward's are: one even tone — impress)
      var ba = (0.12 + 0.68 * n.loud) * dryA(n), bo, rb, bb = [1e9, 1e9, -1e9, -1e9];
      if (n.mel) {
        var q = n.q;
        while (q > g.qMaxT) q -= 7;                              // folded in silently, like the ward's
        bo = { rgb: C_INK, noStem: !n.v.stem, flags: n.v.flags };
        rb = drawGroup(proofC, g, x, [{ q: q, shape: "round", open: n.v.open, dots: n.v.dots }], "T", q >= 16 ? -1 : 1, bo);
      } else {
        // the oom-pah, written the bandsman's way — a staccato quarter
        bo = { rgb: C_INK };
        rb = drawGroup(proofC, g, x, [{ q: n.q, shape: "round", open: false }], "B", -1, bo);
        var dq = n.q % 2 === 0 ? n.q + 1.5 : n.q + 2, dy = g.yB(dq);
        proofC.beginPath(); proofC.arc(rb.topX, dy, 0.17 * sp, 0, Math.PI * 2); proofC.fill();
        bb = [rb.topX - 0.2 * sp, dy - 0.2 * sp, rb.topX + 0.2 * sp, dy + 0.2 * sp];
      }
      groupBoxes(rb.L, bo).forEach(function (b) { bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); });
      stamp(c, g, ba, bb);
    }
    bandNotes.length = keep;
    // the band's barlines, every two of its beats
    for (var b = visits.length - 1; b >= 0; b--) {
      var bd2 = visits[b];
      var XB = function (tp) { return Math.round((g.xE - (PT - tp) * SCROLL_PX_S * bd2.r) * dpr) / dpr; };
      if (bd2.tp0 > PT) continue;
      if (XB(bd2.tp1) < -6 * sp) { visits.splice(b, 1); continue; }
      for (var k = 1; k < bd2.bass.length; k++) {
        var tb = bd2.bass[k].tp;
        if (tb > PT) break;
        var xb = XB(tb) - 1.8 * sp;
        if (xb < -sp || xb > g.xE) continue;
        var life = clamp((tb - bd2.tp0) / Math.max(1, bd2.tp1 - bd2.tp0), 0, 1);
        c.globalAlpha = (0.1 + 0.4 * Math.sin(Math.PI * life)) * dryA(bd2.bass[k]);
        c.fillStyle = rgba(C_INK);
        drawBarline(c, g, xb, "T"); drawBarline(c, g, xb, "B");
      }
    }
    c.globalAlpha = 1;
  }

  // ---- the frame ----------------------------------------------------------------
  var inkLayer = null, bandLayer = null, tapeLayer = null;
  var fades = null;                                // each layer's fade before the clefs, made where the plate is measured (resize)
  var lastFrame = 0;
  function paintLayer(layer, fn) {
    var c = layer.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    c.clearRect(0, 0, layer.width, layer.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save();
    c.beginPath(); c.rect(0, G.top, W, G.bot - G.top); c.clip();   // the plate
    try { fn(c); } finally { c.restore(); }                          // one bad frame must not leave the plate clipped
    // the ink dissolves before it reaches the clefs
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = fades.get(layer); c.fillRect(0, 0, G.fade1 + 1, H);
    c.globalCompositeOperation = "source-over";
  }
  // (the fade: wiped out at the clefs' edge, fading to nothing six spaces
  // on; one gradient a layer, made where the plate is laid out — a
  // gradient's ends are read in the layer's own space when it fills, so one
  // made once fills as one made every frame did)
  function fadeOf(layer) {
    var gr = layer.getContext("2d").createLinearGradient(G.fade0, 0, G.fade1, 0);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    return gr;
  }
  // With no meeting playing or held, the page repaints at about 12 fps, not
  // the display's rate; and so does a held one once its page stands still
  // (THE HELD PAGE, below).
  var IDLE_FRAME_MS = 80;
  // THE HELD PAGE. While the meeting is held (PAUSE) the staff stands: its
  // clock and its drying wait, and nothing is written while the audio clock
  // stands. The wheel may still be moving — a turn finishing, the arc
  // closing on the section's place, the pipes settling on the spectrum the
  // hold left them — so a held page is painted at the display's rate until
  // a frame finds the audio clock standing and the wheel drawn exactly as the
  // frame before (drawWheel says so: heldStill), and only then at the idle
  // rate, each frame drawing what the last drew. Whatever the page is told
  // wakes it at once (kick: a press, the console's report moving, a note or
  // an event, a resize, the labels or the tuning marks), so no change waits
  // on the idle rate.
  var idleTimer = null, idleHeld = false, heldStill = false;
  function kick() {
    heldStill = false;
    if (idleTimer && idleHeld) { clearTimeout(idleTimer); idleTimer = null; requestAnimationFrame(frame); }
  }
  function frame(ts) {
    if (!running) return;
    idleTimer = null;
    if (FRAME > 0 && ((!playing && !paused) || heldStill)) {
      idleHeld = !(!playing && !paused);
      idleTimer = setTimeout(function () { idleTimer = null; requestAnimationFrame(frame); }, IDLE_FRAME_MS);
    } else requestAnimationFrame(frame);
    if (!ctx2d || !G) return;
    var raw = lastFrame ? Math.max(0, (ts - lastFrame) / 1000) : 0.016;
    var dt = Math.min(0.1, raw);                     // for the wheel's easing
    lastFrame = ts;
    tickClock(raw);                                  // the page keeps the real time: after a hidden spell it shows the present
    FRAME++;
    // the ward's ink first, noting where the music has the middle of the gap
    var hasTape = tapes.length > 0;
    KO.length = 0;
    if (hasTape && tapeLive()) { var tH = 0.4 * G.sp; koY0 = G.tapeY - tH; koY1 = G.tapeY + tH; }
    paintLayer(inkLayer, drawPage);
    koY0 = 0; koY1 = -1;
    if (hasTape) paintLayer(tapeLayer, drawTapes);
    var hasBand = bandNotes.length > 0 || visits.length > 0;
    if (hasBand) paintLayer(bandLayer, drawBand);
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    if (staffLayer) ctx2d.drawImage(staffLayer, 0, 0);
    if (hasBand) ctx2d.drawImage(bandLayer, 0, 0);          // the guests' layer lies under the ward's ink
    if (hasTape) ctx2d.drawImage(tapeLayer, 0, 0);          // the telegraph's holes, under the ward's ink and never beneath a note
    ctx2d.drawImage(inkLayer, 0, 0);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wheelStill = XW > 120 ? drawWheel(dt) : true;   // the facade rides inside the wheel (once the band is laid out)
    heldStill = paused && !audioMoved && wheelStill;     // (THE HELD PAGE)
    if (freeze && freeze.frozen) running = false;  // (dev: painted at the moment asked; the page stands still — THE FRAME-EXACT CAPTURE)
  }

  // ---- lifecycle -------------------------------------------------------------
  function resize() {
    if (!canvas) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);   // DPR-3 phones get crisp rules (the budget allows it)
    var rect = canvas.getBoundingClientRect();
    W = Math.max(60, Math.round(rect.width));
    H = Math.max(60, Math.round(rect.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx2d = canvas.getContext("2d");
    G = pageGeom();
    function layer() { var l = document.createElement("canvas"); l.width = W * dpr; l.height = H * dpr; return l; }
    // the static staff layer (staves, brace, clefs), and the two ink layers
    // the page is re-engraved on each frame — the ward's, and the band's
    staffLayer = layer();
    var sctx = staffLayer.getContext("2d");
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStaffLayer(sctx);
    inkLayer = layer(); bandLayer = layer(); tapeLayer = layer();
    fades = new Map([[inkLayer, fadeOf(inkLayer)], [bandLayer, fadeOf(bandLayer)], [tapeLayer, fadeOf(tapeLayer)]]);
    proofLayer = layer(); proofC = proofLayer.getContext("2d");   // (the proof sheet each note is struck on, whole: impress)
    if (wheel) {
      var xr = wheel.getBoundingClientRect();
      XW = Math.max(60, Math.round(xr.width));
      XH = Math.max(60, Math.round(xr.height));
      wheel.width = XW * dpr; wheel.height = XH * dpr;
      xctx = wheel.getContext("2d");
      xctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (freeze && freeze.frozen) { running = true; frame(lastFrame); }   // (dev: a held page laid out again is painted again at its moment — THE FRAME-EXACT CAPTURE)
    else kick();                                   // (THE HELD PAGE: a page laid out again is painted at once)
  }

  function init(mainCanvas, wheelCanvas) {
    canvas = mainCanvas || null;
    wheel = wheelCanvas || null;
    if (!canvas && !wheel) return;
    resize();
    window.addEventListener("resize", resize);
    // the plates may be laid out after init (the stylesheet still loading):
    // re-measure whenever either canvas changes size
    if (typeof ResizeObserver === "function") {
      var armed = false, ro = new ResizeObserver(function () {
        if (armed) return; armed = true;
        requestAnimationFrame(function () {
          armed = false;
          var r1 = canvas ? canvas.getBoundingClientRect() : null, r2 = wheel ? wheel.getBoundingClientRect() : null;
          if ((r1 && (Math.round(r1.width) !== W || Math.round(r1.height) !== H)) ||
              (r2 && (Math.round(r2.width) !== XW || Math.round(r2.height) !== XH))) resize();
        });
      });
      if (canvas) ro.observe(canvas);
      if (wheel) ro.observe(wheel);
    }
    if (K) {
      if (K.setNoteListener) K.setNoteListener(function (n) { kick(); return onNote(n); });       // (THE HELD PAGE: told, it wakes)
      if (K.setEventListener) K.setEventListener(function (ev) { kick(); return onEvent(ev); });
    }
    var fz = /[?&]kolobFreeze=([0-9.]+)/.exec(window.location ? window.location.search : "");
    if (fz) freezeAt(+fz[1]);                      // (dev: THE FRAME-EXACT CAPTURE)
    running = true;
    requestAnimationFrame(frame);
  }
  function setConductor(c, isPlaying, isPaused) {
    // (THE HELD PAGE: a press, or the report moving, wakes a held page at once)
    if (!!isPlaying !== playing || !!isPaused !== paused || (c && (c.section !== cond.section || c.sectionIndex !== cond.sectionIndex || c.local !== cond.local || c.plan !== cond.plan))) kick();
    if (c) cond = c;
    var was = playing;
    playing = !!isPlaying;
    paused = !!isPaused;
    // stopped: nothing more is struck (the "■" event usually got here first,
    // with the exact time; this catches a stop that came without it)
    if (was && !playing) silence(audioNow());
  }

  // Johnston's tuning marks on or off (the owner's call; TUNING_MARKS above):
  // from the next frame the page draws them or not (the room the page kept
  // before a marked head stays as it was set)
  function setTuningMarks(on) { TUNING_MARKS = !!on; kick(); }

  // (for the silent checks: what is on the page now — never used by the app)
  // (a dev's view of the page; probe("ink") adds each drawn note's ink and
  // each placed bar's, in page px, for the bars-touch-no-ink check)
  function probe(what) {
    if (what === "ink") return probeInk();
    if (what === "freeze") return { at: freeze ? freeze.at : null, frozen: !!(freeze && freeze.frozen), PT: PT, downbeat: downbeat, held: freeze ? freeze.later.length : 0, plate: G ? [G.top, G.bot] : null };
    return {
      PT: PT, sp: G ? G.sp : null, xE: G ? G.xE : null, beams: beamTally,
      groups: groups.map(function (gr) { return { layer: gr.layer, tp: gr.tp, st: gr.st, dir: gr.dir, x: gr.drawnAt === FRAME ? gr.lastX : null, voice: gr.voice || null, beam: gr.beam ? gr.beam.members.indexOf(gr) : null, heads: gr.heads.map(function (h) { return h.q + (h.heavy ? "H" : "") + (h.ghost ? "G" : "") + (h.acc || "") + (h.jm ? "j" : "") + (h.orn ? "o" : ""); }).join(","), flags: gr.flags, alone: gr.alone ? !!gr.aloneOk : null, dx: gr.col ? gr.col.dx : null, barIn: gr.barIn ? gr.barIn.tp : null }; }),
      marks: marks.map(function (m) { return { kind: m.kind, type: m.type || null, tp: m.tp, x: X(m.tp) + (m.rel != null && G && m.relSp === G.sp ? m.rel : (m.off || 0) * (G ? G.sp : 0)), st: m.st || (m.sts || []).join(""), v: m.v, voice: m.voice, push: m.push ? m.push.dx : null, rel: m.at ? m.at.rel : null, nx: m.nx ? m.nx.length : null }; }),
    };
  }

  function probeInk() {
    var g = G, out = { sp: g ? g.sp : null, T: g ? g.T : null, B: g ? g.B : null, notes: [], bars: [] };
    if (!g) return out;
    groups.forEach(function (gr) {
      if (gr.drawnAt !== FRAME) return;
      var bx = gr.noCol ? (gr.inkBx && gr.inkBx.boxes) : (gr.col && gr.col.ink);
      // (each box: its ink in page px, whether it is a head, and what it is —
      // "h" a head, "l" a ledger, "s" a stem, "g" a sign, "" a flag or a dot)
      if (bx) out.notes.push({ layer: gr.layer, st: gr.st, tp: gr.tp, a: gr.lastA, guest: gr.cap != null, hymn: !!gr.hymn,
        boxes: bx.map(function (b) { return [b[0] + gr.lastX, b[1], b[2] + gr.lastX, b[3], b[5] ? 1 : 0, b[5] ? "h" : b[4] ? "l" : b[7] ? "s" : b[6] ? "g" : ""]; }) });
    });
    // (each drawn beam, as drawBeam lays it, in slices a quarter space wide:
    // its members' own heads lie at their stems' other ends)
    out.beams = [];
    var seenB = [];
    groups.forEach(function (gr) {
      var bm = gr.beam;
      if (!bm || gr.drawnAt !== FRAME || seenB.indexOf(bm) >= 0 || !bm.geo || bm.members.length < 2) return;
      seenB.push(bm);
      var s = g.sp, sw = Math.max(1.4 / dpr, 0.12 * s), yAt = beamYAt(bm, bm.geo), dir = bm.geo.dir, xs = [];
      bm.members.forEach(function (m) { if (m.drawnAt === FRAME) xs.push(m.lastSx); });
      if (xs.length < 1) return;
      var two = bm.members.some(function (m) { return (m.flags || 1) >= 2; }), ext = (two ? 1.25 : 0.5) * s * dir;
      // (from its first stem to its last, as drawBeam lays
      // it — a beam whose notes print out of order draws nothing, and says so)
      var xa = xs[0] - sw / 2, xb = xs[xs.length - 1] + sw / 2, segs = [];
      for (var x = xa; x < xb - 0.01; x += 0.25 * s) {
        var x2 = Math.min(xb, x + 0.25 * s), y1 = Math.min(yAt(x), yAt(x2)), y2 = Math.max(yAt(x), yAt(x2));
        segs.push([x, y1 + Math.min(0, ext), x2, y2 + Math.max(0, ext)]);
      }
      out.beams.push({ layer: gr.layer, st: gr.st, tps: bm.members.map(function (m) { return m.tp; }), a: gr.lastA, guest: gr.cap != null, segs: segs, rev: xb <= xa });
    });
    // (each drawn slur and tie, as tieShape lays it, in
    // slices a twenty-fourth of its span wide, each the crescent's full depth)
    out.slurs = [];
    marks.forEach(function (m) {
      if ((m.kind !== "slur" && m.kind !== "tie") || m.tp > PT || dryA(m) < 0.02) return;
      var sh = tieShape(g, m);
      if (!sh) return;
      var dx = sh.x2 - sh.x1, segs = [], pv = null;
      for (var i = 0; i <= 24; i++) {
        var t = i / 24, u = 1 - t, c3 = 3 * t * u, x = sh.x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t);
        var yl = sh.y1 * u * u * (1 + 2 * t) + sh.y2 * t * t * (3 - 2 * t), ya = yl + sh.h * c3, yb = yl + (sh.h - sh.th) * c3;
        if (pv && x <= g.xE) segs.push([pv[0], Math.min(pv[1], pv[2], ya, yb), x, Math.max(pv[1], pv[2], ya, yb)]);
        pv = [x, ya, yb];
      }
      out.slurs.push({ kind: m.kind, st: m.st, tp: m.tp, tp2: m.tp2, q1: m.q1, side: sh.side, segs: segs });   // (its head and side — two voices' ties may start together)
    });
    marks.forEach(function (m) {
      if (m.kind !== "bar" || !(m.at && m.at.sp === g.sp) || m.tp > PT) return;
      var bi = barInk(m, g), xb = X(m.tp) + m.at.rel;
      out.bars.push({ tp: m.tp, type: m.type, sts: m.sts, x0: xb - bi.wl, x1: xb + bi.wr });
    });
    return out;
  }

  // ==========================================================================
  // LENT — what this file shares with the rest of the page (KOLOB._viz)
  // ==========================================================================
  Object.defineProperty(VS, "xctx", { enumerable: true, configurable: true, get: function () { return xctx; } });
  Object.defineProperty(VS, "XW", { enumerable: true, configurable: true, get: function () { return XW; } });
  Object.defineProperty(VS, "XH", { enumerable: true, configurable: true, get: function () { return XH; } });
  Object.defineProperty(VS, "dpr", { enumerable: true, configurable: true, get: function () { return dpr; } });
  Object.defineProperty(VS, "cond", { enumerable: true, configurable: true, get: function () { return cond; } });
  Object.defineProperty(VS, "playing", { enumerable: true, configurable: true, get: function () { return playing; } });
  VS.audioNow = audioNow;
  Object.defineProperty(VS, "freeze", { enumerable: true, configurable: true, get: function () { return freeze; } });
  VS.holdsBack = holdsBack;
  Object.defineProperty(VS, "TUNING_MARKS", { enumerable: true, configurable: true, get: function () { return TUNING_MARKS; } });

  return { init: init, setConductor: setConductor, setWheelLabels: function (display, spoken) { setWheelLabels(display, spoken); kick(); }, wheelSeatAt: wheelSeatAt, setTuningMarks: setTuningMarks, probe: probe, freezeAt: freezeAt };
})();

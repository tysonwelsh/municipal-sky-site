// ============================================================================
// KOLOB — shelved/kolob-question-setpiece.js: THE UNANSWERED QUESTION's set
// piece and its place on the staff, as they stood in the live tree until
// 2026-10-01. REFERENCE ONLY: nothing lists this file (_engine.php does not;
// ESLint ignores it) and it is not a loadable room — the pieces below are
// copied out of kolob-guests.js, kolob-meeting.js, kolob-viz.js and
// kolob-score.js with their comments, so whoever unshelves the Question has
// the whole of it in one place. The generator (the bank of seven questions)
// is shelved/kolob-question.js; its lab is question-lab.php.
//
// The owner shelved the Question on 2026-09-27 ("one of the less interesting
// guests… there's better stuff we could be focusing on") and on 2026-10-01
// asked for its dead code to leave the live tree. kolob-meeting.js still
// throws its two dice (qDie, qSeatDie, on meeting:<n>) so every later draw
// lands where it did; tools/lib/dump.js still reads its events out of old
// dumps.
//
// To unshelve: the set piece goes back into kolob-guests.js (lent as
// S.unansweredQuestion and exported on KOLOB.Guests); kolob-meeting.js gets
// the seating block back at the guests' dice (qDie and qSeatDie read again,
// the switch offering "question"), inQuestion and its lend, and
// VISIT_FN.question; kolob-voices-winds.js and kolob-voices-choir.js sit
// their free cycles out while inQuestion(); kolob-score.js EVENTS takes the
// two rows back; kolob-viz.js takes the intake (onEvent, flushIntake), the
// askings' fold (takeLayer's askMax), the harmonium's slashed grace notes
// (grp.slash, groupBoxes, drawGroup, inkOpts), takeQuestion, takeUnanswered,
// drawQuestions, text(), FG and the dotted barline back. Then the two notes
// in the set piece's header (the askings told untagged; the second rank's
// pure fifth).
// ============================================================================

// ---- kolob-guests.js: the set piece (after the IVES VISITATIONS header) --------
  // ==========================================================================
  // IVES VISITATIONS — rare guests, drawn at planMeeting on independent dice.
  //
  // THE UNANSWERED QUESTION (after Ives, 1908) — SHELVED (the owner,
  // 2026-09-27: "one of the less interesting guests"). The code is kept and
  // never runs on the live page: kolob-meeting.js throws its dice and seats
  // nothing, and its generator is shelved/kolob-question.js. As written: the
  // drone is the eternal ground and never changes; the clarinet asks ONE
  // fixed phrase over and over — it refuses the motif engine's development,
  // which is the point; the harmonium answers, each time faster, denser,
  // higher, more scattered. The last asking gets no answer. The air is
  // claimed, so the meeting holds back and the drone is left alone with it.
  // Whoever unshelves it: the answers are told as the guest's, but the
  // clarinet's askings are told inside renderClarinetLine, which takes no
  // tag — an unlogged Question must pass one there; and the second rank's
  // PURE fifth above an answer can fall outside the day's tuning (the
  // harness lists it as off the tuning) — take the collection's own fifth,
  // as the strings' pureFifth guard does, or rule that the argument may
  // leave it.
  // ==========================================================================
  function unansweredQuestion(V, tc) {
    var R = stream("guest:question");
    var t = tc + 0.5;
    var beat = R.rnd(0.8, 0.95);
    // the perennial question: rising, angular, ending high and unresolved
    // (a 9th above the root — a step past the octave, asking)
    var QDEGS = [[4, 1.3], [5, 0.9], [8, 1.0], [6, 0.8], [8, 2.8]];
    var qNotes = QDEGS.map(function (q) {
      return { f: degFreq(projDeg(q[0]) + colN()), dur: q[1] * beat };
    });
    var qdur = 0;
    for (var qq = 0; qq < qNotes.length; qq++) qdur += qNotes[qq].dur;
    var N = R.rint(4, 5);
    var cursor = t;
    for (var k = 0; k < N; k++) {
      renderClarinetLine(cursor, qNotes, 0.9, R);
      var afterQ = cursor + qdur;
      if (k < N - 1) {
        // the answer: more notes, quicker, higher, less patient each time
        var aAt = afterQ + R.rnd(1.2, 2.2);
        var count = 3 + k * 2;
        var abeat = 1.25 * Math.pow(0.75, k);
        var lift = k >= 2 ? colN() : 0;
        var adeg = 2, anotes = [];
        for (var an = 0; an < count; an++) {
          adeg += R.rint(-(1 + k), 1 + k) || 1;
          adeg = Math.max(0, Math.min(9 + k, adeg));
          anotes.push({ f: degFreq(projDeg(adeg) + colN() + lift), dur: Math.max(0.3, abeat * R.rnd(0.7, 1.2)) });
        }
        var adur = renderHarmonium(aAt, anotes, 0.5 + k * 0.12);
        S.reportLine("harmonium", aAt, anotes, guestNote(V, "question"));
        // from the third answer the answerers argue among themselves (a
        // pure fifth above each answer: see SHELVED, above)
        if (k >= 2) {
          var bnotes = anotes.map(function (n) { return { f: n.f * 1.5, dur: n.dur * R.rnd(0.8, 1) }; });
          renderHarmonium(aAt + abeat * 0.5, bnotes, 0.3 + k * 0.08);
          S.reportLine("harmonium", aAt + abeat * 0.5, bnotes, guestNote(V, "question", { part: "doubling" }));
        }
        cursor = aAt + adur + R.rnd(2.5, 4.5) * Math.pow(0.85, k);
      } else {
        cursor = afterQ;                       // the last asking hangs
      }
    }
    var tail = 10;                             // the drone alone — no answer comes
    var total = (cursor - t) + tail;
    claimAir(total - 4, 6);
    // (SCORE §6: one event for the askings — this question is the old one,
    // q:old — and one when the drone is left alone)
    tell(V, { type: "question-asking", k: 0, questionId: "q:old", askings: N, dur: total,
              cat: "visitation", label: "? the question", detail: "×" + N + " askings · " + Math.round(total) + "s" });
    cueAt("guests", tc + (cursor - t + 1.5), function () {
      tell(V, { type: "question-unanswered", cat: "visitation", label: "? unanswered", detail: "the drone alone" });
    });
    return total;
  }

// ---- kolob-meeting.js: at planMeeting, after the guests' dice ------------------
    // THE QUESTION IS SHELVED (owner, 2026-09-27: "one of the less interesting
    // guests… there's better stuff we could be focusing on"). Its code stays
    // in kolob-guests.js; it simply never seats. Its dice are still thrown
    // below, so every other draw of the meeting falls exactly where it did.
    // The forcing switch no longer offers it.
    var SHELVED_GUESTS = { question: true };

    // THE QUESTION is shelved (owner, 2026-09-27): SHELVED_GUESTS keeps it from
    // seating and the switch never names it, so this block seats nothing. qDie
    // and qSeatDie above are still thrown so every later draw lands where it
    // did. Its set piece is kolob-guests.js unansweredQuestion, its generator
    // shelved/kolob-question.js.
    if (forcedType === "question" || qDie) {
      var qSeat = (forcedType === "question" || qSeatDie)
        ? seatIn(["invocation", "testimony", "hymn"])
        : seatIn(["testimony", "interlude", "invocation"]);
      if (qSeat && !SHELVED_GUESTS.question) C.visitations.push({ type: "question", section: qSeat, fired: false });
    }

// ---- kolob-meeting.js: the sit-out, lent as S.inQuestion; and VISIT_FN's row ---
  // the question is a scored passage — its performers' free cycles sit out;
  // the bands are a COLLISION — nobody sits out, that is the piece
  function inQuestion() { return inVisit() && C.visitType === "question"; }
  // var VISIT_FN = { question: unansweredQuestion, bands: ... };

// ---- kolob-voices-winds.js and kolob-voices-choir.js: who sat out --------------
  // function inQuestion() { return S.inQuestion(); }
  // clarinetPhrase:  if (!speaks || inFuging() || inQuestion() || hallListens() || houseRests("clarinet")) ...
  // harmoniumCycle:  if (!plays || inQuestion() || hallListens() || houseRests("harmonium") || ...) ...
  // choirVerse (the hum): ... && !S.hallListens() && !inQuestion() && S.localArc() > 0.06 ...
  // choirVerse (a couplet): ... || inFuging() || inQuestion() || S.Meeting.jointing() || ...

// ---- kolob-score.js: the two EVENTS rows ---------------------------------------
  var EVENTS_ROWS = {
    "question-asking":     { k: "int", questionId: "str?" },
    "question-unanswered": {},
  };

// ---- kolob-viz.js: the intake --------------------------------------------------
  // var questions = [];                              // the question: askings, and the empty measure
  // var FG = '"EB Garamond", Georgia, serif';       // (the "?" is the one glyph on the staff that is text)
  // onEvent:      if (ev.type === "question-asking" || ev.type === "question-unanswered") queueIntake({ ev: ev });
  // flushIntake:  var byLayer = {}, question = null, unanswered = null, stopAt = null, i;
  //               if (it.ev.type === "question-asking") question = it.ev;
  //               else if (it.ev.type === "question-unanswered") unanswered = it.ev;
  //               takeLayer(layer, ns, beat, question);   (every other caller passed null)
  //               if (question) takeQuestion(byLayer.clarinet || [], question);
  //               if (unanswered) takeUnanswered(unanswered);

// ---- kolob-viz.js: silence(stopAt) — what the key's falling silent cuts --------
  function silenceQuestions(cut, end) {
    for (i = questions.length - 1; i >= 0; i--) {
      var qn = questions[i];
      qn.asks = qn.asks.filter(function (ak) { return ak.tp0 <= cut; });
      qn.asks.forEach(function (ak) { ak.tp1 = Math.min(ak.tp1, end); });
      if (qn.na) {
        if (qn.na.tp0 > cut) qn.na = null;
        else qn.na.tp1 = Math.min(qn.na.tp1, Math.max(cut, qn.na.tp0 + 1));
      }
      if (!qn.asks.length && !qn.na) questions.splice(i, 1);
    }
  }

// ---- kolob-viz.js: takeLayer(layer, ns, beat, question, opt) — the askings' fold and the answers' slash ---
    // the Question's askings (shelved: takeQuestion) fold together, if they must, so the phrase keeps its shape
    var askMax = null;
    if (question && layer === "clarinet") {
      askMax = -1e9;
      ns.forEach(function (n) { askMax = Math.max(askMax, noteQ(n.freq).q); });
    }
    // ... per group:
          if (layer === "harmonium" && question) {        // the Question's answers (shelved: takeQuestion): slashed grace notes
            grp.slash = true; grp.noStem = false; grp.flags = 1; grp.dir = 1;
            heads.forEach(function (h) { h.open = false; h.dots = 0; });
          }
          if (askMax != null) grp.askMax = askMax;
    // foldFor:  if (grp.askMax != null) hi = Math.max(hi, grp.askMax);
    // inkOpts:  slash: gr.slash,
    // groupBoxes:
    //   if (o.slash) out.push([L.sx - 0.75 * s, Math.min(L.yEnd + dn * 2.15 * s, L.yEnd + dn * 0.85 * s), L.sx + 0.85 * s, Math.max(L.yEnd + dn * 2.15 * s, L.yEnd + dn * 0.85 * s)]);
    // drawGroup (after the flags):
    //   if (o.slash) {
    //     c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = Math.max(1 / dpr, 0.1 * sp); c.lineCap = "round";
    //     c.beginPath(); c.moveTo(sx - 0.7 * s, yEnd + dir * 2.1 * s); c.lineTo(sx + 0.8 * s, yEnd + dir * 0.9 * s); c.stroke(); c.restore();
    //   }

// ---- kolob-viz.js: takeQuestion and takeUnanswered -----------------------------
  // ---- the Question (SHELVED) ----------------------------------------------------
  // SHELVED: the Question never seats on the live page (kolob-meeting.js
  // SHELVED_GUESTS); this intake and drawQuestions are kept with the
  // generator in shelved/ and run only if it is unshelved.
  // The clarinet's askings arrive in the same call that raises "? the
  // question": each unbroken run of its notes is one asking, framed in a
  // cartouche. The harmonium's answers (same call) print as grace notes.
  function takeQuestion(clar, ev) {
    var ns = clar.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var asks = [], cur = null;
    ns.forEach(function (n) {
      if (cur && n.startTime - cur.t1 < 0.08) { cur.t1 = n.startTime + n.duration; cur.n++; }
      else { cur = { t0: n.startTime, t1: n.startTime + n.duration, n: 1 }; asks.push(cur); }
    });
    asks = asks.filter(function (a) { return a.n >= 2; });
    var qn = { asks: asks.map(function (a) { return { tp0: a.t0, tp1: a.t1 }; }), na: null,
               lastEnd: asks.length ? asks[asks.length - 1].t1 : (ev.t || audioNow()) };
    questions.push(qn);
    if (questions.length > 4) questions.shift();
  }
  function takeUnanswered(ev) {
    var tp = ev.t || audioNow(), qn = questions[questions.length - 1];
    var start = qn && !qn.na && Math.abs(tp - qn.lastEnd) < 40 ? qn.lastEnd + 0.9 : tp - 0.6;
    if (!qn || qn.na) { qn = { asks: [], lastEnd: start }; questions.push(qn); }
    qn.na = { tp0: start, tp1: start + 6 };
  }

// ---- kolob-viz.js: text() — the one text on the staff --------------------------
  function text(c, str, x, y, font, rgb, a, align) {
    c.font = font; c.textAlign = align || "left"; c.textBaseline = "alphabetic";
    c.fillStyle = rgba(rgb, a == null ? 1 : a);
    c.fillText(str, x, y);
    return c.measureText(str).width;
  }

// ---- kolob-viz.js: drawBarline(c, g, x, kind, st) — the dotted kind ------------
  // function drawBarline(c, g, x, kind, st) {
  //   var sp = g.sp, top = st === "T" ? g.T : g.B, bot = top + 4 * sp;
  //   if (kind === "dotted") {
  //     for (var q = 0; q < 4; q++) {
  //       var yy = top + (q + 0.5) * sp;
  //       c.beginPath(); c.arc(x, yy - 0.18 * sp, 0.11 * sp, 0, Math.PI * 2); c.arc(x, yy + 0.2 * sp, 0.11 * sp, 0, Math.PI * 2); c.fill();
  //     }
  //     return;
  //   }

// ---- kolob-viz.js: drawQuestions(c), called from the paint after drawMarks -----
  // the Question (shelved: takeQuestion): each asking in a slender double-ruled cartouche with its
  // "?" at the head, in the one green ink; then, after the last, an empty
  // measure between dotted barlines — the answer that does not come
  function drawQuestions(c) {
    var g = G, sp = g.sp;
    for (var qi = questions.length - 1; qi >= 0; qi--) {
      var qn = questions[qi], alive = false;
      qn.asks.forEach(function (ak) {
        if (ak.tp0 > PT) { alive = true; return; }
        var x0 = X(ak.tp0) - 3.0 * sp, x1 = X(ak.tp1) + 0.6 * sp;
        if (x1 > -2 * sp) alive = true; else return;
        var y0 = g.T - 2.55 * sp, y1 = g.Tb + 1.25 * sp, r = 1.15 * sp;
        c.save();
        c.beginPath(); c.rect(0, 0, g.xE + 0.5 * sp, H); c.clip();          // pulled by the burin only as far as the engraving point
        c.globalAlpha = dryA(ak);
        c.strokeStyle = rgba(C_INK); c.lineWidth = Math.max(1.1 / dpr, 0.13 * sp);
        c.beginPath(); rrect(c, x0, y0, x1 - x0, y1 - y0, r); c.stroke();
        c.lineWidth = Math.max(0.8 / dpr, 0.05 * sp); c.strokeStyle = rgba(C_INK, 0.7);
        c.beginPath(); rrect(c, x0 + 0.28 * sp, y0 + 0.28 * sp, x1 - x0 - 0.56 * sp, y1 - y0 - 0.56 * sp, r - 0.28 * sp); c.stroke();
        c.lineWidth = Math.max(1.1 / dpr, 0.13 * sp); c.strokeStyle = rgba(C_INK);
        c.beginPath(); c.moveTo(x1 + 0.35 * sp, y0 + 0.9 * sp); c.lineTo(x1 + 0.35 * sp, y1 - 0.9 * sp); c.stroke();
        text(c, "?", x0 + 1.2 * sp, g.yT(16) + 0.95 * sp, "italic 500 " + (2.7 * sp).toFixed(1) + "px " + FG, C_INK, 1, "center");
        c.restore();
      });
      if (qn.na) {
        var na = qn.na;
        if (na.tp0 <= PT) {
          var xa = X(na.tp0), xb = X(na.tp1);
          if (xb > -2 * sp) alive = true;
          c.globalAlpha = dryA(na); c.fillStyle = rgba(C_INK);
          if (xa > -sp) { drawBarline(c, g, xa, "dotted", "T"); drawBarline(c, g, xa, "dotted", "B"); }
          if (na.tp1 <= PT && xb > -sp) { drawBarline(c, g, xb, "dotted", "T"); drawBarline(c, g, xb, "dotted", "B"); }
          c.globalAlpha = 1;
        } else alive = true;
      }
      if (!alive && !qn.asks.some(function (ak) { return ak.tp0 > PT; })) questions.splice(qi, 1);
    }
  }

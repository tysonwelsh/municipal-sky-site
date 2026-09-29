// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — VARIATIONS ON A HYMN (KOLOB.GuestVariations)
//
// In the old Tabernacle on Temple Square the organist played a recital at
// noon, and the visitors came in off the street to hear the great organ
// show what it could do. In Brewster, New York, on the Fourth of July 1892,
// a seventeen-year-old organist named Charles Ives played his Variations on
// "America": the tune plainly, then a variation that runs, a polonaise in
// the minor, a march — and between them two interludes in which the tune is
// played in two keys at once, a joke his father had taught him, which his
// father would not let him play in church. (PLAN-COMPOSITION §8.5.)
//
// At the rim of Kolob's light the Sunday's organist does it now and then
// with one of the meeting's own hymns: before the meeting, in the organist's
// own time — the prelude, on the day's first hymn, which the ward will then
// sing — or after it, in the postlude, while the ward stands and talks and
// goes out, on a hymn the ward has just sung (most often the doxology's).
// Three to five characters, each the organist's own: the plain organist
// gives a short set, straight-faced; the Victorian a long one, on the vox
// humana and the trumpet, to the full organ and the amen; the improviser
// always plays the tune in two keys at once. The music is the organist's
// (kolob-organist.js, Organist.variations — pure planning, every character
// described there). This room is the guest: the seat, the odds, the
// material made ready, and the performance laid out on the clock.
//
// ONE ORGAN. In the meeting the set is the organist's, played on the organ
// the organist plays everything on: perform() hands the plan to the
// engine's organist desk when the engine passes it (hooks.organist — kolob-
// voices-organ.js organistPlays: one case, the organ layer, its notes told
// in the Score's terms). A lab passes nothing, and the room builds a pipe
// organ of its own (KOLOB.VoicesOrgan) into the destination it is given,
// and lays the plan on it a slice at a time.
//
// THE SEAT. About one meeting in ten, weighted to General Conference and a
// dedication (PLAN §8.13: "Conference: variations"), to Pioneer Day (Ives's
// was a Fourth of July), and to the feasts; rarely on a fast Sunday; never
// at a funeral (the organist does not show off at a funeral). The
// improviser plays it most, the plain organist least. The prelude or the
// postlude only — never beside another guest (§8.13: a seat is free only
// when neither it nor the section beside it holds one), never on a morning
// the tune is withheld, never on a hymn sung in unison (a lined Old Way
// tune, a Shaker song: the organist's variations need the Score's harmony).
// Every die is thrown before any refusal.
//
// PURE PLANNING. plan(), decide(), prepare() and score() touch no
// AudioContext, DOM, clock or Math.random; every die comes from the stream
// passed in (guest:variations:<n>), on forks: "seat" (the odds, the seat,
// the moment, the hymn), "shape" (the set: the organist's characters, their
// order, their lines, keys and lags — Organist.variations draws from it),
// "organist" (an organist of the style asked for, when a lab seats none)
// and "synth" (the organ built for a lab: sound-level, never reported).
//
// Public surface: window.KOLOB.GuestVariations
//   plan(meetingInfo, stream) → { guest, seat, section, at, dur, holdUntil,
//        hymnId, style, characters?, estimated, odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type, dur}], guests:
//       [{type, section}], hymns: [{id, section, dialect, piece}] (the
//       hymnal's rows, in order), organist: {style} | null, withheld,
//       material? (prepare()'s), force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the set, ready to play (pure; itself
//     material): material = { hymn, organist?, style?, keynoteHz, seat?,
//     characters?, count? }
//   score(material, stream, t0) → { end, stages, plan }
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { organist(plan, t0) (the engine's desk: one organ), organ (a
//              VoicesOrgan, or anything with play and setSwell), defer(at,
//              fn), onNote({layer, freq, t, dur, part, monzo, line, beat,
//              deg, orn, pedal, pedalOnly, variation}), onStage({stage, t0,
//              t1, label}), onEvent(e) (the organist's doings) }
//   ODDS, SEATS, HARMONIZED, NAME, LABEL, ACTIONS, ACTION_DS, harmonized(h)
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestVariations = (function () {
  "use strict";

  var NAME = "variations";
  var LABEL = "guest:variations:";               // + the meeting number

  // ==========================================================================
  // THE ODDS — about one meeting in ten, for the owner's ear
  // ==========================================================================
  // p = base × weight[sunday or kind] × style[the organist's], capped. The
  // base is conditional: it is refused when neither the prelude nor the
  // postlude is free, when the hymn it would play is sung in unison, and at
  // a funeral. guests3b-lab's odds card runs plan() over a stand-in of the
  // engine's planner (its Sundays, organists and the other guests' own dice
  // and seats) and finds the share of meetings it seats.
  var ODDS = {
    base: 0.13,
    weight: {
      ordinary: 1, fast: 0.35, conference: 1.8, jubilee: 1.3,
      // the calendar's Sundays (PLAN §7.1), when the engine names them
      pioneer: 1.7, christmas: 1.2, easter: 1.3, wedding: 1.1, funeral: 0, dedication: 1.8,
    },
    style: { plain: 0.55, victorian: 1.1, improviser: 1.4 },
    cap: 0.6,
  };
  var SEATS = ["prelude", "postlude"];
  var SEAT_W = { prelude: 0.45, postlude: 0.55 };
  var AT = { prelude: [3, 9], postlude: [2, 6] };     // s into the section
  // the dialects the organist can vary: a Score in parts (the unison
  // dialects — the Old Way's lined tune, the Shakers' song — are refused)
  var HARMONIZED = { tabernacle: true, sacredharp: true, psalmody: true, gospel: true };
  // a hymnal row it will not take: a round, a statement of the refrain
  var NOT_A_HYMN = { round: true, refrain: true, refrainIn: true };
  var EST = { plain: 118, victorian: 132, improviser: 136 };   // s: a set's length before it is written

  // THE ORGANIST'S NEW DOINGS (kolob-organist.js says them; the ward's
  // Deseret for the minutes — kolob-cast.js ACTION_DS takes these at
  // integration, spelled as its own are)
  var ACTIONS = [
    ["plays variations on the hymn", "p-l-ay-z v-e-r-ee-ay-sh-u-n-z o-n dh-u h-i-m"],
    ["plays the hymn as a plain chorale", "p-l-ay-z dh-u h-i-m a-z u p-l-ay-n k-u-r-a-l"],
    ["turns the tune into a minuet", "t-u-r-n-z dh-u t-oo-n i-n-t-oo u m-i-n-y-oo-e-t"],
    ["turns the tune into a polonaise", "t-u-r-n-z dh-u t-oo-n i-n-t-oo u p-o-l-u-n-ay-z"],
    ["turns the tune into a march", "t-u-r-n-z dh-u t-oo-n i-n-t-oo u m-ah-r-ch"],
    ["sets the tune in canon", "s-e-t-s dh-u t-oo-n i-n k-a-n-u-n"],
    ["plays the tune in two keys at once", "p-l-ay-z dh-u t-oo-n i-n t-oo k-ee-z a-t w-u-n-s"],
    ["gives the hymn on the full organ", "g-i-v-z dh-u h-i-m o-n dh-u f-uu-l aw-r-g-u-n"],
    ["closes with the amen", "k-l-oh-z-i-z w-i-dh dh-ee ah-m-e-n"],
  ];
  var DS_CODES = ["ee", "ay", "ah", "aw", "oh", "oo", "i", "e", "a", "o", "u", "uu", "ie", "ow", "w", "y",
    "h", "p", "b", "t", "d", "ch", "j", "k", "g", "f", "v", "th", "dh", "s", "z", "sh", "zh", "r", "l", "m", "n", "ng", "oi", "ew"];
  function deseretCaps(spelling) {
    return spelling.split(" ").map(function (w) {
      return w.split("-").map(function (ph) {
        var at = DS_CODES.indexOf(ph);
        if (at < 0) throw new Error("KOLOB.GuestVariations: no Deseret letter for '" + ph + "'");
        return String.fromCodePoint(0x10400 + at);
      }).join("");
    }).join(" ");
  }
  var ACTION_DS = {};
  ACTIONS.forEach(function (a) { ACTION_DS[a[0]] = deseretCaps(a[1]); });

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestVariations: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function Org() {
    var O = window.KOLOB.Organist;
    if (!O || !O.variations) throw new Error("KOLOB.GuestVariations: load kolob-organist.js (with its variations) first");
    return O;
  }
  function oddsFor(info) {
    var w = ODDS.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    var st = info.organist && ODDS.style[info.organist.style] != null ? ODDS.style[info.organist.style] : 1;
    // (round 3c: a meeting hands the Sunday's odds in, info.odds, from the
    // calendar's one table — KOLOB.Calendar.GUEST_ODDS; the organist's own
    // lean, ODDS.style, stays on top of it)
    if (info.odds != null) return Math.max(0, Math.min(1, +info.odds * st));
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1) * st);
  }
  // a Score in three or four parts
  function harmonized(h) {
    if (!h || !h.lines || !h.lines.length) return false;
    var L = h.lines[0], n = 0;
    ["S", "A", "T", "B"].forEach(function (p) { if (L.notes[p] && L.notes[p].length) n++; });
    return n >= 3;
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), seatU = rs.next(), atU = rs.next(), hymnU = rs.next();       // every die, first
    var p = oddsFor(info), why = null;
    var secs = info.sections || [], guests = info.guests || [];
    var order = secs.map(function (s) { return s && s.type; });
    var held = {};
    guests.forEach(function (g) { if (g && g.section && g.type !== NAME) held[g.section] = true; });
    // a section, or one beside it, holds a guest (PLAN §8.13)
    function crowded(type) {
      if (held[type]) return true;
      for (var i = 0; i < order.length; i++) {
        if (order[i] !== type) continue;
        if ((i > 0 && held[order[i - 1]]) || (i + 1 < order.length && held[order[i + 1]])) return true;
      }
      return false;
    }
    // the hymns it may play: the hymnal's rows in parts (not a round, not a
    // statement of the refrain) — the prelude only the day's first hymn
    var rows = info.hymns || [];
    var playable = rows.filter(function (r) { return r && HARMONIZED[r.dialect] && !NOT_A_HYMN[r.piece]; });
    var firstOk = rows.length && playable.indexOf(rows[0]) >= 0;
    var free = SEATS.filter(function (s) {
      if (order.indexOf(s) < 0 || crowded(s)) return false;
      if (s === "prelude") return firstOk && !info.withheld && !info.organSits;
      return playable.length > 0;
    });
    var funeral = info.sunday === "funeral" || info.kind === "funeral";
    if (funeral) why = "the organist gives no recital at a funeral";
    else if (!rows.length) why = "no hymnal to play from";
    else if (!playable.length) why = "every hymn today is sung in unison";
    else if (!free.length) why = "no seat free (" + SEATS.filter(function (s) { return order.indexOf(s) >= 0; }).map(function (s) {
      return s + (held[s] ? " taken" : crowded(s) ? " beside a guest" : s === "prelude" ? (info.withheld ? " — the tune withheld" : " — the first hymn in unison") : "");
    }).join(", ") + ")";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var tot = 0; free.forEach(function (s) { tot += SEAT_W[s]; });
    var u = seatU * tot, seat = free[free.length - 1];
    for (var i = 0; i < free.length; i++) { u -= SEAT_W[free[i]]; if (u <= 0) { seat = free[i]; break; } }
    var at = AT[seat][0] + (AT[seat][1] - AT[seat][0]) * atU;
    // the hymn: the day's first in the prelude; in the postlude one the ward
    // has sung, the doxology's (or the last) twice as likely as each other
    var row = rows[0];
    if (seat === "postlude") {
      var w = playable.map(function (r) { return r.section === "doxology" || r === playable[playable.length - 1] ? 2 : 1; }), wt = 0;
      w.forEach(function (x) { wt += x; });
      var hu = hymnU * wt; row = playable[playable.length - 1];
      for (var j = 0; j < playable.length; j++) { hu -= w[j]; if (hu <= 0) { row = playable[j]; break; } }
    }
    var mat = info.material && info.material.prepared ? info.material : null;
    var style = mat ? mat.style : info.organist && info.organist.style || null;
    var dur = mat ? mat.dur : EST[style] || 130;
    return {
      seat: {
        guest: NAME, seat: seat, section: seat, at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 3).toFixed(2),       // the section should last at least this long
        hymnId: mat ? mat.hymnId : row.id, style: style, characters: mat ? mat.characters.slice() : null,
        estimated: !mat, odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // THE SET, MADE READY — the organist's variations on the hymn (pure)
  // ==========================================================================
  function prepare(material, stream) {
    material = material || {};
    if (material.prepared) return material;
    var O = Org(), h = material.hymn;
    if (!harmonized(h)) throw new Error("KOLOB.GuestVariations: the variations need a hymn in parts (" + (h ? h.dialect : "no hymn") + ")");
    var org = material.organist && material.organist.style && material.organist.habits ? material.organist
            : O.seat(need(stream).fork("organist"), { style: material.style || (material.organist && material.organist.style) || null });
    var plan = O.variations(org, h, need(stream).fork("shape"), { characters: material.characters || null, count: material.count || null, lo: material.lo, hi: material.hi });
    return {
      prepared: true, plan: plan, hymnId: h.id || null, keyMonzo: h.keyMonzo, mode: h.mode, dialect: h.dialect,
      style: org.style, organist: { style: org.style, nameDs: org.nameDs, nameEn: org.nameEn },
      keynoteHz: material.keynoteHz || 261.63, seat: material.seat || null,
      characters: plan.characters.slice(), dur: plan.dur,
    };
  }
  // the stages, as the page and the lab tell them: each character's start
  function score(material, stream, t0) {
    var mat = prepare(material, stream), plan = mat.plan;
    t0 = t0 || 0;
    return {
      end: t0 + plan.dur, plan: plan,
      stages: plan.variations.map(function (v) { return { stage: v.id, t0: t0 + v.t, t1: t0 + v.end, label: v.name + ": " + v.en, keys: v.keys, regs: v.regs }; }),
    };
  }
  function varAt(plan, t0, t) {
    var id = null;
    plan.variations.forEach(function (v) { if (t0 + v.t <= t + 1e-6) id = v.id; });
    return id;
  }

  // ==========================================================================
  // THE PERFORMANCE — on the engine's organ (hooks.organist), or on one of
  // its own, laid out a slice at a time ahead of the music (hooks.defer):
  // the keys that begin within each SLICE seconds are laid AHEAD seconds
  // before the slice begins, each slice in a tick of the clock of its own
  // ==========================================================================
  var AHEAD = 2.5, SLICE = 1.0;
  function perform(ctx, dest, t, material, stream, hooks) {
    hooks = hooks || {};
    var O = Org(), mat = prepare(material, stream), plan = mat.plan, sc = score(mat, stream, t);
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    // in the meeting: the Sunday's organist's own desk, one organ throughout
    if (hooks.organist) { hooks.organist(plan, t); perform.last = { plan: plan }; return sc.end; }
    var VO = window.KOLOB.VoicesOrgan;
    if (!hooks.organ && (!VO || !VO.create)) throw new Error("KOLOB.GuestVariations: load kolob-voices-pipeorgan.js first");
    var own = !hooks.organ;
    var organ = hooks.organ || VO.create(ctx, dest, { gain: O.ORGAN_GAIN, rand: need(stream).fork("synth").fork("organ"), t0: Math.max(0, t - 0.05) });
    var perf = O.perform(organ, plan, t, {
      keynoteHz: mat.keynoteHz, hymnId: mat.hymnId,
      onNote: hooks.onNote ? function (layer, f, st, dur, x) {
        hooks.onNote({ layer: layer, freq: f, t: st, dur: dur, part: x.part, monzo: x.monzo, line: x.line, beat: x.beat, deg: x.deg, orn: x.orn || null,
                       pedal: !!x.pedal, pedalOnly: !!x.pedalOnly, variation: varAt(plan, t, st) });
      } : null,
      onEvent: hooks.onEvent || null,
    });
    if (hooks.defer) {
      for (var k = 0; k * SLICE < plan.dur + SLICE; k++) {
        (function (kk) {
          var when = t + kk * SLICE - AHEAD, lay = function () { perf.pump(when, AHEAD + SLICE); };
          if (when > t + 0.05) hooks.defer(when, lay); else lay();
        })(k);
      }
    } else perf.pump(t, 1e9);
    if (own && organ.dispose) organ.dispose(sc.end + 1.5);
    perform.last = { organ: organ, plan: plan, perf: perf };
    return sc.end;
  }

  return {
    NAME: NAME, LABEL: LABEL, ODDS: ODDS, SEATS: SEATS, SEAT_W: SEAT_W, HARMONIZED: HARMONIZED, EST: EST,
    ACTIONS: ACTIONS, ACTION_DS: ACTION_DS,
    plan: plan, decide: decide, prepare: prepare, score: score, perform: perform, harmonized: harmonized,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-variations.js"] = true;   // the load guard's roll call

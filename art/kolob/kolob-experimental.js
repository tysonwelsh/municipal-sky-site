// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE EXPERIMENTS (KOLOB.Experimental)
//
// Some of what the colony does on a Sunday is new enough that the owner may
// want to switch it off later (PLAN-COMPOSITION §15.3: "a more experimental
// feature, so let's flag it in case I want to make playthroughs like this
// disabled later if it is too much of a mess"). Every such feature is named
// here, once, with a line saying what it is. The engine asks this registry
// before it seats one; a feature switched off is simply never seated, and
// nothing else about the meeting moves (its dice are thrown all the same —
// SCORE.md §3: a refusal never shifts another draw).
//
// THE FEATURES, and whether each is on by default:
//
//   singingSchool   ON   — the singing school: on about one Sunday in ten you
//                          arrive while the choir is still practising the
//                          day's first hymn. One part goes wrong, the
//                          chorister stops them, that part sings the passage
//                          alone on the notes, and everyone sings it again.
//                          (kolob-guest-singingschool.js)
//
//   reckoning       ON   — the Kolob reckoning: the drone moves one note a
//                          section, spelling the doxology's opening, and
//                          glides to the next only under a joint's hush; the
//                          doxology then sings that tune. Off: the drone on
//                          the day's keynote all meeting, as before — and
//                          the same doxology, the same keys, the same meeting
//                          otherwise, so the A/B is the drone alone (PLAN
//                          §7.2's fallback: the cantus only for the key
//                          plan, no audible glide) (kolob-calendar.js,
//                          kolob-hymnal.js, kolob-voices-ground.js)
//
// HOW TO SWITCH ONE (dev only; nothing on the page shows these):
//
//   · in the address:  ?exp=-singingSchool         switch it off for this visit
//                      ?exp=+singingSchool         switch it on
//                      ?exp=none   ·   ?exp=all    every feature off / on
//                      (a comma list works: ?exp=-singingSchool,+other)
//   · in the console:  KOLOB.Experimental.off("singingSchool")
//                      KOLOB.Experimental.on("singingSchool")
//                      KOLOB.Experimental.set("singingSchool", false)
//                      KOLOB.Experimental.reset()    back to the defaults
//                      KOLOB.Experimental.list()     a table of every feature
//     The console switch is remembered by this browser (localStorage) until
//     reset(); the address wins over it for the visit it names.
//
// For the owner, the switch that matters is the DEFAULT column above: to
// retire a feature for every visitor, set its default to false in DEFAULTS
// below (one word), and the engine will never seat it again.
//
// READING IT. isOn(name) → true | false (a name nobody registered is off).
// A pure planner never reads the address or the browser: the engine asks
// isOn() once, when it plans the meeting, and hands the answer down
// (plan(meetingInfo) takes meetingInfo.experimental = { singingSchool: … }).
// In Node (the harness, no window.location, no localStorage) every feature
// stands at its default.
//
// Public surface: window.KOLOB.Experimental
//   isOn(name) · set(name, on) · on(name) · off(name) · reset()
//   list() → [{ name, on, byDefault, from: "default"|"browser"|"address", about }]
//   snapshot() → { name: on, … }   (what the engine hands a planner)
//   onChange(fn) → unsubscribe      (fn(snapshot) after any switch)
//   DEFAULTS, ABOUT (frozen)
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Experimental = (function () {
  "use strict";

  // THE DEFAULTS — the owner's switches. true: the feature may be seated.
  var DEFAULTS = Object.freeze({
    singingSchool: true,
    reckoning: true,
  });
  var ABOUT = Object.freeze({
    singingSchool: "the singing school: the choir still practising the first hymn in the prelude — one part goes wrong, the chorister stops them, that part sings it alone on the notes, and everyone sings it again (about one Sunday in ten)",
    reckoning: "the Kolob reckoning: the drone moves one note a section, spelling the opening of the tune the doxology will sing, and glides only under the joints (off: the drone on the day's keynote all meeting; the doxology and everything else the same)",
  });
  var STORE_KEY = "kolob:experimental";

  // ---- where a switch came from: the browser (the console), then the address
  var browser = {}, address = {};
  function readBrowser() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORE_KEY);
      var o = raw ? JSON.parse(raw) : {};
      browser = {};
      Object.keys(o || {}).forEach(function (k) { if (DEFAULTS.hasOwnProperty(k) && typeof o[k] === "boolean") browser[k] = o[k]; });
    } catch (e) { browser = {}; }
  }
  function writeBrowser() {
    try {
      if (!window.localStorage) return;
      if (Object.keys(browser).length) window.localStorage.setItem(STORE_KEY, JSON.stringify(browser));
      else window.localStorage.removeItem(STORE_KEY);
    } catch (e) { /* a private window: the switch lasts this page only */ }
  }
  // ?exp=-singingSchool,+other  ·  ?exp=none  ·  ?exp=all
  function parse(query) {
    var out = {};
    var m = /[?&]exp=([^&#]*)/.exec(query || "");
    if (!m) return out;
    var spec;
    try { spec = decodeURIComponent(m[1].replace(/\+/g, "%2B")); } catch (e) { spec = m[1]; }
    spec.split(",").forEach(function (tok) {
      tok = tok.trim();
      if (!tok) return;
      if (tok === "none" || tok === "all") { Object.keys(DEFAULTS).forEach(function (k) { out[k] = tok === "all"; }); return; }
      var on = true, name = tok;
      if (tok[0] === "-" || tok[0] === "!") { on = false; name = tok.slice(1); }
      else if (tok[0] === "+") name = tok.slice(1);
      if (DEFAULTS.hasOwnProperty(name)) out[name] = on;
      else if (window.console && console.warn) console.warn("KOLOB.Experimental: no feature called \"" + name + "\" (known: " + Object.keys(DEFAULTS).join(", ") + ")");
    });
    return out;
  }
  readBrowser();
  try { address = parse(window.location && window.location.search); } catch (e) { address = {}; }

  var listeners = [];
  // a fault is told, never hidden (kolob-core.js, THE FAULTS): through the
  // house's confess, once per what, where the house is loaded; plainly on a
  // bench without it
  function confess(what, err) { var S = window.KOLOB._s; if (S && S.confess) S.confess(what, err); else if (typeof console !== "undefined") console.error("Kolob: " + what, err); }
  // (a listener that throws is passed over, and the rest still hear of the
  // change; its fault is told)
  function changed() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { confess("a listener to the switches threw", e); } });
  }
  function known(name) {
    if (!DEFAULTS.hasOwnProperty(name)) throw new Error("KOLOB.Experimental: no feature called \"" + name + "\" (known: " + Object.keys(DEFAULTS).join(", ") + ")");
  }

  function isOn(name) {
    if (!DEFAULTS.hasOwnProperty(name)) return false;
    if (address.hasOwnProperty(name)) return address[name];
    if (browser.hasOwnProperty(name)) return browser[name];
    return DEFAULTS[name];
  }
  // the console's switch: remembered by this browser; it also takes over
  // from the address for the rest of this visit (the latest word wins)
  function set(name, on) {
    known(name);
    on = !!on;
    if (on === DEFAULTS[name]) delete browser[name]; else browser[name] = on;
    delete address[name];
    writeBrowser();
    changed();
    return isOn(name);
  }
  function reset() {
    browser = {}; address = {};
    writeBrowser();
    changed();
    return snapshot();
  }
  function snapshot() {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = isOn(k); });
    return o;
  }
  function list() {
    return Object.keys(DEFAULTS).map(function (k) {
      return {
        name: k, on: isOn(k), byDefault: DEFAULTS[k],
        from: address.hasOwnProperty(k) ? "address" : browser.hasOwnProperty(k) ? "browser" : "default",
        about: ABOUT[k] || "",
      };
    });
  }
  function onChange(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  return {
    isOn: isOn, set: set, reset: reset, snapshot: snapshot, list: list, onChange: onChange,
    on: function (name) { return set(name, true); },
    off: function (name) { return set(name, false); },
    parse: parse,
    DEFAULTS: DEFAULTS, ABOUT: ABOUT,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-experimental.js"] = true;   // the load guard's roll call

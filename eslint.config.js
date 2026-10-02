// ESLint for the Kolob engine (art/kolob). A baseline, not a style guide: it
// catches what the engine's one-namespace, lend-onto-S pattern cannot — a name
// that is never defined, a variable or argument that is never used, a fault
// let pass without a word. The rules, and why each is on or off
// (PLAN-REFACTOR §3.8):
//
// On, as errors (they fail CI):
//   no-undef, no-unused-vars, no-redeclare, no-dupe-keys, no-self-assign,
//   no-unreachable, no-constant-condition — the baseline;
//   no-empty, empty catches included — a catch that lets a throw pass says
//     why in a comment inside it: `/* gone already */`, cleanup after a node
//     that may already be gone; `/* an old browser */`, a feature test; or
//     its own reason (a private window's storage, a file a tool can do
//     without). A fault is told, never hidden (kolob-core.js, THE FAULTS),
//     so a silent catch must say it is not one;
//   default-case — every switch says what becomes of a value it does not
//     name, even when that is the line after it;
//   no-prototype-builtins — hasOwnProperty is called from Object.prototype,
//     never through the object that may not have it.
// On, as warnings (`npm run lint` prints them; CI runs it without
// --max-warnings, so they never fail it), to watch the trend:
//   complexity over 25, and max-lines-per-function over 150 (comments not
//     counted; a room's own closure, an IIFE, is not a function).
// Off:
//   no-use-before-define — this code base is `var` and hoisting all through:
//     constants are declared at the foot of a room and read by the functions
//     above them at call time, which is safe; it flagged 89 safe sites and
//     no bug;
//   no-shadow — 182 sites, mostly R, t and n declared again inside
//     callbacks; the guest-room scaffold (§3.2, built) moved none of them,
//     and turning the rule on is a pass of its own;
//   never no-var (11,985 sites: the hoisting idiom is deliberate) nor
//     no-param-reassign (305: the rooms mutate their own records on purpose).
//
//   npm install && npm run lint          (CI runs the same)
"use strict";

const browserGlobals = {
  window: "readonly", document: "readonly", location: "readonly", navigator: "readonly",
  localStorage: "readonly", sessionStorage: "readonly", performance: "readonly",
  console: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly",
  clearInterval: "readonly", requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
  requestIdleCallback: "readonly", cancelIdleCallback: "readonly",
  AudioContext: "readonly", webkitAudioContext: "readonly", OfflineAudioContext: "readonly",
  AudioBuffer: "readonly", AudioWorkletNode: "readonly", MediaStream: "readonly",
  GainNode: "readonly", BiquadFilterNode: "readonly", StereoPannerNode: "readonly", OscillatorNode: "readonly",
  AudioBufferSourceNode: "readonly", ConvolverNode: "readonly", AnalyserNode: "readonly", AudioParam: "readonly", atob: "readonly", btoa: "readonly",
  Worker: "readonly", Blob: "readonly", URL: "readonly", fetch: "readonly", Response: "readonly",
  Promise: "readonly", Map: "readonly", Set: "readonly", Symbol: "readonly", Float32Array: "readonly",
  Uint8Array: "readonly", Int16Array: "readonly", DataView: "readonly", ArrayBuffer: "readonly", TextEncoder: "readonly",
  ResizeObserver: "readonly", MutationObserver: "readonly", Element: "readonly", HTMLElement: "readonly",
  Path2D: "readonly", DOMMatrix: "readonly", Image: "readonly", getComputedStyle: "readonly", matchMedia: "readonly",
  self: "readonly", importScripts: "readonly", postMessage: "readonly",
  URLSearchParams: "readonly", history: "readonly", PerformanceObserver: "readonly", AbortController: "readonly",
  Event: "readonly", CustomEvent: "readonly", Audio: "readonly", HTMLCanvasElement: "readonly", OffscreenCanvas: "readonly",
  FileReader: "readonly", XMLHttpRequest: "readonly", crypto: "readonly", devicePixelRatio: "readonly",
  innerWidth: "readonly", innerHeight: "readonly", scrollTo: "readonly", alert: "readonly", prompt: "readonly",
  // the engine's own globals (one namespace, SCORE §1) and the page's three
  KOLOB: "writable", PJ2: "readonly", KolobAudio: "writable", KolobViz: "writable", KolobText: "writable",
};

module.exports = [
  // (shelved/kolob-question-setpiece.js is reference text, not a room: pieces
  // copied out of four files, with their free names)
  { ignores: ["node_modules/**", "art/kolob/tools/out/**", "art/kolob/mockups/**", "**/*.min.js", "art/kolob/shelved/kolob-question-setpiece.js"] },
  {
    files: ["art/kolob/**/*.js"],
    languageOptions: { ecmaVersion: 2020, sourceType: "script", globals: browserGlobals },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-redeclare": ["error", { builtinGlobals: false }],   // (a room may declare `var KOLOB = window.KOLOB`)
      "no-dupe-keys": "error",
      "no-self-assign": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-empty": ["error", { allowEmptyCatch: false }],
      "default-case": "error",
      "no-prototype-builtins": "error",
      "complexity": ["warn", 25],
      "max-lines-per-function": ["warn", { max: 150, skipComments: true, IIFEs: false }],
    },
  },
  {
    // each lab raises its own window global and then calls it by its bare name
    files: ["art/kolob/*-lab.js", "art/kolob/shelved/*-lab.js"],
    languageOptions: { globals: { BagpipeLab: "writable", CastLab: "writable", EarthTunesLab: "writable", Guests3a: "writable", Guests3bLab: "writable",
      Guests3c: "writable", GuestsLab: "writable", GuestsLab3c: "writable", HymnLab: "writable", InstrumentsLab: "writable", OrganistLab: "writable",
      QuestionLab: "writable", TromboneLab: "writable", TuneLab: "writable", VoicesLab: "writable" } },
  },
  {
    // the headless harness and the measurement tools are Node (CommonJS)
    files: ["art/kolob/_harness.js", "art/kolob/tools/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "commonjs",
      globals: Object.assign({}, browserGlobals, {
        require: "readonly", module: "writable", exports: "writable", process: "readonly",
        __dirname: "readonly", __filename: "readonly", Buffer: "readonly", global: "writable",
        globalThis: "writable", setImmediate: "readonly", clearImmediate: "readonly", queueMicrotask: "readonly",
        WebSocket: "readonly", structuredClone: "readonly",
      }),
    },
  },
];

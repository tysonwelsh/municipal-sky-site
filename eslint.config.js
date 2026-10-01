// ESLint for the Kolob engine (art/kolob). A baseline, not a style guide: it
// catches what the engine's one-namespace, lend-onto-S pattern cannot — a name
// that is never defined, a variable or argument that is never used, a variable
// read before it is declared where that would matter. This code base is `var`
// and hoisting all through — constants are declared at the foot of a room and
// read by the functions above them at call time, which is safe — so
// no-use-before-define is left off; it flagged 89 safe sites and no bug.
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
  { ignores: ["node_modules/**", "art/kolob/tools/out/**", "art/kolob/mockups/**", "**/*.min.js"] },
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

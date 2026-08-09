# PLAN-APPSTORE.md — iOS App Store posture for The Junk Drawer

Agent APP, 2026-08-09. Charter: PLAN-USER-PROMPTS.md §5 + roster row 1.
Analysis only — this document writes no code and changes no other file.
Its consumer is **ARCH**, who freezes contracts next; §4 is the part ARCH
must honor.

**Research basis.** Verified against Apple's own pages on 2026-08-09:
`developer.apple.com/app-store/review/guidelines/` (full text of 1.2,
2.5.1, 2.5.2, 4.2, 4.3, 4.7, 4.8, 5.1.1, 5.1.2), and the two Apple
developer-news revision notices that matter here —
[2025-11-13](https://developer.apple.com/news/?id=ey6d8onl) and
[2026-06-08](https://developer.apple.com/news/?id=a233fmpw). The
guidelines page itself carries no visible "last updated" stamp; the most
recent revision announced by Apple is **2026-06-08**. Everything below
marked *(verified)* was read on an apple.com page today. A few browser
support facts (iOS Safari feature availability) are marked *(knowledge,
unverified)* — they are not guideline claims and are cheap to re-check.

**The headline finding.** The single most consequential rule for this
feature is **not** 4.2 and **not** 1.2. It is **5.1.2(i)**, revised
2025-11-13 *(verified)*:

> You must clearly disclose where personal data will be shared with third
> parties, **including with third-party AI**, and obtain explicit
> permission before doing so.

The visitor's prompt is personal data they authored, and it goes to
Anthropic and OpenAI. That triggers an explicit-consent obligation. It
binds at app submission, but the *cheap* moment to build it is now, in
the web modal, where it costs one panel of copy and two nullable
columns. Retrofitting consent into a shipped flow — and back-filling
consent state for visitors who already submitted — is the expensive
version. See §4 constraint 5.

---

## 1. Packaging recommendation

### Recommendation: **Capacitor**, with a small set of hand-written Swift
plugins. Not a bare WKWebView shell. Not a SwiftUI rewrite.

### 1.1 What this codebase actually is (the facts that decide it)

Read before recommending: `index.php`, `junk-drawer.js` (95 KB),
`junk-drawer.css` (58 KB), `data.php`.

| Fact | Where | Consequence for packaging |
|---|---|---|
| Zero build step, zero framework, vanilla ES5-flavored JS in one IIFE-per-module file | `junk-drawer.js` | Any packager that *demands* a bundler is a tax. Capacitor does not: `webDir` can point at a directory of plain files. |
| Rendering is 100% client-side from one JSON fetch | `junk-drawer.js:351` `fetch('data.php')` | The whole UI already works as "static assets + JSON API" — which is exactly the shape a packaged app needs. |
| PHP in `index.php` is thin and non-rendering | version stamp, `md5_file` cache-bust, two `include`s | A static app shell is a *flattening*, not a port. If PHP ever rendered UI, this stops being true. |
| The artwork engine is CSS: `border-image` frame kit, blend-mode craquelure/varnish/vignette layers, `cqmin` container-query sizing (6 uses), `calc(100svh - …)` stage | `junk-drawer.css:558–576` and the layer stack in `index.php` | This is the product. It is ~58 KB of painterly CSS that has already survived on-device tuning (PLAN-MOBILE G5, three revisions). Reimplementing it natively means redrawing it. |
| Interaction is Pointer Events with capture, plus silhouette-accurate hit-testing on inlined SVG | `junk-drawer.js:994–1028, 1299–1335, 1395–1414` (`setPointerCapture`, drag, twist/rotate) | Pointer Events are fully supported in WKWebView *(knowledge, unverified: iOS 13+)*. No porting needed inside a webview; total rewrite outside one. |
| Session state is one `sessionStorage` key | `junk-drawer.js:64, 199–204` (`jd-scatter-v2`) | One accessor away from app-persistent storage. |
| Haptics today are `navigator.vibrate` | PLAN-MOBILE §2 | **Not supported in iOS Safari or WKWebView** *(knowledge, unverified)*. This is the gap a native plugin fills — and it is the marquee 4.2 argument. |

### 1.2 The three routes, judged

**Bare WKWebView shell pointed at `municipalsky.com/art/junk-drawer/`.**
Rejected. Three independent problems:

1. **4.2 exposure is maximal.** Apple's text *(verified)*: "Your app
   should include features, content, and UI that elevate it beyond a
   repackaged website. If your app is not particularly useful, unique,
   or 'app-like,' it doesn't belong on the App Store." A single view
   controller containing a full-screen `WKWebView` that loads a remote
   URL is the canonical rejection shape.
2. **The site chrome comes along.** The page inherits `header.php`'s
   fixed banner, the nav dropdown, and `footer.php`'s subscribe form.
   Inside an app those read as *proof* that it is a website. Removing
   them means a page-variant anyway — at which point you have done
   Capacitor's work without Capacitor's benefits.
3. **2.5.2 optics.** "Apps should be self-contained in their bundles …
   nor may they download, install, or execute code which introduces or
   changes features or functionality of the app" *(verified)*. Remote
   webviews are tolerated in practice, but an app whose *entire* logic is
   fetched at runtime argues against itself. Bundling the JS/CSS and
   fetching only *data* is the defensible posture.

**Native SwiftUI rewrite.** Rejected for v1. The value of this piece is
the trompe-l'oeil rendering, and that rendering is CSS: `border-image`
nine-slice framing, `mix-blend-mode` aging layers, container-query
proportional sizing, `drop-shadow` budgets tuned per form factor, and a
pile layout engine with silhouette hit-testing tuned on real hardware
across three owner revisions. Reproducing it in SwiftUI/Core Animation is
a from-scratch reimplementation of the only thing that makes the app
worth shipping, and every future CSS tweak forks. It is also flatly
outside PLAN-USER-PROMPTS' "no dramatic refactor" constraint. Revisit
only if the app becomes a distinct product with native-first ambitions.

**Capacitor.** Recommended. What it buys, specifically here:

- **Local origin.** Web assets ship inside the bundle and are served
  from a custom scheme (`capacitor://localhost`). `data.php` and the new
  `jd-*.php` endpoints are then plain cross-origin JSON APIs. That is
  the 2.5.2-clean architecture and it costs nothing today *provided* the
  API base and the origin check are each one constant (§4.1, §4.2).
- **A plugin bridge for the 4.2 answer.** Core Haptics on grip/drop, the
  native share sheet for an item or a visitor's generated SVG, native
  Preferences for a drawer that persists between launches, splash /
  status-bar control, and later WidgetKit + App Intents via a custom
  Swift plugin. These are real native capabilities, not decoration —
  and haptics in particular is a *capability the web version literally
  cannot have on iOS*, which is the cleanest possible 4.2 story.
- **No bundler required.** `webDir` = a directory. The only build
  artifact is the static shell (see below).
- **One JS codebase.** Web and app run the same `junk-drawer.js`; the
  shims in §4.8 are the only branch points.

### 1.3 The one real cost, named honestly

`index.php` is PHP; an app bundle cannot run it. The app needs a
**static shell** — an `index.html` with the same markup, without the
site banner/footer includes, with the version stamp inlined at build
time. Today that is a ~15-line script (curl the deployed page, strip the
two chrome regions, rewrite asset paths) or a hand-maintained twin. It
stays cheap **only** while `index.php`'s PHP remains confined to its
current footprint. That is §4.10, and it is the constraint most likely
to be violated accidentally by a well-meaning coder who "just" renders
the new button server-side.

### 1.4 Deployment target

iOS 16.0. Rationale: container queries (`cqmin`) are Safari 16 *(knowledge,
unverified)*; `svh` is Safari 15.4; `:has()` is unused (0 occurrences in
`junk-drawer.css`); `<dialog>`/`showModal` is 15.4. iOS 16 clears
everything the page already uses with room to spare. Nothing in the
current CSS forces a higher floor — **keep it that way** (§4.9).

---

## 2. Guideline risk register

Column *Binds* distinguishes **now** (the web build being coded in the
next stage must handle it) from **submission** (app-stage work; listed so
nothing forecloses it).

| # | Guideline | Risk to this feature | Mitigation | Binds |
|---|---|---|---|---|
| R1 | **5.1.2(i)** Data Use and Sharing — "including with third-party AI", added 2025-11-13 *(verified)* | Prompt text is user-authored personal data sent to Anthropic and OpenAI. No disclosure + no explicit permission = rejection, and arguably a live privacy misstatement today. | One-time consent panel before the first generation, naming both providers in plain language; record `ai_consent_at` + `ai_consent_version` on the submission; same copy mirrored into `privacy.php`. Two nullable columns and one panel. | **now** |
| R2 | **4.2 / 4.2.2** Minimum Functionality *(verified)* | The app is a web page in a container. Highest-probability rejection reason for any route. | Capacitor + genuine native capabilities: Core Haptics on grip/settle/drop, native share sheet for an item card and for a visitor's won SVG, app-persistent drawer state (survives launches — the web can only do session), later a WidgetKit "today's item" widget and App Intents. Web build's job is only to route haptics/share/storage through single shims so the plugins drop in (§4.7, §4.8). | submission (shims: **now**) |
| R3 | **4.2.3(ii)** disclose download size before initial-launch downloads *(verified)* | If the app ships an empty shell that pulls the entire collection on first run, this triggers. | Bundle the frame/well/craquelure textures (the ~450 KB first-load budget from PLAN-MOBILE §5) in the app; only `data.php` + item SVGs stream. Then there is no "additional resources to function" download to disclose. | submission |
| R4 | **1.2** User-Generated Content *(verified; revised 2026-06-08 with a new paragraph on developer responsibility)* | The four bullets (filter objectionable material **from being posted to the app**, report mechanism, block abusive users, published contact info) attach to content that reaches *other users*. | **The §8 decision that visitor items are session-local keeps v1 out of three of the four bullets**: nothing is "posted to the app", there is no other user to see it, and there is nobody to block. Only "published contact information" applies, and the site already satisfies it (`privacy.php` carries the owner's email). *If items ever go public*, all four bullets bind at once: a pre-publication filter, a report affordance with a real response SLA, per-user blocking, and — per the 2026-06 revision — explicit developer responsibility for what slips through. That is a moderation product, not a feature toggle. | now (as a *constraint to not violate*); all four at submission **if** display ever becomes public |
| R5 | **1.2 / 4.7.1** report mechanism for generated content | Even with session-local display, a model can return something ugly, and reviewers increasingly expect a report path anywhere generated content is shown. 4.7.1 *(verified)* requires, for chatbot/mini-app software, "a method for filtering objectionable material, a mechanism to report content and timely responses to concerns". Whether 4.7 formally reaches a first-party generative feature is arguable; the mitigation is cheap enough that arguing is the wrong move. | One flag control in the rate step + one ENUM value in the ratings write path (§4.6). Doubles as eval signal (refusals, hostile output). Do **not** build queues, blocking, or an admin UI. | **now** (the hook), submission (the response SLA) |
| R6 | **5.1.1(i)** Privacy policy content *(verified)* | Must identify what is collected, how, all uses, third-party sharing with equal protection, retention/deletion, and how to revoke consent — linked in App Store Connect *and* inside the app. Current `privacy.php` covers the Onomatopoeia Bot and the subscribe form; it says nothing about drawer prompts, ratings, or the visitor hash. | Add a Junk Drawer section to `privacy.php` in the web stage, written in the words the nutrition label will use (§4.13). | **now** |
| R7 | **5.1.1 / App Privacy nutrition label** | The label must be accurate and is checked. Data actually collected: **prompt text** (→ *User Content*), **ratings + pairwise preference** (→ *Usage Data*), **salted daily-rotating visitor hash** (→ *Identifiers*), plus latency/token/status rows (→ *Diagnostics*). | Declare: User Content (App Functionality, Analytics), Usage Data (Analytics, App Functionality), Identifiers (Analytics), Diagnostics. **Declare these as Linked to the user, not "not linked."** Apple's bar is that data must not be re-linkable *including via a pseudonymous ID you hold* — the visitor hash is exactly such an ID and it is stored on the same rows. Claiming "not linked" would be the false statement. Tracking = **No** (no cross-app/cross-site sharing for advertising), so **no ATT prompt is required**. | submission (accuracy is determined by what the web build stores — so shape it **now**) |
| R8 | **2.5.2** self-contained bundles; no downloading/executing code that changes functionality *(verified)* | A model-authored SVG is untrusted markup rendered inside the app. `<script>`, `on*` handlers, `foreignObject`, external `<use>`, `javascript:` URLs — any of these executing is literally "downloaded code changing functionality". | PLAN-USER-PROMPTS §2.4's server-side allowlist sanitizer, reject-never-repair, already covers this. Add the app-side rule: no `eval`, no `new Function`, no injected `<script>`, no runtime-fetched remote JS/CSS/fonts/images for user content (§4.12). Sanitize server-side so the app is never the only line of defense. | **now** |
| R9 | **2.5.1** public APIs only; run on current OS *(verified)* | Low. Capacitor and its first-party plugins use public API. | Vet any third-party Capacitor plugin before adopting; prefer the official `@capacitor/haptics`, `/share`, `/preferences`. Keep the deployment target current. | submission |
| R10 | **Privacy manifest** (`PrivacyInfo.xcprivacy`, required for apps and SDKs since May 2024) | Missing manifest or missing required-reason API declarations blocks upload. Capacitor `Preferences` is backed by `UserDefaults` — a required-reason API. | Declare collected data types matching R7, and `NSPrivacyAccessedAPICategoryUserDefaults` with reason **CA92.1** (access to app's own defaults). Audit each plugin's own manifest. | submission |
| R11 | **Age rating questionnaire** (overhauled July 2025: 4+/9+/13+/16+/18+; must be completed or submissions are blocked; a July 2026 addition asks about social-media/UGC-feed capability) | Free-text input feeding an LLM plus displayed generated imagery pushes the rating up; a UGC *feed* would force 13+ from Sept 2026. | Answer honestly — expect 13+ or higher on the AI/generated-content questions. **Session-local display means there is no feed and no social-media capability**, which is the answer that keeps the rating from escalating further. Nothing in the web build should create a feed. | submission (protected **now** by the no-public-display decision) |
| R12 | **4.3(a)/(b)** spam / duplicate apps *(revised 2026-06-08 with added examples; Apple also tightened low-quality-app language in June 2026)* | A small single-purpose art toy can read as low-effort in a store full of AI-generated filler. | The app is original artwork with a documented editorial process; lean on that in the listing (screenshots of the painted drawer, not of UI chrome; description that explains the eval taxonomy). Do not ship near-duplicate variants. | submission |
| R13 | **4.7 / 4.7.2** mini apps, chatbots, plug-ins *(verified; clarified 2025-11-13 to explicitly cover HTML5/JS mini apps)* | 4.7 targets apps *hosting third-party* software. This app hosts none — the generative feature is first-party. Residual risk is a reviewer reading "chatbot" broadly. | Do not build any user-scriptable surface. The generated SVG is inert data, not executable software (guaranteed by R8's sanitizer). Keep the app's own webview assets bundled — Capacitor does this, which also removes the "software delivered at runtime" reading. 4.7.2 (may not expose native APIs to hosted software) is satisfied trivially: nothing hosted. | submission |
| R14 | **5.1.1(v)** account sign-in *(verified)*: "If your app doesn't include significant account-based features, let people use it without a login." | Adding accounts to a toy is itself a guideline problem, not just a cost. | Ship no accounts (§3). | **now** (as a decision) |
| R15 | **4.8** Login Services *(verified)* | Only triggers if a *third-party or social* login is used for the primary account. | Not applicable while there are no accounts. See §3 for what changes if that reverses. | submission, conditional |
| R16 | **Offline behavior** (a 4.2 sub-argument, not a numbered rule) | A network-dependent toy that shows a white screen with no signal is the classic "lazy wrapper" tell. | App stage: persist the last `data.php` payload and item SVGs so the drawer opens offline in read-only mode, with generation disabled and honestly labeled. Web stage does **not** build this — it only keeps the payload a single serializable JSON object and routes storage through one accessor (§4.7) so it is a later swap, not a rewrite. The existing `data.php`-unreachable fallback (`junk-drawer.js:221–227`) is the honest degradation for the web. | submission (kept cheap **now**) |

### 2.1 What the register does *not* claim

- There is no App Store rule requiring an "AI-generated" watermark or
  label on output. Only 5.1.2(i)'s data-sharing disclosure is a hard rule
  *(verified — 5.1.2(i) is the sole occurrence of "AI" in the guideline
  text)*. Third-party blogs assert a broader "you must label AI content
  and provide a report feature" standard; that reads as sound practice
  and reviewer-expectation folklore rather than quotable guideline text.
  It costs nothing here — the entire premise of the page is that these
  are machine-made objects, so "AI-generated" labeling is the *content*,
  not a compliance burden.
- The Apple Developer Program License Agreement (not the review
  guidelines) gained AI/ML sections 3.3.11, 3.3.11(A) and 3.2(h) on
  2026-06-08. Those govern use of **Apple's** models (Foundation Models
  framework). This feature calls Anthropic and OpenAI over HTTPS from a
  PHP server and uses no Apple model, so they do not bind — but they are
  the reason to *not* casually reach for on-device Foundation Models as a
  third generator later without re-reading them.

---

## 3. Do we need accounts?

**Recommendation: no accounts in v1. Not a deferral — a design position.**

- **The guideline points the same way.** 5.1.1(v) *(verified)*: "If your
  app doesn't include significant account-based features, let people use
  it without a login," and apps "may not require users to enter personal
  information to function except when directly relevant to core
  functionality or required by law." A drawer you dig in has no
  account-shaped feature. Requiring one would be the violation.
- **Nothing in the loop needs one.** Rate limiting uses the server-side
  visitor hash. Blind rating needs no identity. Session-local display
  needs no identity. The eval dataset's rater axis is the visitor hash.
- **Accounts would *add* obligations, not remove them.** 5.1.1(v)
  *(verified)*: an app that supports account creation "must also offer
  account deletion within the app" — a real deletion endpoint, a real
  cascade over `jd_submissions`/`jd_generations`/`jd_ratings`/
  `jd_comparisons`, and a UI. Plus password/reset infrastructure on
  shared hosting, plus a much heavier privacy label.

**The one thing accounts would genuinely buy** is what PLAN-USER-PROMPTS
§3 already names as a known limitation: the visitor hash rotates daily by
design, so cross-day rater identity does not exist and per-rater
agreement analysis is bounded to a single day. That is a real dataset
cost. It is not worth an account system in v1. If it ever is, the cheaper
intermediate is an **anonymous device-scoped id** minted client-side and
stored in app-persistent storage (Capacitor Preferences) — stable per
install, no credentials, no login, no 4.8 exposure, no deletion-UI
mandate, and it slots into the existing `visitor_hash` column semantics
as an additional column rather than a replacement. Note it; do not build
it.

**If accounts are ever added, these trigger together:**

1. **4.8** *(verified)* — only if you use a *third-party or social* login
   (Google, Facebook, X…) for the primary account. Then you must also
   offer an equivalent alternative that (a) limits collection to name and
   email, (b) lets the user keep the email private, (c) does not collect
   interactions for advertising without consent. Sign in with Apple is
   the turnkey way to satisfy it. **Exception that matters here**: an app
   using *exclusively its own* account system is exempt — so a
   plain email/password (or magic-link) account on municipalsky.com
   would **not** require Sign in with Apple. That is worth knowing before
   anyone reaches for a social login "because it is easier."
2. **5.1.1(v)** — in-app account deletion, full stop.
3. **5.1.1(i)** — privacy policy must cover the account data, retention,
   and the deletion path.
4. The nutrition label gains Contact Info (email) and the identifiers
   become unambiguously linked.

---

## 4. BINDING CONSTRAINTS FOR THE WEB BUILD HAPPENING NOW

These are for **ARCH** to fold into the frozen contracts and for **BE-C**
and **FE-C** to implement. Each is deliberately cheap — a constant, a
shim, a column, a helper. Anything that is not cheap is in constraint 15,
marked defer.

1. **One API base constant, and every fetch goes through it.** Declare
   `JD_API` once in `junk-drawer.js` (empty string today = same origin)
   and build every request as `JD_API + '/art/junk-drawer/data.php'`,
   `JD_API + '/api/jd-generate.php'`, `JD_API + '/api/jd-rate.php'`.
   Convert the two existing call sites too — `fetch('data.php')`
   (`junk-drawer.js:351`) and the `'../../api/page-event-tracking.php'`
   tracking call (`junk-drawer.js:1738`) — so no relative path anywhere
   assumes the page and the API share a directory. After this change,
   grepping `fetch(` must show zero string literals that are not
   `JD_API + …`.

2. **The server-side origin check is an allowlist array in one shared
   helper, not an inline same-origin comparison.** Put
   `jd_require_allowed_origin()` in a shared `api/` include with
   `['https://municipalsky.com', 'https://www.municipalsky.com']` as a
   named constant; handle a missing `Origin` header explicitly rather
   than by accident. That helper is the only place that may ever emit
   `Access-Control-Allow-Origin`, it echoes the matched origin and never
   `*`, it never sets `Access-Control-Allow-Credentials`, and it answers
   `OPTIONS` with a 204 preflight response. Adding `capacitor://localhost`
   later is then a one-line edit instead of an audit. (A cross-origin
   JSON `POST` preflights; if `OPTIONS` is unhandled the app fails on day
   one for a reason nobody will find quickly.)

3. **Identity is never cookie- or session-derived.** No `session_start()`,
   no `setcookie`, no PHP session for rate limiting, dedup, or CSRF, in
   any of the new endpoints. `msky_visitor_hash()` (IP + secret salt +
   UTC date) stays the only server-side identity. Any client-held
   identifier travels in the JSON body or a custom header — never a
   cookie. Rationale: a packaged app runs on a custom-scheme origin with
   its own cookie jar and hostile third-party-cookie policy; anything
   built on cookies breaks silently there.

4. **The `client` column is written from a client-declared constant, never
   sniffed.** `JD_CLIENT = 'web'` in `junk-drawer.js`, sent in the POST
   body; the server validates it against a small enum
   (`web` | `ios` | `android`) and defaults to `web` when absent or
   invalid. Do not parse User-Agent — the app's UA is a WKWebView UA and
   would be misfiled as web forever.

5. **Third-party-AI consent is an explicit, recorded event** (Guideline
   5.1.2(i)). Before a given visitor's **first** generation, the modal
   shows a short plain-language disclosure naming the providers — that
   their words are sent to Anthropic and to OpenAI, what comes back, and
   that prompt + ratings are stored — and requires an affirmative action
   to proceed (a checked box or a distinct "I understand, generate"
   step; the submit button alone is not "explicit permission"). Schema:
   add `ai_consent_at DATETIME NULL` and `ai_consent_version VARCHAR(16)
   NULL` to `jd_submissions` **now** — two columns cost nothing today and
   are a production migration later. The consent copy lives in one
   constant, shared verbatim with the privacy-policy text (constraint 13).
   Consent state is remembered via the storage accessor (constraint 7) so
   returning visitors are not re-prompted every submission, and the
   *recorded* consent lives server-side on the row.

6. **A flag/report path exists from day one, at the smallest possible
   size.** Extend `jd_ratings.kind` to `ENUM('grade','axis','flag')` (or
   an equivalently small `jd_flags` table) and put one unobtrusive
   control in the rate step — "this response is broken or offensive",
   optional note. That is the whole mitigation. Do **not** build a
   moderation queue, an admin UI, blocking, or an automated filter:
   session-local display is what keeps those out of scope, and building
   them would contradict §8 decision 2. The flag is simultaneously
   real eval signal (refusals, hostile output, sanitizer near-misses).

7. **One storage accessor, not scattered `sessionStorage` calls.**
   `JD_store.get(key) / .set(key, value) / .remove(key)`, `jd-` prefixed,
   JSON-serializing, wrapped in try/catch — extend the pattern already at
   `junk-drawer.js:199–204` rather than inventing a second one, and move
   the existing `jd-scatter-v2` read/write onto it. **All** new state goes
   through it: the visitor's won items, in-flight submission ids, the
   consent flag. Keep values JSON-serializable and modest; do not put
   multi-hundred-KB SVG blobs in it (store the generation id and re-fetch,
   or cap what is persisted). In the app this accessor is the single site
   that swaps to Capacitor Preferences — which is also what turns
   "session-local" into "persists between launches", a 4.2 native-value
   argument obtained for free.

8. **One haptics shim and one share/copy shim.** `JD_haptic('grip' |
   'settle' | 'drop' | 'select')` wrapping today's
   `navigator.vibrate?.(n)` — a silent no-op on iOS Safari, and the exact
   single site where `@capacitor/haptics` lands later. `JD_share({title,
   text, url, svg})` wrapping the existing clipboard copy
   (`junk-drawer.js:1444`) and any new share affordance. **Never call
   `navigator.share` directly**: it exists in iOS Safari but is absent in
   WKWebView/Capacitor without the Share plugin, so a direct call would
   pass every web test and fail silently in the app.

9. **No new browser-only API without a guarded fallback.** Specifically
   forbidden in new code: `navigator.share` (constraint 8),
   `AbortSignal.timeout` (Safari 17.4+ — use `AbortController` +
   `setTimeout` for the 90 s generation timeout), the Fullscreen API
   (absent on iPhone Safari), the Notification API, service workers /
   Background Sync, and `beforeunload`-dependent logic (unreliable in a
   webview). Feature-detect in the existing house style
   (`if (navigator.clipboard && navigator.clipboard.writeText)`,
   `junk-drawer.js:1444`); never rely on a missing API throwing. Also: do
   not raise the CSS floor above iOS 16 — no `:has()` (currently 0 uses),
   no `@scope`, no `text-wrap: balance` load-bearing layout.

10. **Nothing in the new loop renders from PHP.** `index.php` stays what
    it is — version stamp, `md5_file` cache-busting, the two chrome
    includes, static markup. The button, modal, survey, blind reveal, and
    winner placement are built in JS from JSON. No new PHP-rendered HTML
    partial, no PHP-templated modal, no server-rendered rubric. This is
    the single constraint that keeps a static app shell a *flattening*
    rather than a port; violating it silently converts the app route into
    a rewrite.

11. **Every generation is recoverable by id, and the client persists ids
    before it waits.** `jd-generate.php` returns `{submission_id, gen_id,
    slot}` and the client writes them via `JD_store` **before** awaiting
    the long response body. Reserve the read path in the contract —
    `GET /api/jd-submission.php?id=…` returning current status plus any
    completed slots — but build it only if QA measures losses. The schema
    already carries per-row `status` (§3), so it stays a pure read with no
    migration. Rationale: a 60–120 s fetch does not survive a webview
    being backgrounded; on the web it merely survives a tab switch, so
    this is nearly free insurance that the app stage cannot buy later
    without touching the write path.

12. **The generated-SVG trust boundary is server-side and absolute.**
    Sanitize in PHP, reject rather than repair (PLAN-USER-PROMPTS §2.4 as
    written). In the client: never `eval`, never `new Function`, never
    inject a `<script>`, and never let user-content markup cause a runtime
    fetch of remote JS, CSS, fonts, or images. Beyond the security case,
    2.5.2 forbids downloading or executing code that changes app
    functionality — an app bundle that inlines model-authored `<script>`
    is the textbook violation, so the sanitizer is an App Store control as
    well as a security control. Inline user SVGs only after `JD_svgInst`
    id-namespacing, same as curated items.

13. **Privacy copy is written now, in `privacy.php`, in the words the
    label will use.** One new section covering: the prompt text you type
    (*User Content*), your ratings and preference (*Usage Data*), the
    salted daily-rotating visitor hash (*Identifiers* — describe the
    rotation honestly), generation diagnostics (*Diagnostics*), the two AI
    providers **named**, what they receive, retention, and the existing
    contact address for deletion requests. Reuse the consent constant from
    constraint 5 so the two can never drift. Cheap now (a doc edit that
    should exist regardless); at submission it is the literal source text
    for the nutrition label and the 5.1.1(i) in-app privacy link.

14. **Assume cross-origin in the client from day one.** No
    `credentials: 'include'`, no reliance on `document.referrer`, no
    cookie-based CSRF token, no assumption that the page and the API share
    an origin or a directory. The abuse controls stay as PLAN-USER-PROMPTS
    §2.3 specifies — the origin allowlist (constraint 2), the honeypot,
    the prompt-length cap, and the server-side rate limits — all of which
    work identically from a custom-scheme origin.

15. **Defer, note only — do NOT attempt in the web stage.** Each of these
    is real app-stage work; none is foreclosed by constraints 1–14, and
    attempting any now would be the "dramatic refactor" the master plan
    forbids: offline drawer (cached payload + cached item SVGs +
    read-only mode); WidgetKit widget; App Intents / Shortcuts; native
    tab-bar or navigation chrome; the static-shell generator itself; any
    account system; device-scoped stable rater identity; service worker;
    moderation queue, blocking, or admin review UI; public display of
    visitor items (which would re-open all of 1.2 and the age-rating
    social-media question, R4/R11).

---

## 5. Handoff note to ARCH

The four items that must appear in the frozen contracts, because they
change document shapes rather than just code:

- **DDL**: `jd_submissions.ai_consent_at DATETIME NULL`,
  `jd_submissions.ai_consent_version VARCHAR(16) NULL` (constraint 5);
  `jd_ratings.kind ENUM('grade','axis','flag')` (constraint 6).
- **Endpoint contract**: `client` as a validated request field
  (constraint 4); `{submission_id, gen_id, slot}` returned before the SVG
  body is awaited (constraint 11); a reserved-but-unbuilt
  `GET jd-submission.php?id=` shape (constraint 11); `OPTIONS` handled by
  the shared origin helper (constraint 2).
- **Modal state machine**: a consent state ahead of prompt entry, entered
  only on first use, with its copy as a versioned constant
  (constraint 5); a flag control inside the rate state (constraint 6).
- **Named client constants** that the frontend contract should enumerate:
  `JD_API`, `JD_CLIENT`, `JD_store`, `JD_haptic`, `JD_share`, and the
  consent-copy constant (constraints 1, 4, 5, 7, 8).

Everything else in §4 is implementation discipline that BE-C and FE-C can
honor without a contract change — but FE-K and BE-K should be told to
check for it, because these are exactly the constraints that get lost in
a fast build and are expensive to reinstate afterward.

---

## Sources

- [App Review Guidelines — Apple Developer](https://developer.apple.com/app-store/review/guidelines/) (full text read 2026-08-09)
- [Updated App Review Guidelines now available — Apple Developer News, 2025-11-13](https://developer.apple.com/news/?id=ey6d8onl) (5.1.2(i) third-party AI; 4.7 HTML5/JS mini apps; 1.2.1(a) creator content)
- [Updated Apple Developer Program License Agreement and App Review Guidelines — Apple Developer News, 2026-06-08](https://developer.apple.com/news/?id=a233fmpw) (1.2 new paragraph; 4.3(a)/(b); DPLA §§3.3.11, 3.2(h) AI/ML)
- [App Privacy Details — Apple Developer](https://developer.apple.com/app-store/app-privacy-details/) (nutrition-label data types; linked vs. not-linked standard)
- [Updated age ratings in App Store Connect — Apple Developer News](https://developer.apple.com/news/?id=ks775ehf)
- [Age rating questionnaire now includes social media questions — Apple Developer News](https://developer.apple.com/news/?id=tlur8uvi)

# PLAN-MOBILE — The Junk Drawer

Mobile-first plan for `/art/junk-drawer/`. Companion to PLAN-FRONTEND.md (which it amends — §6 below is the precise delta list) and PLAN-BACKEND.md (whose §7 data contract this plan treats as authoritative and does not touch). Governing requirement, from the owner: **mobile is a first-class experience** — on load the phone shows a full-viewport drawer ("you are peering down into a drawer"); all explanatory text lives below the drawer, reached by scrolling; the core loop (see the pile → dig a little → open an item's eval card → flip alternatives) must be great on a phone, because this is the piece that gets demoed from a pocket.

## 0. Site facts this plan is built on (verified in the repo)

- **The banner is fixed, not sticky-scrolling**: `.site-banner` is `position: fixed; top: 0; height: var(--banner-h)` (`css/style.css:347`), 56 px desktop, **48 px at ≤768 px** (`--banner-h-mobile`, `style.css:1453–1464`); `body` compensates with `padding-top: var(--banner-h)`. Mobile nav is a checkbox dropdown under the banner.
- **Full-bleed technique**: a page section can escape the site's centered column with the standard `margin: 0 calc(50% - 50vw)` trick, then size itself against the viewport minus the fixed banner. Two rules for doing it right here: always subtract `var(--banner-h)` (never a hardcoded pixel literal, which goes stale when the banner changes), and never put `touch-action: none` on a viewport-filling stage — on touch devices that makes any content below it effectively unreachable, a trap this page (with real content below the fold) cannot afford.
- **Breakpoints/conventions**: the site's mobile query is `max-width: 768px`, with `(hover: none) and (pointer: coarse)` used for touch-specific overrides (`style.css:1534`). Tokens: Courier Prime `--font-mono`, `--plot-red`, paper white, 8 px `--s-*` grid, `--max-narrow: 600px`.
- **`header.php` closes `</head>` before the page runs**, so project pages cannot add head tags; siblings put `<link>`s in body (tolerated). This constrains meta niceties (§5).
- **`mockups/*.html` deploy** (only `*.md`, `scripts/`, `.github/`, `local-dev/` are excluded), so "test on a real phone" = push to `main`, open `municipalsky.com/art/junk-drawer/mockups/...` on the phone. This makes Phase 0 device testing nearly free.

---

## 1. The full-viewport drawer on mobile

### Viewport strategy: `svh`, not `dvh`

```css
.jd-stage {
  margin: 0 calc(50% - 50vw);                 /* full-bleed to viewport edges */
  height: calc(100vh  - var(--banner-h));     /* fallback for pre-2022 browsers */
  height: calc(100svh - var(--banner-h));
  min-height: 420px;
}
```

**Why `svh`**: the small-viewport unit is the viewport with browser UI *expanded* — the worst case, which is exactly the on-load case in iOS Safari and Android Chrome. Sized to `100svh - banner`, the **entire drawer is visible at first paint**, URL bar and all, on every phone. Crucially, `svh` is *stable*: it never changes as the URL bar collapses/expands, so the well's pixel geometry (computed per resize in `jd-pile.js`) never recomputes mid-scroll or — worse — mid-drag. `dvh` mutates during scroll; for a letterboxed canvas that would be harmless, but for a laid-out pile it means items shifting under the user's finger. Rejected.

Bonus behavior, free: once the user scrolls and the URL bar collapses, the visual viewport grows past `svh` and the top of the field-notes section peeks below the drawer — a second, organic "there's more down there" cue.

- **iOS Safari** (bottom URL bar since iOS 15): layout viewport excludes the bar; `svh` accounts for it. Keep the bottom-edge scroll cue (§2) padded ~12 px up from the drawer's bottom edge so taps don't graze the bar-reveal zone.
- **Android Chrome**: same math; `svh` supported since Chrome 108. The `100vh` fallback line covers ancient browsers (slightly-taller-than-viewport drawer; acceptable degradation).
- **Safe-area insets**: the shared `viewport` meta has no `viewport-fit=cover`, so in-browser `env(safe-area-inset-*)` is 0 and the browser keeps us out of the notch automatically — the least-hacky arrangement; do **not** add `viewport-fit=cover` (it would require touching `header.php` for one page). Still write `padding-bottom: max(var(--s-2), env(safe-area-inset-bottom))` on the bottom sheet and the scroll cue — a no-op today, correct if the page is ever viewed standalone.
- **Orientation**: portrait is primary and gets the tuning. Landscape-phone (`(orientation: landscape) and (max-height: 520px)`): the frame kit renders it honestly as a wide shallow tray (`min-height` drops to 300 px); the specimen card switches to the desktop side-by-side overlay (there's horizontal room and no vertical room for a sheet). No further landscape investment.

### Header chrome: keep it, exactly as-is

> **OVERRIDDEN — G5 revision 4 (owner, 2026-07-26, on-device)**: on mobile
> the banner now YIELDS to the drawer ("immersive mode"): the drawer owns
> the true 100svh at y=0; the fixed banner slides away while the drawer is
> in view and returns once the visitor scrolls past half the stage toward
> the notes. Page-scoped via junk-drawer.css (no header.php changes; other
> pages untouched). Snap offsets rebalanced accordingly: drawer snaps to
> true top, `#notes` carries the banner offset via `scroll-margin-top`.
> Desktop keeps the banner as-is. The reasoning below stands for desktop
> and for any page without a full-viewport hero.

Options considered: overlay the drawer under a transparent banner (fights the paper-white fixed banner's design), auto-scroll the banner away on load (it's `position: fixed` — it doesn't scroll away; faking it is maximal hack), suppress the banner on this page (breaks the one inviolable site convention). **Decision: the banner stays untouched**; the drawer starts at y = 48 px. That costs ~7% of a phone viewport and buys total consistency — the drawer sits under the site masthead like a painting under a gallery's wall text. Offset with `var(--banner-h)`, never a pixel literal.

### The drawer's aspect: frame kit confirmed — and mobile decides gate G1

On an iPhone 14-class screen (390 css px wide, `svh` ≈ 660): stage ≈ 390 × 612. With wall bands at `border-width: clamp(28px, 9vw, 64px)` (≈ 35 px on a 390 px screen), the well is ≈ 320 × 542 — a **1 : 1.7 portrait drawer**. This is precisely what PLAN-FRONTEND §1's `border-image` frame kit was designed to permit, and it is the argument that **resolves owner gate G1 in the frame kit's favor**: a fixed-aspect hero painting cannot fill a portrait phone viewport without letterboxing away the "peering down into it" effect. The fixed-aspect mockup may still be built for comparison, but it is now a desktop-only curiosity, not a contender.

One mobile-specific asset amendment: serve a smaller frame painting on small screens by swapping a custom property, since `border-image-source` can't use `srcset`:

```css
.jd-frame { border-image-source: var(--jd-frame-url); }
:root { --jd-frame-url: url(assets/frame-2000.webp); }
@media (max-width: 768px) { :root { --jd-frame-url: url(assets/frame-1200.webp); } }
```

---

## 2. The scroll conflict — dig vs. scroll (the crux)

PLAN-FRONTEND §3's `touch-action: none` on items, with scrolling from frame/margins, was designed for a drawer embedded in a scrolling page. A full-viewport drawer covered in a dense pile breaks it: the touchable margin shrinks to slivers of wood and a 35 px frame band, and the content below becomes effectively unreachable by touch (the §0 trap).

### Rejected options, briefly

- **Two-finger scroll / one-finger dig** — undiscoverable, nonstandard, hostile to accessibility. No.
- **Dig-mode toggle** — a mode switch bolted onto the hero interaction of a portfolio piece is an admission of design failure, and modes get left in the wrong state. No.
- **Overscroll-at-pile-edge converts to page scroll** — requires hand-rolled scroll physics that will never match the platform's, and "my drag turned into a scroll" is the worst possible surprise mid-dig. No.
- **Swipe-on-wood scrolls, drag-on-item digs** (the current plan) — kept as a *component* (wood and frame do scroll) but rejected as the primary mechanism: it makes reaching the field notes depend on finding wood, which the pile's density is actively working against.

### Primary mechanism: **swipe to scroll, hold to dig**

The disambiguator is not *where* the finger lands but *what the gesture is* — the platform-native long-press-to-pick-up idiom (iOS home screen, list reordering) applied to the drawer:

- **Items get `touch-action: pan-y`**, not `none`. A quick vertical swipe **anywhere on the page — items included — scrolls the page**. The universal gesture always works; there is no trap, ever.
- **Press and hold an item ~180 ms without moving** (> touch slop 10 px cancels): the item "grips" — the existing lift animation (scale, shadow lengthening) plays as the acknowledgment, plus `navigator.vibrate?.(8)` (Android haptic; silent no-op on iOS). From grip onward, dragging in **any direction** digs: a non-passive `touchmove` listener calls `preventDefault()`, which legally pins the page even though `touch-action: pan-y` would otherwise allow scrolling (the browser hasn't started a scroll — the finger was still during the hold — so the gesture is ours to claim).
- **Quick swipe before the timer fires** → the browser takes the gesture, we receive `pointercancel`, the page scrolls. Clean handoff, no half-states.
- **Tap** (release within slop, any time) → select + open the specimen card, exactly as planned. The payload interaction needs zero instruction.
- **Mouse is untouched**: the hold applies only when `pointerType === 'touch'`. Desktop drag-digs immediately; wheel scrolls; nothing in PLAN-FRONTEND's desktop feel changes.

Required companions on items (this also matters for the hold gesture itself): `-webkit-touch-callout: none; user-select: none; -webkit-user-drag: none;` and `draggable="false"` on the `<img>` — otherwise iOS answers our long-press with its own save-image callout.

**Teaching it**: the grip animation is self-demonstrating the first time a curious press lingers, and a one-line mono caption sits at the top of the field notes ("press & hold to rummage · tap to inspect"). No overlay tutorial.

### Page structure: all-or-nothing full-page snap (owner directive, 2026-07-26)

> **G5 on-device revision (owner, Phase 1 live test, same date)**: `mandatory`
> proved hair-trigger on iOS — with a one-viewport drawer, any registered
> swipe committed a full flip. Production uses **`scroll-snap-type: y
> proximity`**: the two snap points sit exactly one viewport apart, so every
> release still lands on one or the other (all-or-nothing preserved) but a
> flip requires crossing the midpoint; accidental drifts spring back to the
> drawer. The same test set on-device touch slops — tap-vs-drag 14px and
> pre-hold scroll-cancel 20px on touch (10px read thumb jitter as scroll) —
> and added an interim tap "pick chip" (title · model · grade on a paper
> slip at the drawer's front edge) so taps have visible payoff until the
> Phase 3 specimen card. Where the CSS below says `mandatory`, read
> `proximity`.
>
> **Revision #2 (same session)**: even with wide slops, taps still lost to
> scrolling — iOS's own ~8px pan threshold starts the native pan (and
> cancels our pointer stream) before JS slop values are ever consulted.
> Items are now **`touch-action: none`**: painted ink always means
> select/drag; the page scrolls from wood, frame, tag, and notes. The
> §2 "swipe-on-ink scrolls" premise below is superseded — it predates
> silhouette hit-testing, which is what makes ink-owns-the-gesture viable
> (transparent regions pass through, so the drawer never becomes a
> scroll-trap).

**The owner's call, superseding the earlier proximity-snap sketch**: the page
never rests half-on/half-off the drawer. Either the drawer fills the
viewport in its entirety, or a swipe slides it up altogether and you are
on the explainer. This is the full-page section-snap pattern (fullPage.js,
Apple product pages) — and it is achievable with **native CSS mandatory
scroll snapping**, no scroll-jacking JS:

```css
html          { scroll-snap-type: y mandatory; scroll-padding-top: var(--banner-h); }
.jd-stage     { scroll-snap-align: start; scroll-snap-stop: always; }
.jd-notes     { scroll-snap-align: start; }
.site-footer  { scroll-snap-align: end; }   /* scoped to this page; see note */
```

How each piece earns its line:

- **`mandatory` on the root** makes every resting position a snap position:
  drawer-top or notes-top. A sub-threshold swipe springs back to the full
  drawer; a decisive swipe commits a whole-viewport flip — which is exactly
  the requested all-or-nothing, and it inherits the platform's own fling
  physics instead of imitating them.
- **`scroll-snap-stop: always` on the stage** prevents a hard fling from
  skipping past the notes-top landing.
- **The tall notes section scrolls freely inside itself** — per the CSS
  spec, a snap area *larger than the snapport* permits any scroll position
  while it covers the viewport, so mandatory snapping does not fight
  reading the long field-notes column. This is the standard-compliant
  behavior in current Safari and Chrome, but it is the one spec subtlety
  the whole design leans on → **verify first on real hardware in
  `mockup-4-mobile-dig.html`** (gate G5).
- **The inherited site footer** sits after `.jd-notes` in the DOM (PHP
  include), outside any wrapper we control, so it needs its own snap
  alignment or mandatory snapping could make the subscribe form
  unreachable. One page-scoped rule (`.jd-page ~ footer` or equivalent
  hook — confirm the selector against `footer.php`'s actual markup) gives
  the document end a valid rest position. This is a mockup-4 checklist
  item, not an afterthought.
- **`scroll-padding-top: var(--banner-h)`** makes both sections snap to
  just below the fixed banner rather than underneath it.
- **Desktop is exempt**: mandatory snap is applied inside the
  `(max-width: 768px)` / coarse-pointer queries only. Wheel + mandatory
  snap on desktop is the scroll-jacked feel people hate; the desktop page
  keeps normal scrolling (dek above the drawer, text below). If the owner
  likes the mobile feel enough to want it on desktop, it's the same three
  lines unguarded — a G5 follow-up question, default no.

Interplay with the dig gesture: unchanged and actually cleaner. Swipe
anywhere (items included, `pan-y`) → whole-page flip; hold-to-grip →
dig, with the gripped item's `preventDefault()` pinning the page exactly
as before. The all-or-nothing model *removes* the proximity caveat about
timid swipes — springing back to the full drawer is now the intended
behavior, not a mitigated annoyance.

### Fallback affordance: the evidence-tag scroll cue

- **Scroll cue**: a small paper tag pinned bottom-center *on the drawer's bottom frame band* (which is already non-item space — zero height cost, honoring "as much viewport as possible"): mono caps, `FIELD NOTES ↓`, styled like a manila tag tucked under the drawer's front wall. Tapping it `scrollIntoView({behavior:'smooth'})`s the notes — with mandatory snap, it lands crisply on the notes-top position. It is visible at first paint, so "there is more below" is communicated even to a user who never swipes. Its twin at the top of the notes (`THE DRAWER ↑`, alongside the "press & hold to rummage" caption) makes the flip symmetric.
- **Containment**: the bottom sheet's scrollable region gets `overscroll-behavior: contain` (rubric overscroll must not chain-scroll the page behind the scrim); the scrim gets `touch-action: none`. The page root keeps default overscroll (native rubber-banding is part of feeling like a normal page).

---

## 3. Below the fold: the field notes

One `.content-frame` column (max-width `--max-narrow`, 600 px), entirely in site voice — Courier Prime mono chrome, hairline rules, `--plot-red` accents, paper white. Order:

1. **The wall label**: title (`THE JUNK DRAWER`), one-line dek, and a live line set from the manifest — item count and date range ("31 items · 2026–…"). On desktop this dek appears *above* the drawer (`.jd-dek`, `display: none` at ≤768 px); on mobile everything explanatory is below, per the requirement — one DOM, one hidden element, no duplication.
2. **Intro**: two or three short paragraphs — what this is, how the SVGs are made, why they're graded like eval output.
3. **How to read the grades** — *taxonomy-driven, never hardcoded*: rendered from the `taxonomy` block of `data.php` (PLAN-BACKEND §7 guarantee 1). The grade scale in `rank` order, each grade shown as a small red-pencil stamp with its label and description; then the axes list (label + description). Because it renders from data, a taxonomy edit updates the legend with no frontend change. This section doubles as the plain-text explanation of the entire conceit.
4. **The inventory**: a plain mono list built from the already-fetched manifest — one line per item: title (a link to `#<id>`, which opens its specimen card), primary model, overall grade. This is cheap, it is the **non-gestural access path to every item** (screen readers, motor-impaired users, and search engines never need to dig), and it makes every item shareable from the page.
5. **Colophon**: how it's built, links to `/art/` siblings, and the kolob-style version · build-hash · deployed stamp.
6. **`↑ BACK INTO THE DRAWER`** — smooth-scroll to top. Then the inherited site footer (subscribe form), untouched.

---

## 4. Mobile interaction tuning

### Touch targets vs. tiny items

On a ~320 px-wide well, PLAN-FRONTEND §2's `s` band (7–11% of well min-dimension) yields 22–35 px items — under the 44 px minimum. Three stacked fixes, all in `jd-pile.js`/`jd-dig.js`, none touching the data contract:

1. **Form-factor size bands**: when well min-dimension < 480 px, shift the bands up — `s` 9–13%, `m` 14–20%, `l` 20–27% (→ `s` ≈ 29–42 px on a 320 px well). Same manifest, same normalized coordinates; only the class→footprint constants are conditional. Simultaneously drop the overlap allowance 40% → 30% on small wells so clumps stay readable.
2. **Tap forgiveness (replaces the earlier `::after` box-inflation idea)**: hit-testing is silhouette-accurate per PLAN-FRONTEND §3 (decided 2026-07-26), so a box-inflating `::after` would reintroduce exactly the transparent-corner steal it fixed. Instead, forgiveness lives in JS: on a tap that hits no painted ink, search items whose *painted silhouette* is within ~24 px of the touch point and open the nearest (ties → higher z, matching what the eye assumes it touched). Applied to taps only, never to drag starts. This also compensates thin-stroke items (paperclip wire, scissors blades) whose silhouettes are precise targets.

### The bottom sheet, specified

Confirming PLAN-FRONTEND §4's mobile placement, with the states pinned down:

- **Peek** (opens here): height 232 px + `env(safe-area-inset-bottom)`. Contents: drag handle, title, model + `ONE-SHOT`/`REFINED ×N` chips, the overall-grade stamp, and the alternatives strip. The lifted SVG floats large in the remaining ~55–60 svh above, over the dimmed drawer.
- **Full**: sheet top at ~32 svh from the viewport top; the lifted SVG scales down and rides above it like a specimen pinned over its paperwork. Contents add the verbatim prompt block and the full rubric, in an inner scroll region (`overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y`).
- **Gestures**: handle/header `touch-action: none`; drag up → full, drag down → peek, down again (or scrim tap) → close, item animates back into the pile. Escape and the close affordance work as on desktop.
- **Swipe between alternatives — yes, build it**: horizontal swipe ≥ 40 px on the lifted-SVG zone flips prev/next response (rendered from `responses[]`, prompt fixed, card fields swapping — per PLAN-FRONTEND §4), with the strip highlight tracking. Same-pixels flip-through is the comparison design *and* the single best demo moment on a phone. Ends stop with a small rubber nudge; no wraparound.
- **Back button**: opening a card does `history.pushState` with `#<id>`; `popstate` closes it. On Android, the hardware back closing the card instead of leaving the site is the difference between "web page" and "app-grade." Closing via UI calls `history.back()` to stay symmetric. Guard: item DOM elements use `data-id`, **not** `id`, so loading with a hash never triggers the browser's native scroll-to-fragment jump.

### Hover-dependent features

- Hover lift: already mouse-only; wrap all `:hover` motion in `@media (hover: hover)` so touch never gets sticky-hover.
- Hover micro-tag / manila tooltip (Phase 3+): **desktop-only, no mobile equivalent needed** — on touch, the grip-lift animation plays the "this is alive" role and the tap goes straight to the full card.

### Performance for mid-range phones

- **Everything is above the fold on mobile** — a full-viewport drawer means `loading="lazy"` does nothing here. Accept the up-front decode (dozens of small SVGs is cheap), add `decoding="async"`, and keep z-top-first request priority for perceived order.
- **Drop-shadow budget**: settled-item shadows on mobile use one small-radius `drop-shadow` (~`2px 3px 2px`), no stacked shadows; animate `filter` only on the single gripped item with `will-change` applied at grip and removed at settle (as planned). Practical ceiling: ~60 filtered items on a mid-range Android before the Phase 4 canvas-snapshot escape hatch (PLAN-FRONTEND §6) gets measured — not built speculatively.
- **Overlay layers**: full-viewport blend-mode layers are the other mobile cost. Craquelure sits BELOW the items and covers drawer surfaces only (G2 resolved 2026-07-26 — never over the items); **bake the vignette into the frame painting** instead of a separate layer (one fewer full-screen composite for free, on all form factors); the varnish-sheen layer is first against the wall if the Phase 0 device test shows compositing jank at ≤768 px.
- All motion `transform`/`opacity` only; well geometry computed once per resize (and with `svh` sizing, mobile resizes are rare — orientation change only).

---

## 5. Demo-readiness

The scenario: owner pulls out phone on cellular, taps the link, hands the phone over.

- **First-load budget** (target ≤ ~450 KB before item SVGs): mobile frame WebP ~1200 px long side, quality-tuned to ≈ 100–140 KB; well tile ≤ 60 KB; craquelure tile ≤ 40 KB; CSS+JS ≤ 40 KB (vanilla, unminified, small); manifest a few KB for dozens of items; items ~5–30 KB each trickling in. Comfortably interactive inside ~1–2 s on LTE. Kick the manifest fetch off early — an inline `window.JD_dataPromise = fetch('data.php')` snippet in `index.php` right after the CSS link, so data races the images instead of waiting for script parse.
- **Loading state — the pour-in, yes**: the painted drawer (frame + empty shaded well) renders from CSS the moment images land, standing alone as a coherent image; when the manifest resolves, items appear bottom-of-pile-first with a staggered micro-settle (scale 1.06→1, shadow tightening; stagger `min(20ms, 1200/N)` so the whole pour caps at ~1.2 s). The loading state *is* the reveal — no spinner, no skeleton. Manifest failure: empty drawer + a small mono note in the well ("the drawer is stuck — pull again"), with a retry.
- **OG/share metadata**: `$page_image` = a 1200×630 crop of the finished drawer shot from above, hero items visible — texting the link must look like a painting, not a screenshot of UI. Set via the existing `header.php` contract in Phase 3 as planned. Known limit, accepted: `#<id>` deep links share the page-level OG image (fragments never reach the server); fine.
- **Add-to-home-screen**: **skip**. `header.php` closes `</head>` before page code runs, so per-page `apple-touch-icon`/`theme-color`/manifest tags can't be added non-hackily; site-wide icons are a site decision, not this project's. No service worker — the collection updates on every push and an offline drawer serves no one; a SW here is pure liability. This is the "IF cheap" test failing, honestly.
- **Demo path latency**: first tap → card opens with zero network wait (the pile's `<img>` is already decoded; the card reuses it). Alternatives' SVGs are fetched when a card opens, not before — the flip-through is warmed by the time a human finishes reading the header.

---

## 6. Concrete deltas to PLAN-FRONTEND.md

**§1 Rendering the drawer**
- **Confirmed**: frame-kit recommendation, wall/well structure, lighting stack, asset approach.
- **Amended**: gate **G1 is resolved by the mobile requirement** — the frame kit wins (a fixed-aspect hero cannot fill a portrait viewport); the fixed-aspect mockup is optional/desktop-curiosity. Add the `--jd-frame-url` custom-property swap for a ~1200 px mobile frame image. Bake the vignette into the frame painting (drop it as a separate layer everywhere); flag the varnish layer as droppable at ≤768 px pending device profiling. Wall bands: `border-width: clamp(28px, 9vw, 64px)`.
- **Added**: `.jd-stage` sizing — full-bleed margin trick + `calc(100svh - var(--banner-h))` with `100vh` fallback, `min-height: 420px` (300 px in phone-landscape). Explicitly not `dvh` (geometry stability); banner offset via `var(--banner-h)`, never a pixel literal.

**§2 The pile**
- **Confirmed**: id-derived deterministic placement, normalized well-space, density field, settle pass, `placement` overrides — all unchanged; desktop and phone remain the same pile re-poured.
- **Amended**: sizeClass→footprint constants become form-factor-conditional (well min-dim < 480 px: `s` 9–13%, `m` 14–20%, `l` 20–27%; overlap cap 30%). Note added: on mobile all items are in-viewport, so `loading="lazy"` is inert there — rely on `decoding="async"` + z-priority.

**§3 Digging interaction**
- **Amended (the crux)**: item touch rule changes from `touch-action: none` to **`touch-action: pan-y` + hold-to-grip (~180 ms, 10 px touch slop, non-passive `touchmove` `preventDefault` once gripped, touch-pointer only)**. Vertical swipes scroll from anywhere; wood/frame still scroll natively; the grip's lift animation is the acknowledgment; `navigator.vibrate(8)` on grip. Add `-webkit-touch-callout/user-drag/user-select` suppression + `draggable="false"`.
- **Added**: silhouette-aware 24 px tap-forgiveness (taps only; no box inflation — see PLAN-FRONTEND §3 hit-testing); the bottom-frame `FIELD NOTES ↓` evidence-tag cue (+ `THE DRAWER ↑` twin atop the notes); **all-or-nothing full-page snap** — `html { scroll-snap-type: y mandatory }` (mobile only) with drawer and notes as whole-viewport snap sections, `scroll-snap-stop: always` on the stage, `scroll-padding-top: var(--banner-h)`, and an end-alignment rest position for the inherited footer (owner directive; see §2).
- **Confirmed**: slop-based tap/drag split, session-only mess persistence, keyboard/a11y model, reduced-motion, deferred physics — unchanged. Hover styles now explicitly gated `@media (hover: hover)`.

**§4 Specimen card**
- **Confirmed**: bottom-sheet-on-mobile, lift-out over dimmed drawer, taxonomy-driven rubric, flip-in-place alternatives, deep links.
- **Amended/specified**: two detents (peek 232 px + safe-area; full at ~32 svh top), handle `touch-action: none`, content `pan-y` + `overscroll-behavior: contain`, scrim `touch-action: none`; horizontal swipe (≥40 px) on the lifted SVG flips alternatives; `pushState`/`popstate` so Android back closes the card; items carry `data-id` not `id` (fragment-scroll guard); phone-landscape uses the desktop overlay layout. Hover micro-tag confirmed desktop-only with no mobile substitute.

**§5 Data contract**
- **Zero changes.** Nothing above requires anything from the backend. Reconciliation note: PLAN-FRONTEND §5 sketches a `data/items.json` shape; PLAN-BACKEND §7 supersedes it (`data.php`, `items[].responses[]` + `primary`, taxonomy block, guarantee list). This plan is written against §7; the frontend plan's fetch/validation module should be too.

**§6 Phasing**
- **Added to Phase 0**: **`mockup-4-mobile-dig.html`** — a standalone page with the svh-sized frame-kit drawer, ~10 placeholder items, the full gesture stack (pan-y items, hold-to-grip, mandatory full-page snap, cue tags) and a skeleton two-detent bottom sheet, exercised **on the owner's actual phone via a push to `main`** (mockups deploy; the real-device loop is push → reload). Phase 0 is exactly when the scroll-conflict risk dies.
- **Added owner gate G5**: on-device verdicts for (a) grip hold duration feel (150/180/250 ms variants in the mockup), (b) the mandatory-snap checklist — free scrolling *inside* the tall notes section behaves per spec on the owner's actual iOS/Android browsers, the footer/subscribe form is reachable, and the flip feel is right (with "extend all-or-nothing to desktop?" as a follow-up question, default no), (c) craquelure+varnish compositing cost on the owner's phone.
- **Amended acceptance criteria**: Phase 1's "works on a phone" hardens to *the full-viewport drawer + swipe-scroll-to-notes works on a phone*; Phase 3's deliverable explicitly includes the bottom sheet at parity with the desktop overlay (not a trailing adaptation) plus the OG share image; the below-fold field-notes sections (intro, taxonomy legend, inventory, colophon) land in Phase 1 as static-plus-data-driven content since they are the scroll destination the gesture design depends on.

### Critical Files for Implementation

- /Users/tysonwelsh/Sites/municipal-sky-site/art/junk-drawer/PLAN-FRONTEND.md — the plan these deltas amend, section by section
- /Users/tysonwelsh/Sites/municipal-sky-site/art/junk-drawer/PLAN-BACKEND.md — §7 is the untouched data contract everything renders from
- /Users/tysonwelsh/Sites/municipal-sky-site/css/style.css — banner height tokens (`--banner-h-mobile: 48px`), 768 px breakpoint, hover/coarse-pointer conventions, and the design tokens for the field notes
- /Users/tysonwelsh/Sites/municipal-sky-site/includes/header.php — the fixed banner and `$page_title/$page_description/$page_image` OG contract the page must satisfy

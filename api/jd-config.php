<?php
// Junk Drawer — the shared runtime every jd-* endpoint includes.
// Contracts: PLAN-USER-PROMPTS-CONTRACTS.md C4 (harness), C6 (dev mode).
//
// Sections, in order:
//   1. environment, harness, model pool, limits            (constants)
//   2. secrets + the database handle                       (jd_secrets, jd_db, …)
//   3. ids, timestamps                                     (jd_ulid, jd_now, …)
//   4. responses and request parsing                       (jd_json_out, jd_fail, …)
//   5. the bench gate                                      (jd_bench_keyed, …)
//   6. database error classification + schema probes      (jd_missing_table, …)
//   7. taxonomy access                                     (jd_taxonomy, jd_live_axes, …)
//   8. the ratings fold                                    (jd_fold_ratings, jd_pick_rating, …)
//   9. SVG extraction                                      (jd_extract_svg)
//
// Include-only: this file emits no output and starts no session. No cookies,
// no PHP sessions anywhere in this feature (APP §4.3) — msky_visitor_hash()
// is the only server-side identity.

// Warnings must never land inside a JSON body; they go to the error log.
ini_set('display_errors', '0');

// ---------------------------------------------------------------------------
// C6.1 — environment gate
//
// JD_DEV_MODE cannot become true on Bluehost: the production secrets file
// exists by definition there (database.php loads it on every request), so
// JD_IS_PRODUCTION short-circuits the && before the env var is consulted.
// The env var is a second, independent opt-in that shared hosting cannot set.
define('JD_IS_PRODUCTION', is_readable('/home1/tdrivemy/private_config/secrets.php'));
define('JD_DEV_MODE', !JD_IS_PRODUCTION && getenv('JD_DEV_MOCK') === '1');

// ---------------------------------------------------------------------------
// C4.1 — harness v5 (2026-10-03): the owner's settled drawing prompt. This
// constant IS the harness: any edit to these bytes requires bumping EVERY id
// in JD_HARNESS_BY_PROFILE below (JD_HARNESS is the web one: 'v5-web.1'),
// because responses drawn to different briefs are never pooled.
//
// THE PROSE IS THE OWNER'S. Its source of truth, and the reason for every
// sentence (the change log), is art/junk-drawer/PLAN-DRAWING-PROMPT.md §2
// (gitignored; the main checkout). The heredoc is §2's fenced block byte for
// byte, line breaks included — edit it there first, then here, and prove it:
//   diff <(php -r 'require "api/jd-config.php"; echo JD_SYSTEM_PROMPT;') \
//        <(printf '%s' "$(awk '/^## 2\./{f=1} f&&/^```/{c++; if(c==2) exit; next} f&&c==1' \
//          art/junk-drawer/PLAN-DRAWING-PROMPT.md)")
// What v5 changed from v4, the owner's reasons, one line each:
//   - figure/ground throughout: "draw the figure and never the ground".
//   - "transparent background" defined: nothing drawn behind the figure.
//   - a backdrop of any kind is setting: rectangle, panel, paper, texture or
//     colour field, solid or translucent (v4 forbade only an OPAQUE rectangle).
//   - the additions list: no caption, title, label, watermark, signature,
//     seal, or unspecified decorative shapes floating around the subject.
//   - a picture-bearing object's surface and its printed words are the object.
//   - style from the brief; where it names none, a suitable one, committed to.
//   - margin tolerance ~2% → ~3%.
// The model's own <title>/<desc> are not the prompt's business: the sanitizer
// strips them from the served drawing (normalized `title_desc_stripped`).
const JD_SYSTEM_PROMPT = <<<'JD_PROMPT'
The agent has the enviable job of generating SVG vector art. The user's
message is a creative brief. Generate an SVG image that satisfies the
brief, and reply with the SVG document alone. Take the style from the
brief; where the brief names none, choose a suitable style and commit to
it.

Output a single complete SVG document and nothing else - no prose, no
code fences. Requirements: xmlns and a viewBox on the root; the artwork
must fill the viewBox edge to edge (at most ~3% margin - no empty space
around the subject); a transparent background, meaning nothing drawn
behind the subject - the space outside the subject's own figure stays
empty; fully self-contained (no external references, no <script>, no
event attributes, no <foreignObject>, no raster images).

The subject stands alone. Assume each drawing is a standalone element
that will be placed into someone else's layout, so draw the figure and
never the ground. A ship means the ship alone - no water, no sky, no
horizon, no birds. No ground plane, no cast shadow pooled beneath it, no
vignette, no frame, and no backdrop behind the subject of any kind - not
a rectangle, a panel, a sheet of paper, a texture or a colour field,
whether solid or translucent; a backdrop is setting too. Add nothing the
brief did not ask for: no caption, title, label, watermark, signature,
seal, or unspecified decorative shapes floating in the space around the
subject.

What is structurally part of the subject stays (sails and rigging are the
ship); the setting it would occupy does not. Where the subject's edge is
genuinely unclear, keep what a designer would need and leave out the
rest. If the brief explicitly asks for a setting, follow the brief. (A
picture-bearing object is the one case where a background belongs - see
the next paragraph.)

When the subject is itself a picture-bearing object - a photograph, a
tarot card, a poster, a stamp, a print, a screen - everything inside its
own edges is the subject: the paper or card itself, the depicted scene,
that scene's own background and sky, and any words printed on it. Those
are not a backdrop or a caption; they are the object. The surface the
picture lives on - the paper, card, canvas, foil, glass or screen - is
part of the figure, not the ground, and belongs in the drawing. The
ground to leave out is only what lies outside the object described in the
prompt: the table it rests on, the wall behind it.
JD_PROMPT;

// JD_HARNESS — the visitor turn's harness id — is defined with the profiles,
// after JD_HARNESS_BY_PROFILE below: it IS the web profile's id.

// ---------------------------------------------------------------------------
// EFFORT PROFILES — the reasoning condition, named and versioned.
//
// The visitor turn and a benchmark rerun want opposite things. A visitor is
// watching a loading animation inside JD_PROVIDER_TIMEOUT, so the web profile
// buys latency with thinking. A benchmark wants each model thinking at a
// chosen setting and does not care if that takes minutes. Both are
// legitimate; what is NOT legitimate is pooling their results, so each
// profile carries its own harness id and every generation records which one
// produced it.
//
// THE OWNER'S PROFILES (2026-10-02). There are three, so the owner can compare
// thinking settings on the same prompts:
//   bench-low     every vendor's low setting
//   bench-medium  every vendor's medium setting — THE OWNER'S DEFAULT
//                 (owner, 2026-10-02: "not all the way to the bottom, but we
//                 don't need high either — goldilocks"); jd2-config.php's
//                 JD2_OWNER_DEFAULT_PROFILE
//   bench-max     every vendor's top documented setting (the old `bench`;
//                 OpenAI's top accepted rung became `xhigh` with GPT-6
//                 Astra, v4-bench.5)
// The bare word `bench` is no longer a profile. On the wire (jd2-generate's
// `profile`, from an older client) it means "the server's default owner
// profile"; in jd2_runs it is the retired pre-split profile, stored on the
// runs filed before 2026-10-02 under harness v4-bench.3 (max effort, the
// 12000-token budget that starved two of the four models — below).
//
// The vendor values, verified against each vendor's docs on 2026-10-02 and
// re-verified for the pool refresh the same day (taxonomy poolVersion
// pool-2026-10-02; every cell proved live by scripts/jd2-profile-probe.php):
//   Anthropic Opus 5.5 output_config.effort low|medium|high|xhigh|max, default
//                      medium. Thinking is ALWAYS on: `thinking: {type:
//                      'disabled'}` is a 400 at every effort on this model, so
//                      no `thinking` key is sent on ANY profile, web included;
//                      effort is the only control.
//   OpenAI gpt-6-astra reasoning_effort low|medium|high|xhigh|max (Chat
//                      Completions spelling; developers.openai.com/api/docs/
//                      models/gpt-6-astra). No `none` rung on this model.
//                      BUT the Chat Completions endpoint this layer calls
//                      refuses `max`: probed 2026-10-02, HTTP 400
//                      unsupported_value, "'reasoning_effort' does not support
//                      'max' with this model. Supported values are: 'low',
//                      'medium', 'high', and 'xhigh'." So the top rung we can
//                      send is `xhigh`, and bench-max sends it (it sent
//                      `high`, GPT-5.1's top, under v4-bench.4).
//   Moonshot kimi-k3   reasoning_effort low|high|max, default max
//                      (platform.kimi.ai/docs/api/chat). There is NO medium:
//                      bench-medium sends `high`, the middle rung of K3's
//                      three, and bench-max sends `max` (the pre-split bench
//                      sent `high`, which was not K3's top).
//   Google 3.1 Pro     thinkingLevel low|medium|high, default high (no
//                      minimal on 3.1 Pro; ai.google.dev/gemini-api/docs/thinking)
//
// APPLES TO APPLES, HONESTLY: these knobs are NOT calibrated against each
// other. Anthropic's effort, OpenAI's and Moonshot's reasoning_effort, and
// Google's thinkingLevel are vendor-defined ordinals over different
// mechanisms — "medium" on one is not "medium" on another, and no published
// mapping exists. A bench profile therefore does not claim equal compute. It
// claims a uniform CONDITION — every model at the named rung of its vendor's
// documented ladder — and relies on jd-usage.php's reasoning-token
// normalisation to make the actual spend visible per generation, so the
// asymmetry lands in the data instead of hiding in this file.
//
// What IS genuinely equalised across the four: the system prompt (byte
// identical), the user prompt, the profile's output budget
// (JD_MAX_TOKENS_BY_PROFILE), provider-default sampling (forced — Opus 5 and
// Opus 5.5 reject temperature outright), and pair_order slot randomisation.
//
// THE WEB PROFILE SINCE v4-web.4 (pool refresh, 2026-10-02): every vendor at
// its LOW rung, thinking on everywhere. Two changes from v4-web.3:
//   - anthropic: `thinking: {type: 'disabled'}` became `output_config.effort
//     low`. Forced: Opus 5.5 answers 400 to disabled thinking at every
//     effort. It also retires the old web flaw that thinking-off Opus could
//     leak <thinking> tags into the visible answer.
//   - openai: sends `reasoning_effort: 'low'` (v4-web.3 sent nothing, so
//     GPT-5.1 ran at its vendor default `none` while the other three were
//     explicitly throttled — the KNOWN FLAW this comment used to carry; the
//     harness bump was the moment to fix it).
// So web now equals bench-low's rungs with the visitor's 12000 budget and
// timeout. v4-web.3 and v4-web.4 are NOT pooled.
const JD_EFFORT = [
    'web' => [
        // Opus 5.5 cannot disable thinking (400); its cheapest, fastest
        // setting is effort low with thinking on.
        'anthropic' => ['output_config' => ['effort' => 'low']],
        'openai'    => ['reasoning_effort' => 'low'],
        'kimi'      => ['reasoning_effort' => 'low'],
        'google'    => ['thinking_level' => 'low'],
    ],
    // budget_tokens is REMOVED on Opus 5 and 5.5 (400). Effort is
    // output_config; thinking stays on — no thinking key on any row.
    'bench-max' => [
        'anthropic' => ['output_config' => ['effort' => 'max']],
        'openai'    => ['reasoning_effort' => 'xhigh'],  // GPT-6 Astra's top rung on Chat Completions ('max' is a 400; was 'high', GPT-5.1's)
        'kimi'      => ['reasoning_effort' => 'max'],
        'google'    => ['thinking_level' => 'high'],
    ],
    'bench-medium' => [
        'anthropic' => ['output_config' => ['effort' => 'medium']],
        'openai'    => ['reasoning_effort' => 'medium'],
        'kimi'      => ['reasoning_effort' => 'high'],   // K3 has no medium: its middle rung
        'google'    => ['thinking_level' => 'medium'],
    ],
    'bench-low' => [
        'anthropic' => ['output_config' => ['effort' => 'low']],
        'openai'    => ['reasoning_effort' => 'low'],
        'kimi'      => ['reasoning_effort' => 'low'],
        'google'    => ['thinking_level' => 'low'],
    ],
];

// THE OUTPUT BUDGET, per profile (2026-10-02). On every provider in the pool
// the one output cap covers thinking AND the answer: Anthropic's max_tokens
// is "a hard cap on thinking plus response text"; OpenAI bills reasoning as
// output inside max_completion_tokens; Gemini's maxOutputTokens "includes
// thought tokens"; Kimi's completion count carries its reasoning. The first
// live batch at the pre-split bench profile (12000 for everything) proved
// it: Opus 5 at effort max stopped at max_tokens with 12000 output tokens,
// every one of them thinking, and no text; Gemini 3.1 Pro at thinking_level
// high was cut off ~1.3 KB into its SVG. A budget a thinking model can spend
// before it starts drawing is a budget that fails correlated with the model
// under study.
//
// So the bench profiles get 64000: the largest single number every pool
// model accepts. The binding cap is Gemini 3.1 Pro's 65,536 output tokens
// (ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview); Opus 5.5 and
// GPT-6 Astra allow 128,000 (as Opus 5 and GPT-5.1 did), Kimi K3 far more. The whole pool gets the same
// number, deliberately (same argument as JD_PROVIDER_TIMEOUT). OpenAI's own
// guidance is to reserve at least 25,000 for reasoning and output. The budget
// is a ceiling, not a target: it is spent only when a model thinks that long,
// and jd-usage.php prices what was actually spent.
//
// web stays 12000 — the visitor's budget (the web profile thinks at every
// vendor's low rung; the pool-refresh probe finished every web cell inside it). JD_MAX_TOKENS is kept as its alias for every
// pre-existing reader (scripts/jd-cost-probe.php, v1).
const JD_MAX_TOKENS_BY_PROFILE = [
    'web'          => 12000,
    'bench-max'    => 64000,
    'bench-medium' => 64000,
    'bench-low'    => 64000,
];

// Prompt generation v4 (2026-08-21): the figure-not-ground clause. Revision .2
// dropped the words "CLIP ART" — naming a genre imported its whole visual
// style (flat, simplified, mid-90s) into drawings whose style is supposed to
// come from the brief alone. Same requirement, stated as purpose and
// prohibition instead of as a category (owner catch, 2026-08-21).
// The system prompt is shared by every profile, so a prompt edit moves ALL.
// Everything generated before this stays under v3-web.1 and is permanently
// distinguishable — those 77 responses were drawn to a different brief.
// v4-*.3 (owner catch, 2026-08-30): "draw the figure, never the ground" was
// reading too far on picture-bearing subjects — a tarot card came back with
// the card's own face left blank, its printed scene mistaken for background.
// The prompt now says where the object's edge is: everything inside it is
// the subject, and the ground is only what lies outside.
// v4-bench.4 (2026-10-02): the max-effort profile, renamed bench-max, with
// the 64000 budget (was 12000) and Kimi at reasoning_effort max (was high).
// Its bytes and parameters changed, so runs under v4-bench.3 (the retired
// `bench`) and v4-bench.4 are NOT pooled. v4-benchmed.1 and v4-benchlow.1 are
// the medium and low profiles, new the same day; the three bench harnesses
// are never pooled with each other either — comparing them is the point.
// v4-web.4 (2026-10-02, the pool refresh): the web profile's PARAMETERS
// changed (the prompt bytes did not) — Anthropic `thinking: disabled` became
// `output_config.effort: low` (Opus 5.5 rejects disabled thinking at every
// effort) and OpenAI gained `reasoning_effort: low` (it sent nothing). See
// the web profile's note above JD_EFFORT. Runs under v4-web.3 and v4-web.4
// are NOT pooled. The bench harness ids do not move: their parameters are
// unchanged, and the new models are told apart by pool_version
// (pool-2026-10-02), not by harness — except bench-max, below.
// v4-bench.5 (2026-10-02, the pool refresh; owner's call): bench-max is
// "every vendor's top documented setting", and GPT-6 Astra goes above
// GPT-5.1's top rung (`high`). Its docs list `max`, but Chat Completions
// answers 400 to `max` and accepts `xhigh` (probed 2026-10-02), so OpenAI's
// bench-max parameter changed from `high` to `xhigh` — the top rung the
// endpoint accepts. Nothing was generated under v4-bench.4 with this
// pool. v4-bench.4 and v4-bench.5 are NOT pooled. bench-medium and bench-low
// keep their ids: their parameters did not change.
// v5-* (2026-10-03): the owner's settled drawing prompt (the note at
// JD_SYSTEM_PROMPT). The bytes changed, so EVERY profile's id moves:
// v4-web.4 → v5-web.1, v4-benchlow.1 → v5-benchlow.1, v4-benchmed.1 →
// v5-benchmed.1, v4-bench.5 → v5-bench.1. The parameters (JD_EFFORT, the
// budgets, the timeouts) are unchanged; only the brief differs. Runs under
// v4-* and v5-* are NEVER pooled: they were drawn to different briefs.
const JD_HARNESS_BY_PROFILE = [
    'web'          => 'v5-web.1',
    'bench-max'    => 'v5-bench.1',
    'bench-medium' => 'v5-benchmed.1',
    'bench-low'    => 'v5-benchlow.1',
];

// The harness id jd-generate.php stamps on every visitor turn's generations —
// the web profile's, so the two can never disagree.
const JD_HARNESS = JD_HARNESS_BY_PROFILE['web'];

// The web profile's output budget, for every reader that predates the
// per-profile table (jd_max_tokens() is the per-profile reader).
const JD_MAX_TOKENS = JD_MAX_TOKENS_BY_PROFILE['web'];

// A benchmark run is not on a visitor's clock. CLI has no max_execution_time,
// so this is the only ceiling — generous enough for a thinking model at max
// effort (kimi at DEFAULT effort was observed past 280s). Every bench-*
// profile gets it (jd_profile_timeout).
const JD_BENCH_TIMEOUT = 900;

/** Is $profile one the provider layer can draw under (a JD_EFFORT key)? */
function jd_profile_known(string $profile): bool
{
    return isset(JD_EFFORT[$profile]);
}

function jd_effort(string $provider, string $profile): array
{
    return JD_EFFORT[$profile][$provider] ?? [];
}

function jd_harness(string $profile): string
{
    return JD_HARNESS_BY_PROFILE[$profile] ?? JD_HARNESS;
}

/** The profile's output budget (thinking + answer); the web budget for an unknown one. */
function jd_max_tokens(string $profile): int
{
    return JD_MAX_TOKENS_BY_PROFILE[$profile] ?? JD_MAX_TOKENS;
}

/** The wire timeout: a visitor's clock on web, the bench ceiling on every bench-* profile. */
function jd_profile_timeout(string $profile): int
{
    return $profile === 'web' ? JD_PROVIDER_TIMEOUT : JD_BENCH_TIMEOUT;
}

// HISTORY, NOT THE POOL. Dataset v2 reads the pool from taxonomy.json
// (`models[]` with `pool: true`, through jd2_pool() in jd2-config.php) and
// stamps `poolVersion` on every run. This constant is read only by the v1
// visitor endpoint jd-generate.php, which is frozen (JD_V1_FROZEN) and never
// generates, so it is left as v1 knew it: the pool-2026-08-14 cast. It was
// deliberately NOT updated in the 2026-10-02 pool refresh.
//
// C4.2 — all four pool entries draw every turn: the slot→model assignment
// is chosen per submission by pair_order (0-23, an index into JD_DRAW_PERMS)
// and recorded; the model_id values are taxonomy.json `models` registry ids
// (join keys) and api_model is the exact wire string. Owner runbook: confirm
// wire strings against the providers' model lists at deploy.
const JD_MODEL_POOL = [
    // Owner upgrade (2026-08-10): flagship tier — Claude Opus 5 vs GPT-5.1.
    // Opus 5 note: thinking is ON by default on this model; jd-generate
    // sends thinking:disabled (valid at default effort) so generation stays
    // single-pass inside JD_PROVIDER_TIMEOUT on shared hosting.
    ['model_id'  => 'claude-opus-5',
     'api_model' => 'claude-opus-5',
     'provider'  => 'anthropic'],
    ['model_id'  => 'gpt-5-1',
     'api_model' => 'gpt-5.1',
     'provider'  => 'openai'],
    // Third chair (2026-08-14): Kimi K3 joins every turn (slot c). Wire id
    // confirmed against /v1/models the same day. kimi-k3 reasons by default
    // (~25 tok/s observed; an SVG at default effort ran past 280s), so
    // jd-generate sends reasoning_effort:'low' — the same trade the Opus
    // entry makes with thinking:disabled, and recorded in params the same
    // way. Probed 2026-08-14: effort 'low' answered a paperclip SVG in 7s.
    ['model_id'  => 'kimi-k3',
     'api_model' => 'kimi-k3',
     'provider'  => 'kimi'],
    // Fourth chair (2026-08-14): Gemini joins the pool. First wired as
    // 3.7-flash because the owner's key was free tier (pro answered 429
    // limit:0); the owner moved the key to a paid plan the same day and the
    // chair became 3.1-pro (probed: a keyhole SVG in 15.5s at thinkingLevel
    // 'low'). api_model is the pinned preview id — 'gemini-pro-latest'
    // would shift under the eval. thinkingLevel 'low' is the same trade the
    // Opus and Kimi entries make. Gemini wraps the SVG in code fences
    // despite the system prompt; jd_extract_svg strips them and the
    // disobedience flag records it.
    ['model_id'  => 'gemini-3-1-pro',
     'api_model' => 'gemini-3.1-pro-preview',
     'provider'  => 'google'],
];

// The 24 slot permutations of the 4-entry pool, indexed by pair_order:
// which POOL entry serves slot a, then b, then c, then d. Same anti-bias
// discipline as the pair shuffle — model identity must never correlate
// with slot position. (pair_order was 0-5 for the trio earlier the same
// day, then 0-23 as ordered draws of 3 from 4 for a few hours — owner
// call, 2026-08-14: every chair draws every turn, no sit-outs.)
const JD_DRAW_PERMS = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1],
    [0, 3, 1, 2], [0, 3, 2, 1], [1, 0, 2, 3], [1, 0, 3, 2],
    [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
    [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0],
    [2, 3, 0, 1], [2, 3, 1, 0], [3, 0, 1, 2], [3, 0, 2, 1],
    [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
];

// 150 since 2026-08-30 (owner call, raised from 90): Kimi K3 has repeatedly
// missed the old budget — the subway-rat rerun timed out at 90.0s with zero
// bytes received, and the owner has seen the same before — and a failed slot
// costs a lopsided turn plus a full re-run. The whole pool gets the same
// number, deliberately: an uneven budget would fail correlated with the model
// under study (jd-bench-run.php's own argument). The visible trade: the
// darkroom waits for the slowest slot, so a genuinely slow run can now hold
// the reveal up to ~2.5 minutes. curl wall-time doesn't count toward PHP's
// CPU-time execution limit, which is how 90 already lived on this host.
const JD_PROVIDER_TIMEOUT = 150;
const JD_PROVIDER_CONNECT_TIMEOUT = 10;

// C5.2 / APP §4.5 — the consent of record. Must match JD_CONSENT.version in
// junk-drawer.js and the copy quoted in privacy.php. jd-consent-4 (2026-08-14,
// a few hours after -3): the rotation wording ("three of which") gave way to
// the fact — all four providers draw every turn. jd-consent-5 (2026-09-10):
// the random device code the browser keeps joins the list of what is stored.
// jd-consent-6 (2026-10-01): says rated turns join the public drawer unless
// kept out, and that the visitor code is made from the IP address.
const JD_CONSENT_VERSION = 'jd-consent-6';

// C1.2 step 7 — cost controls, tunable in one place post-launch.
//
// RAISED 2026-08-18 (owner call): the owner is the only user for now and the
// re-rating backfill reruns prompts in bulk — 30 items x 4 models is 120
// generations, which the old global 100 would have stopped mid-run. The
// per-visitor caps are effectively off. THE GLOBAL CAP IS DELIBERATELY STILL
// FINITE: jd-generate.php is publicly reachable with no feature flag, and this
// number is the only thing bounding spend at four paid providers if a bot
// finds it. Lower these again when the drawer opens to the public.
//
// GLOBAL CAP LOWERED 2026-10-01 (owner call): a hard daily fail-safe of
// about 50 turns, whoever takes them, the owner included. The breaker
// counts DRAWINGS (jd_generations rows), four to a turn, so 200 is 50
// turns; it resets at midnight UTC. The per-visitor caps stay off by the
// owner's choice; the providers' own spend limits sit behind this.
//
// RAISED FOR THE CAMPAIGN 2026-10-03: the owner's 128-prompt batch is 512
// drawings in one sitting of the runner (plus a resume pass for any slot a
// bare host 503 strands), and the breaker counts the owner's drawings too.
// 560 covers it with a margin. DROP IT BACK TO 200 once the campaign batch
// has run — a line here, a commit, a push; the visitor-facing fail-safe is
// the 200.
const JD_LIMIT_HOURLY = 100000;
const JD_LIMIT_DAILY = 100000;
const JD_LIMIT_GLOBAL_DAILY = 560;   // campaign window; 200 (50 turns x 4) otherwise

// The rating bench's auth, in one switch.
//
// TRUE since 2026-09-05 (owner call: admin mode). It was FALSE from
// 2026-08-18 — the owner, effectively the only visitor, wanted to open the
// link and rate, and the bench endpoints ran unauthenticated. Now that admin
// mode can REWRITE the ratings the drawer shows, the gate is on: every
// curator endpoint wants jd_bench_key (falling back to jd_setup_key) in
// X-Bench-Key or ?key=. A box with NO key on file (a dev checkout without
// config/secrets.php) stays open so the harness runs keyless; production
// without a key is shut, never open. Wrong keys are throttled per address —
// see jd_require_bench_key.
const JD_BENCH_REQUIRE_KEY = true;

// THE v1 FREEZE SWITCH (Junk Drawer v2, Phase 3a, 2026-10-01; PLAN-V2.md §11).
// ON SINCE THE CUTOVER, 2026-10-01 (Phase 5): dataset v1 is frozen. Its archive
// (dump, JSONL export, standing and pairwise CSVs, items/ copy) is in
// ~/Media/junk-drawer-v1/2026-10-01/ on the owner's machine — runbook
// db/junk-drawer-v1-archive.md, tag junk-drawer-v1-final. The v2 drawer is
// /art/junk-drawer/ and v1 stays on view, read-only, as the legacy exhibit at
// /art/junk-drawer/legacy/. TRUE makes every v1 WRITE endpoint — jd-generate,
// jd-rate, jd-item-rate, jd-curate, jd-title, jd-harvest (its sync writes) —
// answer 410 Gone with the
// C1 error envelope, code 'dataset_frozen' (jd_require_v1_unfrozen(), section
// 4), so nothing can write v1 again. jd-backfill-curated answers in its own
// plain-text voice instead: a 200 whose line starts "done", because the deploy
// workflow runs it after every upload and greps for ^done — frozen, it files
// nothing and the deploy stays green. Reads keep serving the legacy exhibit:
// legacy/data.php, jd-gen-svg.php and jd-analytics.php are untouched by it.
// Never set it back to false: v1 and v2 never pool, and a v1 write after the
// archive was cut would be a row the archive does not hold.
const JD_V1_FROZEN = true;

const JD_PROMPT_MAX_CHARS = 500;
const JD_NOTE_MAX_CHARS = 500;
const JD_RATINGS_MAX = 64;

// The words the tables are written in, named once (setup-jd-tables.php holds
// the ENUM / CHECK lists they come from). A pure naming: each constant IS the
// stored string, and SQL that compares against one interpolates it, so every
// statement's text is the same as when the literal was written inline.
//
// jd_*.client — who filed a row: a visitor's turn, the owner at the bench, the
// entry.json word carried in by the backfill, the curated backfill itself.
const JD_CLIENT_WEB = 'web';
const JD_CLIENT_BENCH = 'bench';
const JD_CLIENT_SEED = 'seed';
const JD_CLIENT_CURATED = 'curated';
// jd_submissions.status
const JD_SUB_PENDING = 'pending';
const JD_SUB_GENERATED = 'generated';
const JD_SUB_RATED = 'rated';
const JD_SUB_FAILED = 'failed';
// jd_generations.status
const JD_GEN_PENDING = 'pending';
const JD_GEN_OK = 'ok';
const JD_GEN_FAILED = 'failed';
const JD_GEN_REJECTED = 'rejected';
// jd_ratings.kind ('flag' is the legacy kind, kept in the ENUM; jd-rate.php
// still files one when a visitor's batch carries it)
const JD_KIND_GRADE = 'grade';
const JD_KIND_AXIS = 'axis';
const JD_KIND_FLAG = 'flag';

// APP §4.4 — declared by the client, never sniffed from User-Agent.
const JD_CLIENTS = [JD_CLIENT_WEB, 'ios', 'android'];

const JD_TAXONOMY_PATH = __DIR__ . '/../art/junk-drawer/taxonomy.json';
const JD_DEV_DB_PATH = __DIR__ . '/../local-dev/jd-dev.sqlite';

// ---------------------------------------------------------------------------
// Secrets — the api/database.php pattern (local config first, then the
// out-of-webroot production file). Returns [] when neither exists, which is
// the container's state; jd_db() and the provider calls handle that.
function jd_secrets(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $local = __DIR__ . '/../config/secrets.php';
    $loaded = null;
    if (is_readable($local)) {
        $loaded = include $local;
    } elseif (JD_IS_PRODUCTION) {
        $loaded = include '/home1/tdrivemy/private_config/secrets.php';
    }
    $cache = is_array($loaded) ? $loaded : [];
    return $cache;
}

// ---------------------------------------------------------------------------
// C6.1 — one PDO for the request. Production/local-with-MySQL reuse
// database.php verbatim; dev mode gets a SQLite file created on demand.
function jd_db(bool $fresh = false): PDO
{
    static $shared = null;
    if (!$fresh && $shared instanceof PDO) {
        return $shared;
    }
    if ($fresh) {
        // Drop the dead handle before rebuilding, so a failed reconnect cannot
        // hand the old one back out. See jd_db_retry() below.
        $shared = null;
    }

    if (JD_DEV_MODE) {
        $dir = dirname(JD_DEV_DB_PATH);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $shared = new PDO('sqlite:' . JD_DEV_DB_PATH, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $shared->exec('PRAGMA foreign_keys = ON');
        return $shared;
    }

    // database.php dies on failure, so the two things this feature cares
    // about have to be arranged before it is reached:
    //   - missing credentials become an exception the endpoints can turn into
    //     the C1 error envelope;
    //   - a live-but-unreachable database at least answers 500 + JSON rather
    //     than database.php's default 200 + HTML page, which is the only
    //     branch that file offers and is keyed on this header.
    //
    // That second one is why HTTP_ACCEPT is overwritten below: database.php
    // reads $_SERVER['HTTP_ACCEPT'] to choose its die() format and is not
    // ours to edit (C7). The write is deliberate and must stay next to the
    // require — anyone reading database.php's failure branch and wondering
    // who set that header is looking at these three lines.
    $secrets = jd_secrets();
    foreach (['db_name', 'db_user', 'db_pass'] as $key) {
        if (!isset($secrets[$key])) {
            throw new PDOException('database credentials are not configured');
        }
    }
    $_SERVER['HTTP_ACCEPT'] = 'application/json';

    require __DIR__ . '/database.php';
    /** @var PDO $pdo — defined by database.php */
    $shared = $pdo;
    return $shared;
}

// ---------------------------------------------------------------------------
// C6.2 — surviving a connection that died while the provider was working.
//
// A generation holds this connection open and completely idle for the 60-120s
// of the provider call, and shared hosting will sometimes close it in that
// window. The symptom is a 2006/2013 on the FIRST write after the call returns:
// jd_finish_generation() throws, jd-generate.php's catch answers 500, and the
// row it was about to settle is stranded at 'pending' forever — no
// reject_reason, no latency_ms, no usage_tokens, because the statement that
// records all three is the one that failed. That is indistinguishable in the
// database from a request that died mid-flight, which is what made it hard to
// read. Observed 2026-08-14 01:42:16Z on generation 01KZYYVZMWM4R4TRC1P43CNSMW,
// 76s into an Opus 5 call, with the cause visible only in the PHP error log.
//
// Note this is NOT plain wait_timeout: the session value is 3600, and an idle
// connection measurably survives 180s on this host. Whatever governor is
// closing it, the write path must not assume the connection outlived the
// provider call.
function jd_db_connection_lost(PDOException $e): bool
{
    $driverCode = $e->errorInfo[1] ?? null;
    if ($driverCode === 2006 || $driverCode === 2013) {
        return true;
    }
    $message = $e->getMessage();
    return stripos($message, 'server has gone away') !== false
        || stripos($message, 'Lost connection') !== false;
}

/**
 * Run one database write, reconnecting and replaying it EXACTLY once if the
 * connection died. Any other PDOException propagates untouched to the C1 error
 * envelope — this recovers a dead socket, not a bad statement.
 *
 * Only safe for idempotent writes. Every call site guards on the row state it
 * is leaving (`WHERE ... AND status = 'pending'`), so a replay that lands after
 * a partially-applied first attempt is a no-op rather than a double write.
 *
 * @param callable(PDO):mixed $work
 * @return mixed
 */
function jd_db_retry(callable $work, ?PDO $db = null)
{
    try {
        return $work($db ?? jd_db());
    } catch (PDOException $e) {
        if (!jd_db_connection_lost($e)) {
            throw $e;
        }
        error_log('jd: database connection lost across the provider call; '
            . 'reconnecting and replaying — ' . $e->getMessage());
        return $work(jd_db(true));
    }
}

function jd_db_driver(PDO $db): string
{
    return (string) $db->getAttribute(PDO::ATTR_DRIVER_NAME);
}

// The two dialects' spellings of the same race-losing-write-is-a-no-op INSERT.
function jd_insert_ignore(PDO $db): string
{
    return jd_db_driver($db) === 'sqlite' ? 'INSERT OR IGNORE INTO' : 'INSERT IGNORE INTO';
}

// ---------------------------------------------------------------------------
// C1 — 26-char Crockford base32 ULID: 48-bit ms timestamp + 80 bits of
// random_bytes entropy. Possession of a submission_id is the capability to
// rate it, so the random half must be unguessable, not merely unique.
/**
 * The curator's stable visitor_hash — the owner, rating from the bench, and the
 * filer of the curated backfill's seed rows.
 *
 * msky_visitor_hash() puts the UTC date INSIDE the hash so a visitor cannot be
 * followed across days. That is right for visitors and useless for the curator:
 * a 385-cell pass across three sittings would file the owner as three different
 * raters. This is a fixed value instead, so curated work always groups.
 *
 * It is deliberately NOT secret-derived: nothing is protected by it. A client
 * can never set visitor_hash — the server always assigns it — so a guessable
 * constant forges nothing, and keeping it constant means production needs no
 * extra key and no rotation can orphan already-filed rows. The real rater-class
 * discriminator is the `client` column ('curated' | 'bench' | 'seed' | 'web').
 */
function jd_curator_hash(): string
{
    return hash('sha256', 'municipal-sky-curator-v1');
}

function jd_ulid(): string
{
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    $ms = (int) floor(microtime(true) * 1000);
    $time = '';
    for ($i = 0; $i < 10; $i++) {
        $time = $alphabet[$ms % 32] . $time;
        $ms = intdiv($ms, 32);
    }

    // 256 is an exact multiple of 32, so the modulo is unbiased.
    $random = '';
    foreach (str_split(random_bytes(16)) as $byte) {
        $random .= $alphabet[ord($byte) % 32];
    }

    return $time . $random;
}

// A UUID in its 8-4-4-4-12 hex form, either case — the shape of a turn's
// client_ref and of the browser's device code (jd-generate.php).
const JD_UUID_RE = '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/';

/** A random UUIDv4, lowercase — for a NOT NULL UNIQUE client_ref the server
 *  files itself (the curated sync, the benchmark runner). Carries no meaning. */
function jd_uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

// All timestamps written by this feature are UTC 'Y-m-d H:i:s' strings, which
// sort lexicographically on both MySQL DATETIME and SQLite TEXT — so every
// cutoff is computed here in PHP and bound as a parameter, never NOW().
function jd_now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function jd_utc_midnight(): string
{
    return gmdate('Y-m-d 00:00:00');
}

function jd_seconds_to_utc_midnight(): int
{
    return 86400 - (time() % 86400);
}

// ---------------------------------------------------------------------------
// Responses. Content-Type: application/json on every response, including
// errors. CORS headers come from jd-origin.php only.
function jd_json_out(int $status, array $payload): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json');
    }
    echo json_encode($payload);
    exit;
}

// C1.2 error envelope. $context carries submission_id / gen_id / slot when
// they exist by this point, and retry_after for the two throttled codes.
function jd_fail(int $status, string $code, string $message, array $context = []): void
{
    $payload = ['ok' => false];
    foreach (['submission_id', 'gen_id', 'slot'] as $key) {
        if (isset($context[$key]) && $context[$key] !== null) {
            $payload[$key] = $context[$key];
        }
    }
    $payload['error'] = ['code' => $code, 'message' => $message];
    if (isset($context['retry_after'])) {
        $payload['retry_after'] = (int) $context['retry_after'];
        if (!headers_sent()) {
            header('Retry-After: ' . (int) $context['retry_after']);
        }
    }
    jd_json_out($status, $payload);
}

function jd_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        jd_fail(405, 'method_not_allowed', 'This endpoint accepts POST only.');
    }
}

function jd_require_get(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        jd_fail(405, 'method_not_allowed', 'GET only.');
    }
}

// The v1 write endpoints' first statement after their requires: 410 Gone once
// dataset v1 is frozen (JD_V1_FROZEN, section 1); a no-op while it is not.
function jd_require_v1_unfrozen(): void
{
    if (JD_V1_FROZEN) {
        jd_fail(410, 'dataset_frozen', 'Dataset v1 is frozen; the drawer continues at /art/junk-drawer/.');
    }
}

// The host fronts the site with an edge cache that will cache a header-less
// GET — observed serving a previous deploy's bench queue to a fresh session
// (2026-08-28). Every read the bench or the drawer depends on for live truth
// sends this, so no cache anywhere may store the answer.
function jd_no_store(): void
{
    if (!headers_sent()) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
}

// A 26-char Crockford ULID as minted by jd_ulid() — the shape of every
// submission and generation id, and the only shape an endpoint accepts.
const JD_ULID_RE = '/^[0-9A-HJKMNP-TV-Z]{26}$/';

function jd_is_ulid(mixed $value): bool
{
    return is_string($value) && preg_match(JD_ULID_RE, $value) === 1;
}

// ---------------------------------------------------------------------------
// The bench gate. JD_BENCH_REQUIRE_KEY (above) is the one switch, ON since
// 2026-09-05 (admin mode): production callers present jd_bench_key (falling
// back to the jd_setup_key already on file) in X-Bench-Key or ?key=, and a
// box with no key on file is open in dev and shut in production. Switched
// off — as it was 2026-08-18 → 2026-09-05 — every curator endpoint answers
// keyless.

/** The bench key on file, or null when none is configured. */
function jd_bench_key_expected(): ?string
{
    $secrets = jd_secrets();
    $k = $secrets['jd_bench_key'] ?? ($secrets['jd_setup_key'] ?? null);
    return is_string($k) && $k !== '' ? $k : null;
}

/** The key this request presented ('' when none). */
function jd_bench_key_supplied(): string
{
    return (string) ($_SERVER['HTTP_X_BENCH_KEY'] ?? ($_GET['key'] ?? ''));
}

/** Does this request hold the bench key, or is no key required? Pure — the
 *  throttle bookkeeping is jd_require_bench_key's. */
function jd_bench_keyed(): bool
{
    if (!JD_BENCH_REQUIRE_KEY) {
        return true;
    }
    $expected = jd_bench_key_expected();
    if ($expected === null) {
        return !JD_IS_PRODUCTION;
    }
    $supplied = jd_bench_key_supplied();
    return $supplied !== '' && hash_equals($expected, $supplied);
}

// THE THROTTLE (owner, 2026-09-05). A wrong key costs a miss against the
// caller's address; JD_KEY_MISS_LIMIT misses inside JD_KEY_MISS_WINDOW
// seconds and the address is answered 429 until the window passes, right
// key or wrong. A request that presents NO key is not a guess and is not
// counted (the page's first keyless probe; a visitor path that happens to
// reach a gated endpoint). A right key clears the address's misses. The
// counter is one small file per address under the system temp dir — no
// table, no migration — and a temp dir that cannot be written fails OPEN
// with a log line rather than locking the owner out. The address is
// REMOTE_ADDR only: a forwarded header is the caller's to forge.
const JD_KEY_MISS_LIMIT = 8;
const JD_KEY_MISS_WINDOW = 3600;

function jd_key_miss_file(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return rtrim(sys_get_temp_dir(), '/') . '/jd-keymiss-' . substr(hash('sha256', $ip), 0, 24) . '.json';
}

/** @return array{n:int,since:int} misses inside the current window */
function jd_key_misses(): array
{
    $raw = @file_get_contents(jd_key_miss_file());
    $d = $raw !== false ? json_decode($raw, true) : null;
    if (!is_array($d) || (time() - (int) ($d['since'] ?? 0)) > JD_KEY_MISS_WINDOW) {
        return ['n' => 0, 'since' => time()];
    }
    return ['n' => (int) ($d['n'] ?? 0), 'since' => (int) $d['since']];
}

function jd_key_miss_record(): int
{
    $m = jd_key_misses();
    $m['n']++;
    if (@file_put_contents(jd_key_miss_file(), json_encode($m), LOCK_EX) === false) {
        error_log('jd: bench-key miss counter unwritable in ' . sys_get_temp_dir() . ' — throttle off');
    }
    return $m['n'];
}

function jd_key_miss_clear(): void
{
    @unlink(jd_key_miss_file());
}

/** 403 unless the caller is keyed; 429 while the caller's address is throttled. */
function jd_require_bench_key(): void
{
    if (!JD_BENCH_REQUIRE_KEY || jd_bench_key_expected() === null) {
        // nothing to guess at: no key on file means open (dev) or shut (prod)
        if (!jd_bench_keyed()) {
            jd_fail(403, 'forbidden', 'The bench key is missing or wrong.');
        }
        return;
    }
    $m = jd_key_misses();
    if ($m['n'] >= JD_KEY_MISS_LIMIT) {
        $wait = max(1, JD_KEY_MISS_WINDOW - (time() - $m['since']));
        jd_fail(429, 'too_many_attempts',
            'Too many wrong keys from this address — try again later.', ['retry_after' => $wait]);
    }
    if (jd_bench_keyed()) {
        if ($m['n'] > 0) {
            jd_key_miss_clear();
        }
        return;
    }
    if (jd_bench_key_supplied() !== '') {
        $n = jd_key_miss_record();
        error_log('jd: bench key refused (' . $n . '/' . JD_KEY_MISS_LIMIT . ' this hour)');
    }
    jd_fail(403, 'forbidden', 'The bench key is missing or wrong.');
}

// The curator endpoints' preamble, in the order every one of them ran it: the
// origin gate (jd_require_allowed_origin, from jd-origin.php, which each of
// them requires), then — for the reads — no-store and GET only, then the bench
// key. jd-bench-queue, jd-ledger, jd-inventory, jd-harvest, jd-admin-check
// read; jd-item-rate and jd-curate write.
function jd_curator_get(): void
{
    jd_require_allowed_origin();
    jd_no_store();
    jd_require_get();
    jd_require_bench_key();
}

function jd_curator_post(): void
{
    jd_require_allowed_origin();
    jd_require_post();
    jd_require_bench_key();
}

// The maintenance scripts' gate (setup-jd-tables.php, jd-backfill-curated.php
// over the web): on production, 403 and $message (plain text) unless ?key=
// matches jd_setup_key. Anywhere else it is open — the CLI and the dev box
// have no key to give.
function jd_require_setup_key(string $message): void
{
    if (!JD_IS_PRODUCTION) {
        return;
    }
    $secrets = jd_secrets();
    $expected = $secrets['jd_setup_key'] ?? null;
    $supplied = $_GET['key'] ?? '';
    if (!is_string($expected) || $expected === '' || !hash_equals($expected, (string) $supplied)) {
        http_response_code(403);
        echo $message;
        exit;
    }
}

// ---------------------------------------------------------------------------
// Database error classification — for the one recoverable failure class, a
// migration that has not been run yet. Deploys are instant and
// setup-jd-tables.php is a manual run, so a reader must be able to tell
// "table not there yet" from "bad statement". Anything these do not match
// re-throws at the call site.

// MySQL says SQLSTATE 42S02 / "Table ... doesn't exist" (8.0: "Base table or
// view not found"); SQLite says "no such table".
function jd_missing_table(PDOException $e): bool
{
    if (($e->getCode() ?: '') === '42S02') {
        return true;
    }
    $msg = $e->getMessage();
    return str_contains($msg, 'no such table')
        || str_contains($msg, "doesn't exist")
        || str_contains($msg, 'Base table or view not found');
}

// MySQL says SQLSTATE 42S22 / "Unknown column"; SQLite says "has no column
// named" (insert) or "no such column" (elsewhere).
function jd_missing_column(PDOException $e): bool
{
    if (($e->getCode() ?: '') === '42S22') {
        return true;
    }
    $msg = $e->getMessage();
    return str_contains($msg, 'no such column')
        || str_contains($msg, 'has no column named')
        || str_contains($msg, 'Unknown column');
}

/**
 * A read of a table a manual migration adds (jd_ranks, 2026-08-22): $read's
 * rows, or [] when the table is not there yet — deploys are instant and
 * setup-jd-tables.php is a manual run, so a reader must survive the gap. Any
 * other PDOException propagates untouched. $log, when given, is written to
 * the error log on a miss (each reader keeps its own line, or none).
 *
 * @param callable():array $read
 */
function jd_query_or_empty_if_missing(callable $read, ?string $log = null): array
{
    try {
        return $read();
    } catch (PDOException $e) {
        if (!jd_missing_table($e)) {
            throw $e;
        }
        if ($log !== null) {
            error_log($log);
        }
        return [];
    }
}

/** Schema probe, both dialects: does $table exist? */
function jd_has_table(PDO $db, string $table): bool
{
    if (jd_db_driver($db) === 'sqlite') {
        $q = $db->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?");
        $q->execute([$table]);
    } else {
        // information_schema, not SHOW TABLES LIKE ?: MySQL refuses bind
        // parameters in SHOW statements under native prepares (1064 near
        // '?'), which is what took the 2026-09-05 migration down mid-run.
        $q = $db->prepare(
            'SELECT 1 FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
        );
        $q->execute([$table]);
    }
    return $q->fetch() !== false;
}

/** Schema probe, both dialects: does $table carry $column? */
function jd_has_column(PDO $db, string $table, string $column): bool
{
    if (jd_db_driver($db) === 'sqlite') {
        foreach ($db->query('PRAGMA table_info(' . $table . ')') as $col) {
            if (($col['name'] ?? '') === $column) {
                return true;
            }
        }
        return false;
    }
    // information_schema for the same reason as jd_has_table
    $q = $db->prepare(
        'SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $q->execute([$table, $column]);
    return $q->fetch() !== false;
}

/**
 * How many slot letters the LIVE jd_generations.slot column actually holds —
 * read from the schema, not assumed from JD_SLOT_LETTERS. The two disagree
 * exactly when a deploy widened the code but api/setup-jd-tables.php was
 * never run against that database (2026-09-10 → 2026-09-27 on production:
 * every save on a rerun item died with a bare "1265 Data truncated for
 * column 'slot'" and nobody could tell why from the log). Returns the
 * count, or null when the column cannot be read (then nothing is refused
 * on its account — the INSERT will speak for itself). The curated sync and
 * the backfill refuse with jd_slot_capacity_message (jd-curated-sync.php).
 */
function jd_slot_capacity(PDO $db): ?int
{
    try {
        if (jd_db_driver($db) === 'sqlite') {
            $q = $db->prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jd_generations'");
            $q->execute();
            $ddl = (string) $q->fetchColumn();
            if (!preg_match('/slot\s+TEXT[^,]*?IN\s*\(([^)]*)\)/i', $ddl, $m)) {
                return null;
            }
            $list = $m[1];
        } else {
            $q = $db->prepare(
                'SELECT COLUMN_TYPE FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
            );
            $q->execute(['jd_generations', 'slot']);
            $type = (string) $q->fetchColumn();
            if (!preg_match('/^enum\((.*)\)$/i', $type, $m)) {
                return null;
            }
            $list = $m[1];
        }
        $n = preg_match_all("/'[a-p]'/", $list);
        return $n > 0 ? $n : null;
    } catch (PDOException $e) {
        return null;
    }
}

// jd_submissions.device_ref (2026-09-10) may not have reached a database the
// migration has not been run on: the column for a SELECT list, or NULL in
// its place (the census and the ledger read it).
function jd_submissions_device_col(PDO $db): string
{
    return jd_has_column($db, 'jd_submissions', 'device_ref') ? ', device_ref' : ', NULL AS device_ref';
}

// Any client-held identifier travels in the JSON body — never a cookie.
function jd_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        jd_fail(400, 'bad_request', 'A JSON request body is required.');
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        jd_fail(400, 'bad_request', 'The request body could not be read as JSON.');
    }
    return $body;
}

// APP §4.4 — anything unrecognised silently becomes 'web'.
function jd_normalize_client(mixed $value): string
{
    return (is_string($value) && in_array($value, JD_CLIENTS, true)) ? $value : JD_CLIENT_WEB;
}

// C1.3 step 4/5 — the server's own copy of taxonomy.json is authoritative for
// rating validation and for the taxonomy_version stamp.
function jd_taxonomy(): ?array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache ?: null;
    }
    $raw = @file_get_contents(JD_TAXONOMY_PATH);
    if ($raw === false) {
        $cache = false;
        return null;
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        $cache = false;
        return null;
    }
    $cache = $parsed;
    return $cache;
}

/**
 * The taxonomy, or a 500 — for endpoints that cannot do their job without
 * it. A taxonomy that cannot state its version must not produce rows: a
 * silent 0 in taxonomy_version would be indistinguishable from a real one.
 */
function jd_taxonomy_required(string $who): array
{
    $taxonomy = jd_taxonomy();
    if ($taxonomy === null) {
        error_log($who . ': taxonomy.json could not be read at ' . JD_TAXONOMY_PATH);
        jd_fail(500, 'server_error', 'The rubric could not be read.');
    }
    if (jd_taxonomy_version($taxonomy) < 1) {
        error_log($who . ': taxonomy.json has no usable version field');
        jd_fail(500, 'server_error', 'The rubric could not be read.');
    }
    return $taxonomy;
}

function jd_taxonomy_version(array $taxonomy): int
{
    return (int) ($taxonomy['version'] ?? 0);
}

/** @return array<string,array> live (non-defunct) axes, id => axis, in taxonomy order */
function jd_live_axes(array $taxonomy): array
{
    $axes = [];
    foreach ($taxonomy['axes'] ?? [] as $axis) {
        if (isset($axis['id']) && empty($axis['defunct'])) {
            $axes[(string) $axis['id']] = $axis;
        }
    }
    return $axes;
}

/** @return float[] every grade rank on the scale */
function jd_grade_ranks(array $taxonomy): array
{
    $ranks = [];
    foreach ($taxonomy['grades'] ?? [] as $grade) {
        if (isset($grade['rank'])) {
            $ranks[] = (float) $grade['rank'];
        }
    }
    return $ranks;
}

/** @return array<string,float[]> live axis id => the ranks its values allow */
function jd_axis_ranks(array $taxonomy): array
{
    $out = [];
    foreach (jd_live_axes($taxonomy) as $id => $axis) {
        $ranks = [];
        foreach ($axis['values'] ?? [] as $value) {
            if (isset($value['rank'])) {
                $ranks[] = (float) $value['rank'];
            }
        }
        $out[$id] = $ranks;
    }
    return $out;
}

/** @return array<string,array> the model registry, id => {id,label,vendor} */
function jd_model_registry(array $taxonomy): array
{
    $models = [];
    foreach ($taxonomy['models'] ?? [] as $model) {
        if (isset($model['id'])) {
            $models[(string) $model['id']] = $model;
        }
    }
    return $models;
}

/** @return array<string,string> model id => its label (the id when the registry gives none) */
function jd_model_labels(array $taxonomy): array
{
    $labels = [];
    foreach (jd_model_registry($taxonomy) as $id => $m) {
        $labels[$id] = (string) ($m['label'] ?? $id);
    }
    return $labels;
}

/** @return array<string,array> size tiers, id => tier, in taxonomy order */
function jd_size_tiers(array $taxonomy): array
{
    $tiers = [];
    foreach ($taxonomy['sizeTiers'] ?? [] as $tier) {
        if (isset($tier['id'])) {
            $tiers[(string) $tier['id']] = $tier;
        }
    }
    return $tiers;
}

// Ranks are filed as decimals; match on the DECIMAL(3,1) grid the column
// stores rather than on exact float equality, and return the TAXONOMY's rank
// rather than the client's near-miss — what is stored has to sit exactly on
// the published scale, or a GROUP BY value in the export splits a rank in two.
function jd_rank_on_scale(mixed $value, array $ranks): ?float
{
    if (is_string($value) && is_numeric($value)) {
        $value = (float) $value;
    }
    if (!is_int($value) && !is_float($value)) {
        return null;
    }
    foreach ($ranks as $rank) {
        if (abs($rank - (float) $value) < 0.05) {
            return $rank;
        }
    }
    return null;
}

/**
 * What is wrong with a full ranking, or null when nothing is: 'first' unless
 * EXACTLY ONE entry holds rank 1 (there is never a tie for first), 'gap'
 * unless the distinct ranks are exactly 1..k (DENSE — ties below first are
 * legal, 1,2,2,3; a gap is not, 1,2,4). Checked in that order. jd-rate.php
 * holds a visitor's ranking to it and jd-item-rate.php the bench's, each
 * answering in its own words.
 *
 * @param int[] $ranks  the positions filed, keyed however the caller likes
 */
function jd_ranking_defect(array $ranks): ?string
{
    if (count(array_keys($ranks, 1, true)) !== 1) {
        return 'first';
    }
    $distinct = array_values(array_unique(array_values($ranks)));
    sort($distinct);
    return $distinct !== range(1, count($distinct)) ? 'gap' : null;
}

// ---------------------------------------------------------------------------
// The ratings fold. jd_ratings is one row per judgment, and three readers
// (data.php, the bench queue, the census) each need "what does this
// generation stand at" with the same precedence rule — the bench's answer
// outranks the turn's own, and a seed grade is a fallback only. One fold,
// one picker, so the rule cannot drift between them.

/**
 * Fold rating rows onto their generations, split by the client that filed
 * them. Rows must carry generation_id, kind, axis_id, value, client and
 * taxonomy_version (note is optional). Only LIVE axes are kept — a rating
 * filed under a retired axis stays in the table as history but never counts
 * toward "complete", a prefill or a chart. Within one client a later row
 * overwrites an earlier one, so order the query by rated_at when it matters.
 *
 * @param array<string,mixed> $liveAxes  id => axis (jd_live_axes)
 * @return array<string,array<string,array{axes:array,axes_version:array,grade:?float,grade_version:?int,note:?string}>>
 *   generation_id => client => the client's standing
 */
function jd_fold_ratings(array $rows, array $liveAxes): array
{
    $fold = [];
    foreach ($rows as $r) {
        $gid = (string) $r['generation_id'];
        $client = (string) ($r['client'] ?? JD_CLIENT_WEB);
        if (!isset($fold[$gid][$client])) {
            $fold[$gid][$client] = [
                'axes' => [], 'axes_version' => [], 'notes' => [],
                'grade' => null, 'grade_version' => null, 'note' => null,
            ];
        }
        $slot = &$fold[$gid][$client];
        $version = (int) ($r['taxonomy_version'] ?? 0);
        if ($r['kind'] === JD_KIND_AXIS) {
            $axis = (string) $r['axis_id'];
            if (isset($liveAxes[$axis])) {
                $slot['axes'][$axis] = (float) $r['value'];
                $slot['axes_version'][$axis] = $version;
                // a remark filed WITH the axis row rides with it (the report
                // card renders {value, note}); the row-less 'note' below is
                // the older per-response remark
                if (isset($r['note']) && $r['note'] !== null && $r['note'] !== '') {
                    $slot['notes'][$axis] = (string) $r['note'];
                }
            }
        } elseif ($r['kind'] === JD_KIND_GRADE) {
            $slot['grade'] = (float) $r['value'];
            $slot['grade_version'] = $version;
        }
        if ($slot['note'] === null && isset($r['note']) && $r['note'] !== null) {
            $slot['note'] = (string) $r['note'];
        }
        unset($slot);
    }
    return $fold;
}

/**
 * One generation's standing, merged across clients in precedence order:
 * the first client in $order that answered an axis (or the grade) wins it.
 * '*' stands for "any client not named earlier", in filing order.
 *
 * @param array<string,array> $byClient  one generation's entry from jd_fold_ratings
 * @param string[] $order  e.g. ['bench', '*'] — the bench outranks everyone
 * @return array{axes:array<string,float>,notes:array<string,string>,grade:?float,note:?string}
 */
function jd_pick_rating(array $byClient, array $order): array
{
    $out = ['axes' => [], 'notes' => [], 'grade' => null, 'note' => null];
    $seen = [];
    $walk = [];
    foreach ($order as $client) {
        if ($client === '*') {
            foreach ($byClient as $c => $_) {
                if (!isset($seen[$c]) && !in_array($c, $order, true)) {
                    $walk[] = $c;
                }
            }
        } elseif (isset($byClient[$client])) {
            $walk[] = $client;
        }
        $seen[$client] = true;
    }
    foreach ($walk as $client) {
        $s = $byClient[$client];
        foreach ($s['axes'] as $axis => $value) {
            if (!array_key_exists($axis, $out['axes'])) {
                $out['axes'][$axis] = $value;
                if (isset($s['notes'][$axis])) {
                    $out['notes'][$axis] = $s['notes'][$axis];
                }
            }
        }
        if ($out['grade'] === null && $s['grade'] !== null) {
            $out['grade'] = $s['grade'];
        }
        if ($out['note'] === null && $s['note'] !== null) {
            $out['note'] = $s['note'];
        }
    }
    return $out;
}

/**
 * The rank each drawing stands at, from jd_ranks rows (generation_id,
 * rank_pos, client): the bench's row outranks any other client's (a later
 * bench row replacing an earlier one), and otherwise the first row read
 * stands — the bench-first rule jd_pick_rating applies to ratings. data.php,
 * the bench queue and the ledger read ranks through it.
 *
 * @param iterable<array> $rows
 * @return array<string,array{pos:int,client:string}>
 */
function jd_rank_by_generation(iterable $rows): array
{
    $out = [];
    foreach ($rows as $r) {
        $gid = (string) $r['generation_id'];
        if ($r['client'] === JD_CLIENT_BENCH || !isset($out[$gid])) {
            $out[$gid] = ['pos' => (int) $r['rank_pos'], 'client' => (string) $r['client']];
        }
    }
    return $out;
}

/**
 * THE POSITION JOIN between a curated item's entry.json and its backfilled
 * generations (2026-08-18 contract, shared since 2026-09-05): the backfill
 * filed slot a,b,c,d in the order responses appear in the entry — retired
 * ones INCLUDED, which is why rids stay permanent — so entry index i is
 * generation i. $entryResponses must therefore be the UNFILTERED list, and
 * $gens ordered by slot. A generation past the entry's end (a response the
 * entry lost) keeps a synthetic rid so nothing is silently dropped.
 *
 * @return list<array{gen:array,src:?array,rid:string}>
 */
function jd_curated_positions(array $entryResponses, array $gens): array
{
    $byIndex = array_values($entryResponses);
    $out = [];
    foreach (array_values($gens) as $i => $g) {
        $src = $byIndex[$i] ?? null;
        $out[] = [
            'gen' => $g,
            'src' => is_array($src) ? $src : null,
            'rid' => (string) ($src['rid'] ?? ('r' . ($i + 1))),
        ];
    }
    return $out;
}

/**
 * A turn's tag title: the title filed with it (jd-title.php drafts it, the
 * visitor's card files it), or — for a turn filed without one — its prompt,
 * cut to 41 characters and an ellipsis when longer than 42. data.php serves
 * it; the ledger shows the same words.
 */
function jd_turn_title(mixed $title, string $prompt): string
{
    $t = trim((string) ($title ?? ''));
    return $t !== '' ? $t
        : (mb_strlen($prompt) > 42 ? mb_substr($prompt, 0, 41) . '…' : $prompt);
}

// ---------------------------------------------------------------------------
// C4.4 — extraction. First '<svg' (case-insensitive) through the last
// '</svg>'; the span is the artifact. Never repaired, reformatted or
// re-serialized: what is stored is byte-exact model output.
function jd_extract_svg(string $text): ?string
{
    $start = stripos($text, '<svg');
    if ($start === false) {
        return null;
    }
    $end = strripos($text, '</svg>');
    if ($end === false || $end < $start) {
        return null;
    }
    return substr($text, $start, $end + 6 - $start);
}

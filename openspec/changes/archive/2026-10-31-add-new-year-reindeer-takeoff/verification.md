# Reindeer Takeoff verification

## Current version: coherent character drawing and authored poses

The revision keeps the composer walk, caught word, release and snow wake within the existing 23-second scene. The adult and calf now have shaped torso/neck contours, different proportions and antlers, and coordinated head, neck, gaze and ear poses. The calf's blink accompanies a quick facing switch without collapsing its silhouette. Fore/hind bends and contact phases differ; flight changes from extension to tuck and a held glide instead of continued pedalling. The static fallback uses the revised artwork, including an unfilled harness stroke.

The user's strongest references are SnowmanDelivery, Skeletons, Ravens, Candy's birds-versus-janitors chase, Mummy pushing the input and Train carrying away the pumpkin. Their concrete staging/acting techniques informed the scene, prioritizing coherent contours and readable poses over additional physical complexity or SVG detail. The supporting `celebration-scene-ideas` skill updates remain local and are excluded from this change.

### Visual and native-browser evidence

Compared the earlier rigid torso/neck drawing with actual-size working poses, then inspected desktop/mobile/RTL contact and flight captures. The adult's larger chest and antlers, calf proportions, held flight legs and intact facing silhouettes are visible in those captures. The final static fallback and a dark fixture were also inspected. Normal-speed Chromium playback was recorded for all four widths, with a desktop preview at `tmp/reindeer-verification/reindeer-desktop-preview.webm`. These frames and automated playback checks establish specific drawing/contact changes; they do not establish that the user prefers the result or replace a human assessment of the recorded movement.

The full browser harness passed at 360, 900 RTL, 1280 with draft, and 1920 pixels. Mobile cases use 4× CPU slowdown; desktop uses 1×. Native SVG checks sample all eight soles at 30 fps and the nose/loop at 60 fps during contact. The complete cast remains visible in flight, the trail remains after departure, and draft/placeholder/editing state are preserved. Reduced-motion, bottom-pinned input and cancellation checks pass.

| Width | Data bytes | SVG nodes | Paths | Frame p95 / p99 ms | Max sole error px | Max stance drift px | Max nose/loop gap px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 360 | 393,746 | 260 | 114 | 9.2 / 9.3 | 1.327 | 0.846 | 0.546 |
| 900 | 495,839 | 260 | 114 | 9.2 / 9.3 | 1.165 | 1.091 | 0.546 |
| 1280 | 418,793 | 276 | 122 | 9.1 / 9.3 | 1.599 | 1.184 | 0.819 |
| 1920 | 422,851 | 276 | 122 | 9.1 / 9.3 | 1.320 | 1.184 | 0.819 |

There are 3,152–3,162 planted-contact samples per viewport. Model-to-render nose error stays below 0.005 px. No playback host reads or long tasks were observed. Desktop trace totals: Paint 182.359 ms, Layout 81.039 ms and UpdateLayoutTree 266.513 ms. These local headless measurements were taken without concurrent repository checks; they are not a physical-device frame-rate guarantee. After 20 cancellations, DOM nodes remain 426 → 426 and listeners 343 → 343.

All existing ceilings are preserved. Compared with the previous drawing, generated paths decrease by six and SVG nodes increase by two for the independent neck groups. Scalar values are quantized to tenths; vector positions retain hundredths and are pruned at 0.25-unit tolerance. An initial RTL payload exceeded 500 KB; pruning/precision changes brought it below the existing ceiling, with native contact checks still passing.

### Checks and quality review

- Focused physics/geometry/component tests and the complete celebrations suite pass. Added coverage verifies fore/hind bends and a settled airborne pose; the browser now measures the actual nose/loop transforms and records playback videos.
- `npm run verify:changed` and `npm run verify:full` pass typecheck, lint, formatting and affected/full tests. The first sandboxed changed run could not open local test servers or write npm's cache; the authorized retry passed with the required access. The final full run passed without further code changes. `npm exec nx -- build @epam/ai-dial-celebrations` also passes, including declaration generation.
- Documentation, agent-documentation and strict OpenSpec validation pass. Spec references pass under installed Node 24.14.0 with zero errors and 196 existing warnings. Both skill copies validate and have matching Markdown contents and working source references.
- Correctness/readability: contact geometry shares the rendered neck/head landmarks; the fallback catch height follows those landmarks. All joint solving remains precomputed and scene-local. The facing change preserves drawing width; the flight uses a few authored poses.
- Architecture/security/accessibility: no new host/API/auth/env/storage/telemetry coupling, remote assets, dependencies, public props or strings. Existing inert copies, pointer transparency, reduced motion and cleanup remain intact. The documented celebrations artwork-palette exception applies; i18n/theming scans have no candidates.
- Responsive/performance/documentation: the full cast and causal interaction remain at all four widths and in RTL. README/design/spec describe the revised art and movement with unchanged limits. No implementation blocker was found; artistic preference remains open to user feedback.

Earlier sections below record superseded implementations and measurements.

## Previous version: supported gait and inertial takeoff

The physics revision preserves the 23-second composer/word/snow story. Step phase follows distance traveled, each planted hoof keeps its stage coordinate, and two 28-unit bones solve the stance. Counter-rotated soles stay flat while the torso compresses and leans around its hip line. Small recovery steps follow the resisted pull; the calf turns before walking to the word and returning to the team. Flight uses a continuous Hermite arc, with a 0.2-second calf delay and a 0.35-second sleigh delay, followed by settling sleigh pitch. Reins, nose contact and snow emission use the same rendered body and sleigh poses.

Native contact sampling found an error in the fast RTL return walk; denser sampling there reduced it without adding SVG nodes. Values are quantized to hundredths, pruned to 1.5 degrees / 0.2 position units, and Lottie keys store each start once instead of duplicating the following endpoint. The revised ceilings are 500 KB, 7,000 keys and 380 keys per property; all player, duration, property, SVG-node, path, copy and particle limits remain unchanged. The cost increase is precomputed joint/contact detail, not a runtime physics loop.

### Browser and contact evidence

The final normal-speed Chromium run passed at 360, 900 RTL, 1280 with draft, and 1920 pixels. Mobile cases use 4× CPU slowdown. After uninterrupted playback, the harness replays and samples the eight real SVG sole transforms at 30 fps: 3,076–3,102 planted contacts per viewport, error <2 px and successive stance drift <2.5 px. The test also verifies the live word, complete airborne cast, snow after departure, native editor preservation, reduced motion, bottom-pinned input and cancellation. Visual inspection caught the adult's head passing behind the announcement; the final lower arc keeps all silhouettes below the announcement band through 20.5 seconds, and the browser asserts that headroom.

| Width | Data bytes | SVG nodes | Paths | Frame p95 / p99 ms | Max sole error px | Max stance drift px |
| --- | --- | --- | --- | --- | --- | --- |
| 360 | 393,682 | 258 | 120 | 10.1 / 10.3 | 0.856 | 1.113 |
| 900 | 489,857 | 258 | 120 | 9.6 / 10.2 | 0.875 | 1.130 |
| 1280 | 417,379 | 274 | 128 | 9.2 / 9.3 | 1.285 | 1.134 |
| 1920 | 423,908 | 274 | 128 | 9.1 / 9.2 | 1.285 | 1.134 |

No playback host reads or long tasks were observed. Desktop trace totals: Paint 291.818 ms, Layout 136.636 ms and UpdateLayoutTree 419.888 ms. These are local headless measurements, including a run alongside repository verification, not a physical-device FPS guarantee. After 20 cancellations, DOM nodes remain 426 → 426 and listeners 343 → 343. Final captures, profile and trace are in `tmp/reindeer-verification/`.

### Checks and quality review

- Focused physics/story tests and the complete celebrations suite pass. Regressions cover planted contacts, bone reach, flat soles, resisted pulls, shared flight velocity, delayed load pickup, exact nose/loop contact, restoration, visibility and payload limits.
- `npm run verify:changed` and `npm run verify:full` passed typecheck, lint, formatting and affected/full tests. The full run completed 86 tasks (72 cached). `npm run build:quiet` passed the affected build: 8 projects and their dependencies, 69 tasks (62 cached).
- Documentation and strict OpenSpec validation pass; spec references have zero errors and 196 existing warnings under Node 24.14.0.
- Correctness/readability: one authored clock and a scene-local support solver; all solving is baked before playback. The live editor and approved story remain intact.
- Architecture/security/accessibility: no app/API/auth/env/storage/telemetry knowledge, external assets, dependency changes or new strings. Copies remain inert, pointer-transparent and safely disposed; existing static and keyboard behavior is preserved.
- Performance/responsive/documentation: all four native geometry and rendering profiles pass, with unchanged SVG node counts; the increased key/data allowance and measured contact tolerance are explicit in README/design/specs. No blocking finding remains in the implementation review.

Earlier sections below record superseded implementations and measurements.

## Previous version: input rim, caught word and snow trail

The user's next direction replaces the lower stage and button/card gag: the cast now walks on the actual input rim, catches its text, and leaves snow along the flight path. Earlier measurements and button/card descriptions below are historical.

- Ground roots sit two pixels above the measured composer top, with the entry clipped to its width. The clip opens at launch so the full formation can glide and depart. A bottom-pinned input now supports the story without requiring empty space underneath it.
- A temporary mirror measures a visible word in the native textarea draft, or placeholder when empty. Only an inert span and a small background cover animate. The live editor is never copied, styled, hidden or edited. Word lift and rotation share the ribbon/nose geometry; the calf stays grounded at contact. Copy, cover and mirror cleanup are tested.
- Snow clusters are deposited at the sleigh's past positions, remain there while drifting downward, and fade within 2.8 seconds. The bounded 24 desktop / 16 mobile clusters leave visible snow after the cast exits, with everything removed by the deadline.
- 62 focused tests pass across the five geometry, text, lifecycle, registration and story-coverage files. They include placeholder/draft selection, focused draft and selection preservation, clipped/scrolled/transparent/gradient fallbacks, payload caps, text cleanup, rim support, exact nose contact and airborne bounds.

### Browser evidence for the previous version

The normal-speed Chromium harness passed at 360 and 900 RTL with 4× CPU slowdown, and 1280/1920 desktop at 1×. The 1280 case uses a draft; other cases use the placeholder. It asserts actual word movement/lift, native value/placeholder/style preservation, frame bounds during flight, snow presence at 20.2 and after departure at 22.6 seconds, no overflow/page errors, static reduced-motion and a bottom-pinned composer. Visually inspected the desktop draft contact, RTL release, mobile airborne frame, desktop wake and snow remaining after exit.

| Width | Catch | Data bytes | SVG nodes | Paths | Frame p95 / p99 ms | Host reads | Long tasks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 360 | text | 180,105 | 258 | 120 | 9.2 / 9.3 | 0 | 0 |
| 900 | text | 180,109 | 258 | 120 | 9.2 / 9.3 | 0 | 0 |
| 1280 | text | 187,867 | 274 | 128 | 9.1 / 9.3 | 0 | 0 |
| 1920 | text | 187,899 | 274 | 128 | 9.1 / 9.3 | 0 | 0 |

The desktop trace totals 288.522 ms Paint, 118.654 ms Layout and 382.809 ms UpdateLayoutTree during playback. These local headless measurements are not a physical-device FPS guarantee. Artifacts are `tmp/reindeer-verification/profile.json`, screenshots and `desktop-trace.json` (ignored). After 20 cancellation cycles DOM nodes remain 426 → 426 and listeners 343 → 343; input interruption preserves the new draft and removes both word elements.

### Verification and review for the previous version

- Focused tests, celebrations build, documentation validation, strict OpenSpec validation and i18n/theming scans passed.
- `npm run verify:changed` and `npm run verify:full`: passed typecheck, lint, formatting and affected/full tests. The full run completed all 86 tasks (71 cached).
- Five-axis review: retained local composition/session ownership and host anchors; no API, app import, storage, telemetry, dependency or new production string. Text is copied with `textContent`; real editor values and editing state are untouched. Artwork and copied typography/ink inherit the existing scene/material or host presentation contract. Performance allowances explicitly account for the snow wake (110 animated properties, 1,800 keys, 320 SVG nodes) while keeping the 200 KB/140-path limits.

## Playback feedback corrections

The user identified three perceptual failures in the first implementation: a short desktop entrance, missing page interaction in the normal starter layout, and an unreadable departure. Structural/performance checks alone had not caught them.

The corrected scene enters from beyond the measured leading edge, uses a reachable bottom starter card when starters block the composer-add button, and visibly displaces/tilts its copy under tension. Desktop scale increases from 0.85 to 1.05; mobile retains both deer at up to 0.7. The airborne formation rises into the upper viewport, stays fully inside the stage through 20.5 seconds and physically exits at 22.4 seconds without opacity fading. The original control starts returning only after its copy settles, avoiding doubled moving text during release.

### Regression and browser evidence

- 55 focused tests pass across geometry/budgets, lifecycle/fallbacks, event selection and story coverage. New invariants require an entrance of at least half the stage width, a fully visible flying formation through 20.5 seconds, complete offstage departure, and actual starter borrowing/contact in LTR and RTL.
- The normal-speed browser script now asserts the expected real page target (starter or composer button), >18 px copy displacement and visible tilt under tension, and actual rendered SVG bounds for both deer and the sleigh at 18 and 20.2 seconds. Captures include entrance, contact, release, airborne recovery/glide and departure.
- All four viewport runs passed, including 4× CPU slowdown for 360 and 900 RTL. Visually inspected the resulting desktop/mobile/RTL frames. All original data/key/layer/SVG budgets remain unchanged; only the single-copy size ceiling expands to 360 × 96 px for a starter card, retaining 30 nodes.

| Width | Target | Entrance px | Data bytes | SVG nodes | Frame p95 / p99 ms | Host reads | Long tasks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 360 | starter | 313.0 | 168,399 | 239 | 9.2 / 9.3 | 0 | 0 |
| 900 | starter | 583.0 | 169,237 | 239 | 9.2 / 9.4 | 0 | 0 |
| 1280 | button | 719.5 | 172,197 | 248 | 9.2 / 9.3 | 0 | 0 |
| 1920 | starter | 1039.5 | 171,712 | 248 | 9.0 / 9.3 | 0 | 0 |

The desktop trace records 262.341 ms Paint, 111.850 ms Layout and 326.393 ms UpdateLayoutTree over playback. These are observations from local headless Chromium, not a physical-phone benchmark or universal frame-rate guarantee. The four-width profile is preserved in `tmp/reindeer-verification/profile-all-widths.json`; screenshots and the trace share that ignored directory.

After the final restoration-timing correction, the complete 900 px RTL playback, static fallbacks and 20 cancellation cycles were rerun successfully. DOM nodes remained 421 → 421 and event listeners 343 → 343. Draft input still cancels and restores the live UI immediately. The follow-up profile is `tmp/reindeer-verification/profile.json`.

### Repository checks and review

- `npm run verify:changed`: passed typecheck, lint and affected tests.
- `npm run verify:full`: passed full typecheck, lint, formatting and tests.
- Nx celebrations build: passed. The final small restoration-timing correction also passed all 55 focused tests and the browser replay above.
- Documentation and strict OpenSpec validation: passed. i18n/theming scans: no candidates; no user-visible strings or artwork colors were added by this correction.
- Five-axis self-review found no remaining blocker. The scene still uses host-provided anchors, inert copies and the existing disposal/session boundary; no app/API/config/storage/telemetry knowledge or new dependencies were introduced.

The historical evidence below describes the initial version and is superseded by the corrections and measurements above.

## Initial implementation evidence (before playback feedback)

Implemented the complete approved story through the existing bundled Lottie session and one synchronized inert button snapshot. Secret activation uses `happy new year`, with the elves and reindeer selected independently of gift clicks and without consecutive repeats. Both characters and every causal beat remain on mobile.

## Automated checks

- `npm run verify:changed`: passed typecheck, lint and affected tests.
- `npm run verify:full`: passed full typecheck, lint, formatting and tests for 37 projects (86 tasks including dependencies). After the final local gait/fallback refinements, reran the celebrations typecheck, lint, build and the four focused test files successfully.
- `npm run build:quiet`: passed the affected build; the final celebrations build also passed.
- Focused tests: 49 passing across reindeer geometry/budgets, component lifecycle/fallbacks, event selection and Storybook coverage. Budget tests cover desktop/mobile with both a button and an ice catch. The scene's component tests cover cancellation, target mutation, no-anchor direction changes, reduced motion, player failure, StrictMode and preservation of draft/focus/selection.
- `npm run validate:docs`: passed.
- `npm run validate:specs`: passed under installed Node 24.14.0, with zero errors and 196 existing identifier warnings. The default Node 20 runner lacks `node:fs.globSync`; no repository code was changed for that local runtime mismatch.
- `openspec validate add-new-year-reindeer-takeoff --strict`: passed.
- i18n and lib-theming scans against HEAD: no candidates. Celebrations artwork uses the documented intrinsic-artwork palette exception. The optional label is translated by the app's existing CelebrationHost adapter.
- `git diff --check`: passed.

## Browser playback and rendering

Ran `node libs/celebrations/browser-tests/reindeer-takeoff.browser.spec.mjs` against the real provider in Storybook on local headless Chromium. The 900 px case uses RTL. Mobile cases use CDP CPU throttling at 4×. Each full run plays at normal speed, with captures at 4, 10.2, 12.3, 14.65, 17.6 and 22.6 seconds.

| Width | Catch | CPU slowdown | Data bytes | SVG nodes | Paths | Frame p95 / p99 ms | Playback host reads | Long tasks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 360 | button | 4× | 181,978 | 239 | 109 | 10.1 / 10.3 | 0 | 0 |
| 900 | button | 4× | 181,811 | 239 | 109 | 10.1 / 10.3 | 0 | 0 |
| 1280 | button | 1× | 184,759 | 248 | 112 | 9.2 / 9.3 | 0 | 0 |
| 1920 | ice | 1× | 182,326 | 248 | 112 | 9.1 / 9.3 | 0 | 0 |

No horizontal overflow, page errors or playback-time host measurements were observed. The 1280 px trace recorded 279.625 ms total Paint, 122.367 ms Layout and 384.568 ms UpdateLayoutTree over the capture. The largest observed frame interval in that run was 33.3 ms. These are local headless-browser observations under the recorded conditions, not a universal FPS guarantee or physical-phone benchmark. CDP Performance totals include page startup; the separate desktop timeline trace covers playback.

Visually inspected desktop, mobile and RTL contact/takeoff captures, the static reduced-motion resolution, and actual-size characters on a dark Storybook fixture (`tmp/reindeer-verification/dark-fixture.png`). Added a snowbank to support the calf at the real button, corrected the gait's planted/swing transition and held its hooves on the plateau during the two nudges. The final ice-catch height was then corrected to the standing calf's nose level and its updated contact pose captured separately as `tmp/reindeer-verification/1920-ice-final.png`.

The repeatability test cancels a live scene under tension by editing the actual composer, confirms the draft and copy cleanup, warms the replay/focus path, then runs 20 identical activation/interruption cycles. After forced GC, DOM nodes remain 421 → 421 and event listeners 343 → 343. It also verifies reduced-motion and unsuitable-geometry stills. Initial harness measurements retained Playwright ElementHandles and mixed two focus paths; switching to locators and a consistent warm-up removes those harness artifacts.

Captures, `profile.json` and the desktop paint/layout trace are under `tmp/reindeer-verification/` (ignored artifacts). The Storybook story is `new-year-scenes--reindeer-takeoff`, with mobile, RTL, button, reduced-motion and unsuitable-geometry variants.

## Quality review

Correctness: shared geometry ties the ribbon catch, nose lift and button displacement to one clock; originals are restored before launch or immediately on cancellation. Static fallbacks do not load the player or measure the host.

Readability/architecture: scene-local artwork, staging, composition and playback modules; reused the existing session, snapshot restoration, target observer and Track authoring utility. Host integration remains in anchors and translated labels, with no app/API/auth/env/router/storage/telemetry imports in the library.

Security/accessibility: no new API, remote assets, HTML injection, navigation or live control activation. Artwork and copies are inert, aria-hidden and pointer-transparent. The existing keyboard-operable trigger and host notification remain the accessible activation/announcement path.

Performance/responsive/docs: fixed data, node, key and copy budgets are tested; mobile retains the full cast and story; RTL never mirrors copied text. README and complete delta requirements for the event, elves and penguin describe the new secret pool. No blocking findings remain.

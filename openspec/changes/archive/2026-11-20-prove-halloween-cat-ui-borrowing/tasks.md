<!--
Slicing strategy: risk-first, then contract-first.
- Section 1 is independent and inert: it closes the S3 carry-over.
- Sections 2–3 prove the riskiest claim before any public type, pack or doc changes. The claim is that
  anchor-bound retargeting, a time remap and DOM copy tracks keep contact on one clock with a small adapter.
- Section 3 ends at an explicit gate (task 3.7, thresholds in design D9). Sections 4–7 run only on "go".
  On "no-go", section 8 replaces them.
- Everything stays inert under the default `bundled` policy until an operator allowlists `halloween/cat`.
-->

## 1. S3 carry-over: external GiftWrapping browser coverage and preparation timing

- [x] 1.1 Commit the published `new-year-default@1.1.1` GiftWrapping desktop and mobile JSON and its poster as Storybook fixtures under `libs/celebrations/src/stories/fixtures/external/`. Keep their published filenames, record their provenance in `libs/celebrations/src/test-utils/external-gift-wrapping.ts`, and add a unit test that asserts each file's bytes and `sha256` against the pack manifest values.
  - Verification: `npm run test:file -- libs/celebrations/src/stories/tests/external-fixtures.spec.ts`
- [x] 1.2 Add `libs/celebrations/src/stories/ExternalGiftWrapping.stories.tsx`. It plays the real GiftWrapping descriptor (`composer-anchor-v1`, `interaction-composer-outline-v1`, desktop and mobile placements) through `LottieScene`, with the existing `PackStoryLoader` modes (`libs/celebrations/src/stories/pack-story-loaders.ts`) extended to serve the pinned fixtures and count data requests. It has controls for direction, layout and composer presence, and a Replay button. Extend `libs/celebrations/src/stories/tests/story-coverage.spec.ts` only if that suite requires it.
  - Verification: `npm run test:file -- libs/celebrations/src/stories/tests/story-coverage.spec.ts` and `npm exec nx run @epam/ai-dial-celebrations:typecheck`
- [x] 1.3 Add `libs/celebrations/browser-tests/external-gift-wrapping.browser.spec.mjs`, reusing the helpers of `celebrations-baseline.browser.spec.mjs` (extracted into `libs/celebrations/browser-tests/storybook-harness.mjs`; frames go through CDP `Page.captureScreenshot`, because Playwright's `page.screenshot()` re-applies mobile device metrics and correctly cancels a playing scene), and the Nx target `test-external-gift-wrapping-browser` in `libs/celebrations/package.json`, depending on `build-storybook`. It covers the "external GiftWrapping path has committed browser coverage" scenarios (spec `celebration-composer-anchoring`):
  - a slow load and a broken load
  - cancellation during loading (no renderer inserted) and at 6 s of playback (released once, composer unchanged)
  - cached replay (one data request, and the contour follows each width)
  - contact frames at 360/390/1280/1920 px in LTR and RTL
  - the `stage-anchor` fallback

  Frames go to `tmp/celebrations-baseline/<captureId>/`.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-external-gift-wrapping-browser`
- [x] 1.4 Add a preparation benchmark story, `libs/celebrations/src/stories/PreparationBenchmark.stories.tsx`. It calls the internal `prepareAnchoredSceneData` (`libs/celebrations/src/utils/celebration-pack-scene.ts`) on the live story composer 20 times and renders p50/p95 into the page. Add a test to the same browser spec that applies `Emulation.setCPUThrottlingRate(4)` at 1280 and 390 px and writes the timings to the capture. Add no instrumentation to library runtime code.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-external-gift-wrapping-browser`, then record p50/p95 against the 50 ms target in `openspec/changes/prove-halloween-cat-ui-borrowing/evidence/s3-carry-over.md`
- [x] 1.5 Slice check: `npm run verify:changed`. The comment with the frames is drafted and posted in 7.4, after the user approves it.

## 2. Generic building blocks as pure functions (no public API)

- [x] 2.1 Extract the button-eligibility rules of `getCatTargets` (`libs/celebrations/src/halloween/utils/halloween-cat-targets.ts`) into `libs/celebrations/src/utils/borrow-targets.ts`. Keep `getCatTargets` as a thin caller with identical results, the same way S3 extracted `composer-target.ts`. The existing Cat tests stay unchanged.
  - Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-cat-targets.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenCatScene.spec.tsx`
- [x] 2.2 Split `libs/celebrations/src/utils/celebration-snapshots.ts` into prepare, attach, start(startTime) and an idempotent stop (design D7), keeping `animateCelebrationSnapshots`'s signature and behaviour. Add `libs/celebrations/src/utils/tests/celebration-snapshots.spec.ts` covering:
  - no original is animated before start
  - stop before start removes the clones only
  - stop after start cancels each animation once
  - a budget overflow throws during prepare
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/celebration-snapshots.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-cat-animation.spec.ts libs/celebrations/src/new-year/components/NewYearSnowmanDelivery/tests/NewYearSnowmanDelivery.spec.tsx`
- [x] 2.3 Add `libs/celebrations/src/utils/lottie-markers.ts` (types in `libs/celebrations/src/models/lottie-markers.ts`). It reads markers in one namespace from root `markers` (plain-text `cm`, frames) and validates the D3 grammar against an adapter-supplied vocabulary: unknown, duplicated, out of range, overlapping binds, order, and at most four `contact` markers per prize. Any other namespace is ignored. Unit tests go in `libs/celebrations/src/utils/tests/lottie-markers.spec.ts`, including JSON-payload `cm` values in foreign namespaces.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-markers.spec.ts`
- [x] 2.4 Add `libs/celebrations/src/utils/lottie-anchor-binding.ts` (types in `libs/celebrations/src/models/lottie-anchor-binding.ts`). It writes `v' = A + diag(σ, 1)(v − R)` into the bound position keyframes, and the facing sign into the hold scale keyframes (design D5), on a private copy. It throws on an unbound keyframe, spatial tangents or a non-static reference null. Tests in `libs/celebrations/src/utils/tests/lottie-anchor-binding.spec.ts` assert unchanged keyframe times, counts and easing, mirrored offsets, and an untouched input.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-anchor-binding.spec.ts`
- [x] 2.5 Add `libs/celebrations/src/utils/lottie-time-remap.ts` (types in `libs/celebrations/src/models/lottie-time-remap.ts`). It builds the piecewise-linear `tm` keyframes for section paths and elastic ranges (design D6), rejects an elastic speed outside [0.8, 1.25], and maps rig-local times to composition times through the inverse of the monotone pieces. Tests in `libs/celebrations/src/utils/tests/lottie-time-remap.spec.ts` cover identity, the one-prize step, the trimmed crossing, a +180 ms fall (recoil within one frame), a rejected 1.3 speed, and a round trip of the inverse.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-time-remap.spec.ts`
- [x] 2.6 Add `libs/celebrations/src/utils/lottie-track-keyframes.ts`. It converts a null layer's position x, rotation and opacity keyframes into WAAPI keyframes: Bézier `o`/`i` become `cubic-bezier`, and a hold becomes `steps(1, end)`. It applies the side, the scale and the time mapping, and appends the gravity fall and rebound samples with the compiled constants. Tests in `libs/celebrations/src/utils/tests/lottie-track-keyframes.spec.ts` check the fall time `√(2·drop/2000)`, the 12° tilt bound, the rebound height, and that no keyframe has scale or a negative x-scale.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-track-keyframes.spec.ts`
- [x] 2.7 Architecture guard. The new modules contain:
  - no `/api` path, client or server-api import, app context, env or flag access, storage, telemetry or i18n
  - no `window.`/`getBoundingClientRect` in the pure modules (2.3–2.6)
  - no export from `libs/celebrations/src/index.ts`, `src/halloween/index.ts`, `src/new-year/index.ts` or `src/packs/index.ts`

  Then run `npm run verify:changed`.

## 3. Spike and gate: one representative Cat interaction

- [x] 3.1 Add `libs/celebrations/src/stories/ConversationInputHostPage.tsx`. It renders the real `ConversationInput` from `@epam/ai-dial-conversation-input` in a start-page layout with the real `StarterButtons` and passes their public class names as `anchors`. The Storybook resolves the three libs from source (`.storybook/main.ts` aliases, `preview.css` `@source`); lint's dependency checks ignore `src/stories/**`, so no devDependency is needed, and `implicitDependencies` negates the story-only graph edges so `nx sync` adds no build reference to `tsconfig.lib.json`.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:lint`, `npm run validate:docs`, and `npm exec nx run @epam/ai-dial-celebrations:build` with no `conversation-input` import in `libs/celebrations/dist`
- [x] 3.2 Bootstrap the spike asset once, with a throwaway script in the session scratchpad that is never committed (design D10). It covers the one-prize segment from the perch: hop down, nudge, push, release, fall, rebound and recoil. It contains `cat-rig`, `cat-root`, `cat-facing`, `cat-motion`, `prize-0`, `anchor:perch`, `anchor:prize-0`, `cat-floor` and the `cat:` markers. Commit the result as `libs/celebrations/src/stories/fixtures/cat-borrow-spike.lottie.json`, and record its bytes, layers, keyframes and vertices in `evidence/spike.md`.
  - Verification: a unit test in `libs/celebrations/src/utils/tests/cat-borrow-fixtures.spec.ts` asserts that the fixture passes 2.3–2.4 validation and the profile subset (no expressions, effects, text or images)
- [x] 3.3 Add the scene-specific `libs/celebrations/src/utils/cat-borrow-adapter.ts`, with types in `libs/celebrations/src/types/cat-borrow.ts` (string enums for anchors, sections and marker kinds) and `libs/celebrations/src/models/cat-borrow.ts`. It does the following:
  - resolves the five anchors, the sides and reachability (design D5)
  - selects the story
  - composes 2.1 and 2.3–2.6 into `prepare` on the anchored private copy
  - attaches the copies and registers `observeSceneTargets` in `onAnimationCreated`
  - starts the copies on `timelineZeroMs` in `onPlaybackStarted`

  Unit tests in `libs/celebrations/src/utils/tests/cat-borrow-adapter.spec.ts` cover the spec `celebration-ui-borrowing` scenarios for targets, anchors, retargeting, copies and malformed markers.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/cat-borrow-adapter.spec.ts`
- [x] 3.4 Add `libs/celebrations/src/stories/CatBorrowSpike.stories.tsx`. It plays the spike fixture through `LottieScene` with a story-only descriptor, which requires the capability but injects the adapter without adding it to `SUPPORTED_CELEBRATION_CAPABILITIES`. It runs on `ConversationInputHostPage`, with controls for width preset, direction, button height (32 or 56) and support presence.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:typecheck`
- [x] 3.5 Add `libs/celebrations/browser-tests/cat-borrow.browser.spec.mjs` and the Nx target `test-cat-borrow-browser`. It measures the D9 rows:
  - contact error at each `cat:contact`, sampled on the rendered frame nearest the marker (within 40 ms), across 16 cells
  - landing-to-recoil offset for drops of 24–600 px
  - the injected 200 ms long task under 4× throttling
  - frame-time p95, long tasks, SVG element count and heap, against the compiled Cat story, each sampled from its own start

  Also capture normal-speed recordings and contact frames.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-cat-borrow-browser`
- [x] 3.6 Count the spike code with the `celebration-migration-baseline` rule (scene-specific against generic, non-empty and non-test lines). Project the full asset's keyframes from the measured keyframes per second over three sections. Measure the preparation p50/p95 under 4× throttling with the 1.4 benchmark extended to the Cat. Write every D9 row with its value and pass/fail into `evidence/spike.md`.
  - Verification: `evidence/spike.md` lists all seven D9 rows with numbers and links to the recordings
- [x] 3.7 **Gate.** Record the decision in the "Gate result" section of `design.md`, and post the evidence summary as a comment on #9223. The reviewer's visual sign-off at actual size and normal speed is part of this record. On go, continue with section 4. On no-go, skip sections 4–7 and do section 8.
  - Verification: `design.md` "Gate result" names go or no-go, every failing row and the reviewer's sign-off
  - Outcome: go with amendments (code budget accepted, Lottie JSON caps raised to 512 KiB / 4,000 keyframes), decided from the measured evidence. The reviewer's visual sign-off on normal-speed recordings is still open and moves to task 6.3. Posting the evidence comment on #9223 waits for the user's approval of a draft (task 7.4).
- [x] 3.8 Apply the caps amendment: raise the JSON asset caps to 512 KiB in `apps/chat-api/src/celebrations/constants/celebrations.constants.ts` (`CELEBRATION_ASSET_MAX_BYTES`, `IMMUTABLE_STORE_MAX_ENTRY_BYTES`) and cover the new boundary in the existing BFF tests. Update `apps/chat-api/README.md` and `docs/architecture.md` where they cite 300 KiB.
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/tests/celebrations.controller.spec.ts apps/chat-api/src/celebrations/tests/immutable-resource.store.spec.ts` and `npm run validate:docs` (no README or doc cites the old cap; `celebrations-delivery-api` gets a delta)

## 4. Library contract and `LottieScene` integration (go only)

- [x] 4.1 Add `CelebrationCapability.InteractionCatBorrowV1 = 'interaction-cat-borrow-v1'` in `libs/celebrations/src/types/celebration-pack.ts`, and add it to `SUPPORTED_CELEBRATION_CAPABILITIES` in `libs/celebrations/src/constants/celebration-capabilities.ts`.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/celebration-descriptor-event.spec.tsx`
- [x] 4.2 Introduce the internal `PackSceneAdapter` seam in `libs/celebrations/src/utils/pack-scene-adapter.ts` (design D12) and move the composer-outline path onto it without changing behaviour. Then wire the cat-borrow adapter:
  - environment requirements, including `Element.prototype.animate`
  - the anchors compared for `isChanged`
  - the unsupported rules: a non-anchored placement, a direction other than `none`, both adapters
  - `onPlaybackStarted` composed after `setHasPlaybackStarted`
  - completion at the end of a trimmed section

  Update `libs/celebrations/src/components/LottieScene/LottieScene.tsx` and `libs/celebrations/src/utils/celebration-pack-scene.ts`.
  - Verification: `npm run test:file -- libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`, extended with the `celebrations-library` delta scenarios (copies start on `timelineZeroMs`, a starter anchor change, no Web Animations, a mirror or viewport-stage cat-borrow scene, a failure after the first frame restores the originals without a poster)
- [x] 4.3 Extend the adapter for sections: the two-prize path, the one-prize step at `cat:branch:one-prize`, and the crossing (trimmed `op`, edge anchors 24 px above the bottom). Add tests for story degradation when an elastic speed is out of bounds.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/cat-borrow-adapter.spec.ts libs/celebrations/src/utils/tests/cat-borrow-sections.spec.ts libs/celebrations/src/utils/tests/lottie-time-remap.spec.ts`
- [x] 4.4 Integration: add a test to `libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx` where `replaceCelebrationScenes` swaps the Halloween `cat` for a cat-borrow descriptor. It checks the same eleven click scenes and the no-repeat rule, a 27,750 ms lifetime, the `catToastMessage` notification, and that the bundled Cat does not start after a failure in the same activation.
  - Verification: `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx libs/celebrations/src/halloween/components/Halloween/tests/HalloweenCatScene.spec.tsx libs/celebrations/src/halloween/utils/tests/halloween-cat-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-cat-animation.spec.ts`
- [x] 4.5 Update `libs/celebrations/README.md`: the supported capability list, the cat-borrow behaviour next to the composer-anchor section (slots, markers, the time remap, copies, fallbacks and budgets), and the `CelebrationCapability` member. Update `docs/architecture.md` "Celebration packs" with the second adapter.
  - Verification: `npm run validate:docs`
- [x] 4.6 Architecture guard as in 2.7, plus a grep showing that `LottieScene`, the seam and the adapter receive only anchor class names, loaders and descriptors. Then run `npm run verify:changed`.

## 5. Full asset and publication (go only; cross-repository `epam/ai-dial-chat-themes`)

- [x] 5.1 Extend the bootstrap (design D10) to the full asset:
  - the `two-prizes` section, the `one-prize` tail and the `crossing` section
  - shared artwork precompositions and all anchor nulls
  - the poster, a static seated cat in SVG matching the reduced-motion pose

  Review it in the pinned player through `CatBorrowSpike.stories.tsx`, with the fixture swapped. Stop and amend this change with a `celebration-pack-contracts` caps delta if any cap is exceeded (design, "Risks").
  - Verification: `evidence/asset.md` records bytes, layers, keyframes per section and vertices against the caps
- [x] 5.2 In the themes repository, extend `scripts/check-celebration-packs.mjs` and `scripts/check-celebration-packs.test.mjs` with the D11 rules for scenes that require `interaction-cat-borrow-v1`, and raise its Lottie JSON caps to 512 KiB and 4,000 keyframes.
  - Verification: `node --test scripts/check-celebration-packs.test.mjs` in `epam/ai-dial-chat-themes`, including rejection cases for a duplicate bind, an unbound keyframe, an authored `tm`, `direction: mirror` and a viewport-stage placement
- [x] 5.3 Publish `static/celebrations/halloween-default/1.0.0/` with the manifest, `cat.<hash>.json` and `cat.poster.<hash>.svg`:
  - timing `25000 / 2000 / 250 / 27750`
  - placement as in design D4, with the mobile variant at scale 0.8
  - `direction: none`
  - scene required capabilities `lottie-light-svg-v1`, `composer-anchor-v1`, `interaction-cat-borrow-v1` and `static-poster-v1`; the pack-level list keeps only `lottie-light-svg-v1` and `static-poster-v1`, as the themes README requires, so a Chat release without the new capabilities skips just the scene and keeps the compiled Cat

  Bump `static/celebrations/index.json` with `defaults.halloween`.
  - Verification: `node scripts/check-celebration-packs.mjs` passes in the themes repository
- [x] 5.4 BFF compatibility: add a case to `apps/chat-api/src/celebrations/tests/celebration-manifest.normalizer.spec.ts` asserting that a cat-borrow manifest normalizes to the same scene, with markers and slots untouched (assets are opaque). Confirm the contract has not drifted.
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/tests/celebration-manifest.normalizer.spec.ts`, then `npm run openapi && npm run openapi:check` with no diff in `libs/chat-api-client`

## 6. End-to-end evidence on the full scene (go only)

- [ ] 6.1 Extend `libs/celebrations/browser-tests/cat-borrow.browser.spec.mjs` to the full asset:
  - two-button, one-button and crossing stories at 360/390/1280/1920 px in LTR and RTL, on real `ConversationInput` geometry
  - controlled load and readiness delays (a slow load gives the poster, a broken load the poster, a readiness timeout the poster)
  - cancellation before the first rendered frame, mid-push, after release and during the rebound
  - cached replay
  - reduced motion (poster only, no data or player request)
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-cat-borrow-browser`
- [ ] 6.2 Add a resource-retention test: 20 activations and interruptions at varied phases, then assert that:
  - no `[data-celebration-snapshot]` node remains, and no original holds an animation or a changed opacity
  - the window and document listener counts return to baseline (CDP `DOMDebugger.getEventListeners`), and no Lottie SVG node or pending timer remains (counted by an init-script timer shim)
  - the heap after `HeapProfiler.collectGarbage` is within the D9 tolerance
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-cat-borrow-browser`
- [ ] 6.3 Capture normal-speed recordings and reviewed contact frames for every story, layout and direction, and the side-by-side parity recordings at 390 and 1280 px. Record the visual deltas V1–V7 as confirmed or rejected, and the reviewer's sign-off, in `evidence/full-scene.md`. Attach the binaries to a comment on #9223.
  - Verification: `evidence/full-scene.md` links every recording and lists each delta's decision
- [ ] 6.4 Record the D14 code accounting from git objects at the branch head, the asset size and the rendering cost (frame-time p95, long tasks, SVG elements and heap, against the compiled Cat) in `evidence/full-scene.md`, as required before further DOM migrations are approved.
  - Verification: the table in `evidence/full-scene.md` lists the compiled lines, the adapter lines, the generic lines and the net removal available in S7/S8

  - Status: the 6.1 and 6.2 tests are implemented and corrected after the local review. Their recorded runs (`evidence/full-scene.md`) predate the review fixes, and the compiled heap reference is provisional. The preparation benchmark now also covers the full asset (`cat-borrow-full`): p95 36.0 ms at 1280 px and 27.9 ms at 390 px, within the 50 ms target (`evidence/full-scene.md`). Both tasks stay open until one complete run of `test-cat-borrow-browser` on the final tree is recorded.

## 7. Integration checks (go only)

- [ ] 7.1 In a test environment with `UI_EVENT=halloween`, `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=halloween/cat`, run the 6.1 browser spec against the deployed app's start page.
  - Verification: rollback by removing `halloween/cat` and bumping `UI_EVENT_DELIVERY_REVISION` stops an active scene, restores the buttons, and the next activation plays the compiled Cat
- [ ] 7.2 Run `npm run build:quiet`, because the `./packs` entry and the library chunking change. Compare `libs/celebrations/dist` chunk names and sizes and the `apps/chat` entry `modulepreload` list with the previous build (no `lottie_light` and no adapter code in the runtime or Halloween entries).
  - Verification: the comparison is recorded in `evidence/full-scene.md`
- [ ] 7.4 Draft the evidence comments for #9222 (S3 carry-over) and #9223 (gate and full scene), show them to the user, and post them only after approval. Link them from `evidence/s3-carry-over.md` and `evidence/full-scene.md`.
  - Verification: the user approved the drafts and the links resolve
- [ ] 7.3 Run `npm run verify:full` once, and record its result and any unrelated failures in `evidence/verification.md`.

## 8. No-go cleanup

Not applicable: the gate in 3.7 passed with amendments. Had it failed, the spike adapter, its fixture, story and browser spec, and any unused generic module would have been removed, and the delta specs amended to the S3 carry-over only.

## Workflow follow-up

- Archive the change after review. On go, the archive merges `celebration-ui-borrowing` and the four deltas into `openspec/specs/`. Then run `npm run validate:specs`.
- Production rollout of the external Cat belongs to S8 (#9227). The authoring-tool review and the merge-revision code accounting belong to #9226.

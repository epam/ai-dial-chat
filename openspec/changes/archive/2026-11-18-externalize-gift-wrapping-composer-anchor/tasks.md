<!--
Slicing strategy: risk-first inside the library, then contract-first across layers.
The riskiest claim is that root re-basing (design D3) plus the outline adapter (D6)
keeps contact. Slices 1–2 prove it with pure functions and a parity test against the
compiled composition before any public type or endpoint changes. Slices 3–4 ship the
library, 5–6 the BFF and app mapping, and 7 the themes pack. Everything stays inert
under the default `bundled` policy until an operator allowlists `new-year/gift-wrapping`.
-->

## 1. Shared composer helpers (behaviour-preserving extraction)

- [x] 1.1 Move the eligibility logic of `getGiftWrappingTarget` (`libs/celebrations/src/new-year/utils/gift-wrapping-targets.ts`) into `libs/celebrations/src/utils/composer-target.ts` as a function parameterized by `{ minWidth, headroom }` that returns the measured box and source, or `null`. Keep `getGiftWrappingTarget` as a thin caller with its current constants (230; 164/132) and its parcel box. Add unit tests in `libs/celebrations/src/utils/tests/composer-target.spec.ts` for four candidates at most, 24 ancestors, clipping, hidden/inert/aria-hidden ancestors, margins and the headroom.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/composer-target.spec.ts libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/gift-wrapping.spec.ts`
- [x] 1.2 Move `watchComposer` (`libs/celebrations/src/new-year/utils/gift-wrapping-animation.ts`) into `libs/celebrations/src/utils/composer-watch.ts`, and the interrupt effect of `NewYearGiftWrapping.tsx` into the internal hook `libs/celebrations/src/hooks/useComposerInterrupts.ts`, keeping the same 11 events and the `visualViewport` listeners. Change only mock module paths in the existing GiftWrapping tests (the S1 rule). Add `libs/celebrations/src/hooks/tests/useComposerInterrupts.spec.tsx`.
  - Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx libs/celebrations/src/hooks/tests/useComposerInterrupts.spec.tsx`
- [x] 1.3 Architecture guard: confirm that the new modules contain no `/api` paths, client imports, app contexts, env or flag access, and are not exported from `libs/celebrations/src/index.ts`. Then run `npm run verify:changed`.

## 2. Risk spike: anchor mapping and outline adapter as pure functions

- [x] 2.1 Add `libs/celebrations/src/utils/composer-anchor.ts`:
  - `resolveComposerAnchor`: the scale clamp, the eligibility floor `anchorRect.width × scale.min`, the headroom `anchorRect.y × s`, and the synthetic `stage-anchor` box (57 % of the height, 26 px bottom margin, 12 px side margins, otherwise the poster)
  - `rebaseStageOntoViewport(data, mapping)`: sets `w`/`h` to the viewport, adds one null layer with a fresh `ind`, and parents only the top-level layers that have no parent; mirror uses a negative x scale around the anchor center

  Unit tests in `libs/celebrations/src/utils/tests/composer-anchor.spec.ts` cover the spec scenarios "Wide desktop composer", "Narrow phone composer", "Composer narrower than the stage allows", "Viewport too narrow for the synthetic anchor" and the RTL anchor-center invariance, and check that the input object is left unchanged.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/composer-anchor.spec.ts`
- [x] 2.2 Add `libs/celebrations/src/utils/composer-outline-adapter.ts`:
  - validate the slots: exactly one `composer-outline` with an identity `ks` and one static `sh`, and at most one `composer-parcel` with one static `rc`
  - write the contour: start at the top center, inset 3, chamfer 10, in stage units
  - remove the parcel or resize it to the anchor

  Tests in `libs/celebrations/src/utils/tests/composer-outline-adapter.spec.ts` cover a missing slot, a duplicate slot, an animated path, a non-identity transform, a real composer versus a synthetic anchor, and untouched non-slot layers.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/composer-outline-adapter.spec.ts`
- [x] 2.3 Parity test: at reference geometry (desktop 520 × 56, mobile 300 × 56), the adapter's contour on a fixture equals the `composer-ribbon` path that `buildGiftWrappingComposition` produces. Commit only the small fixture `libs/celebrations/src/utils/tests/fixtures/composer-outline.lottie.json` (slot layers plus a stub actor layer). If the parity check fails, stop and record the finding in `design.md` before slice 3.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/composer-outline-adapter.spec.ts`

## 3. Library contract: types, enums and capabilities

- [x] 3.1 In `libs/celebrations/src/types/celebration-pack.ts`:
  - add the string enums `CelebrationAnchor`, `CelebrationAnchorEdge` and `CelebrationAnchorFallback`, and `CelebrationCapability.InteractionComposerOutlineV1`
  - update the JSDoc of `ComposerAnchorV1` (it is implemented now)

  In `libs/celebrations/src/models/celebration-pack.ts`, add `CelebrationComposerAnchorPlacement` and make `CelebrationPlacementDescriptor` a union discriminated by `template`. Export everything from `libs/celebrations/src/index.ts`.
  - Verification: `npm run typecheck:affected`
- [x] 3.2 Add `composer-anchor-v1` and `interaction-composer-outline-v1` to `SUPPORTED_CELEBRATION_CAPABILITIES` (`libs/celebrations/src/constants/celebration-capabilities.ts`). Update `isCelebrationSceneSupported` (`libs/celebrations/src/utils/celebration-pack-scene.ts`) so it accepts both placements and rejects the outline capability without anchor placement. Extend its tests.
  - Verification: `npm run test:file -- libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`
- [x] 3.3 Update `libs/celebrations/README.md` (capabilities, the placement union, the new enums, a compiling example of a composer-anchor descriptor). Run `npm run validate:docs`.

## 4. `LottieScene` anchored placement

- [x] 4.1 In `libs/celebrations/src/components/LottieScene/LottieScene.tsx`, branch on `placement.template`. For `composer-anchor-v1`:
  - show the poster without loading when reduced motion is on or `ResizeObserver`/`MutationObserver` is missing
  - `prepare` makes a JSON copy, resolves the anchor through `anchors.composer` from `useCelebrationEnvironment`, re-bases, and runs the adapter when the capability is required
  - use `Transferred` ownership, `onAnimationCreated` from `composer-watch`, and `useComposerInterrupts`
  - render a full-layer host (`absolute inset-0 overflow-clip`, `inert`) with `data-celebration-anchor="composer|stage-anchor"`

  Keep `playback` memoised on timing and placement. The viewport-stage branch must stay unchanged.
  - Verification: `npm run test:file -- libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`
- [x] 4.2 Add `LottieScene.spec.tsx` cases for the spec scenarios:
  - a focused composer keeps its draft and selection
  - composer removed → stage-anchor
  - no observer APIs → poster with no player import
  - keypress → cancel with single teardown
  - renderer SVG mutations ignored
  - a missing slot → poster
  - two activations from one cached object at 900 and 340 px: the cached object stays deep-equal and the player inputs differ
  - a late resolution after cancel → no renderer and no measurement
  - RTL mirror keeps the anchor center

  Query by role or by the `data-celebration-anchor` attribute, not by class names.
  - Verification: `npm run test:file -- libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`
- [x] 4.3 Add a composer-anchor story to `libs/celebrations/src/stories/LottieScene.stories.tsx`, using `StoryHostPage` and a fixture in `libs/celebrations/src/stories/fixtures/` with LTR, RTL, narrow and missing-composer controls. Keep `story-coverage.spec.ts` green.
  - Verification: `npm run test:file -- libs/celebrations/src/stories/tests/story-coverage.spec.ts`
- [x] 4.4 Architecture guard for `libs/celebrations`: no `fetch`, no URL construction, no host selectors beyond `anchors.composer`, no i18n, no new public hook. Run `npm run verify:changed` and `npm run build:quiet` (the lazy `packs` chunk is affected).

## 5. BFF: validated composer-anchor placement and OpenAPI

- [x] 5.1 In `apps/chat-api/src/celebrations/dto/celebration-pack.dto.ts`, add `CelebrationAnchorRectDto`, `CelebrationAnchorScaleDto` and the enums `CelebrationAnchor`, `CelebrationAnchorEdge` and `CelebrationAnchorFallback` (in `apps/chat-api/src/celebrations/types/`). Add the optional `anchor`, `anchorRect`, `edge`, `scale` and `fallback` to `CelebrationPlacementDto`, with `@ApiPropertyOptional` metadata, following `apps/chat-api/AGENTS.md`.
- [x] 5.2 Extend `readPlacement` in `apps/chat-api/src/celebrations/celebration-manifest.normalizer.ts` with the `composer-anchor-v1` branch and its bounds (finite numbers, `width ≥ 120`, `height ≥ 24`, `0.25 ≤ min ≤ max ≤ 4`, enum values), rejecting with the existing `warn` logging. Other templates keep the ID-only pass-through. Add tests to `apps/chat-api/src/celebrations/tests/celebration-manifest.normalizer.spec.ts` (forwarded values, `edge: left`, NaN, `min > max`, unknown template still ID-only) and to `celebrations.controller.spec.ts` (502 for an invalid placement, using the supertest pattern already in the file).
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/tests/celebration-manifest.normalizer.spec.ts apps/chat-api/src/celebrations/tests/celebrations.controller.spec.ts`
- [x] 5.3 Run `npm run openapi` and `npm run openapi:check`, then `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Confirm that `getCelebrationPack` is still a normal generated method and that no generated file was hand-edited.

## 6. App mapping

- [x] 6.1 Extend `toPlacement` in `apps/chat/src/utils/celebration-pack.ts` to map a valid composer-anchor DTO to `CelebrationComposerAnchorPlacement`, dropping the scene when a field is missing. Create `apps/chat/src/utils/tests/celebration-pack.spec.ts` (no test covers this module yet) and update `apps/chat/src/hooks/celebration/tests/useCelebrationPacks.spec.ts`: a composer-anchor scene is now kept, and an allowlisted `gift-wrapping` replaces the bundled one, stays in the secret pool and keeps `giftWrappingToastMessage`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/celebration-pack.spec.ts apps/chat/src/hooks/celebration/tests/useCelebrationPacks.spec.ts apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx`
- [x] 6.2 Run `npm run verify:changed`. No i18n keys are added; confirm that `apps/chat/src/i18n/locales/en.json` is unchanged.

## 7. Themes repository (`epam/ai-dial-chat-themes`, separate PR)

- [ ] 7.1 Bootstrap the variants once with a throwaway script in the scratchpad, never committed (design D10). Generate desktop (stage 1200 × 280, anchor 520 × 56 at 340/164, size 0.9) and mobile (stage 720 × 240, anchor 300 × 56 at 210/132, size 0.68) in their own frames from design D2. Rename the slots, always emit `composer-parcel`, and write minified JSON. Review the result in `lottie_light` 5.13.0 and in an authoring tool. Measure each variant against the ceilings (≤ 12 top-level layers, ≤ 1,400 keyframes, ≤ 240 KB, ≤ 500 SVG descendants, ≤ 180 paths).
  - Done so far (2026-11-18): both variants generated in their own frames, 110,328 / 109,566 B, 6 layers, 566 keyframes, 1,172 vertices, 16,000 ms at 60 fps. Rendered in Chromium with `lottie_light` 5.13.0 with no errors: at most 318 SVG descendants and 167 paths, no filters or masks. Contact frames at 4.3 / 6.4 / 8.5 / 15 s reviewed. Still open: a review in an authoring tool.
- [x] 7.2 Export the poster from the `data-gift-static` art as a static SVG (no script, `foreignObject` or animation, ≤ 100 KiB).
- [x] 7.3 Publish `static/celebrations/new-year-default/1.1.0/` with the `bullfinch-couriers` assets reused under the same IDs and the `gift-wrapping` scene. The scene uses the placement from design D2, `requiredCapabilities` `[lottie-light-svg-v1, composer-anchor-v1, interaction-composer-outline-v1, static-poster-v1]`, timing `16000/2000/250/18500`, `direction: mirror`, no `labels` entry for it, and a `posterDurationMs` of 4000. Then bump `static/celebrations/index.json` (`defaults.new-year` → `1.1.0`, new `revision`), keeping `1.0.0` as the rollback target.
- [x] 7.4 Extend `scripts/check-celebration-packs.mjs` with the composer-anchor field bounds and the outline slot rules for scenes that require `interaction-composer-outline-v1`. Add failing fixtures for each rule, then run the check in that repository's CI.

## 8. End-to-end evidence, measurement and docs

- [ ] 8.1 Add `libs/celebrations/browser-tests/gift-wrapping-external.browser.spec.mjs`, modeled on `new-year-character-motion.browser.spec.mjs`. It covers:
  - normal-speed recordings and contact frames (wrap, pull, cocoon reveal, departure) at 360, 390, 1280 and 1920 px in LTR and RTL
  - the missing composer → parcel
  - reduced motion → poster
  - slow and broken assets
  - cancellation during load and playback
  - two replays with cached data

  Attach the artifacts to a comment on #9222 and commit a summary under `openspec/changes/externalize-gift-wrapping-composer-anchor/evidence/`.
- [ ] 8.2 Measure the preparation time under 4× CPU throttling (target ≤ 50 ms, design D8). Record the departure and desktop eligibility-floor deltas from design "Risks" in the evidence summary.
- [ ] 8.3 Record the code table from design D12: the compiled scene-specific lines against the external path's lines, counted with the `celebration-migration-baseline` rule. Add it to `design.md` and to the #9222 comment.
- [x] 8.4 Update the celebrations section of `docs/architecture.md` (composer anchoring, the first adapter, the GiftWrapping pack) and the `UI_EVENT_EXTERNAL_SCENES` example in `apps/chat-api/README.md`. Then run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`.
- [ ] 8.5 Run `npm run verify:full` once.

## Workflow follow-up

- After review, sync the delta specs and archive the change (`opsx:archive`).
- Out of scope, record only: deleting the compiled GiftWrapping and `gift-wrapping-elves.json` (S7/S8); an `interaction` parameter for edge-relative departure, if design asks for it; migrating ReindeerTakeoff and SnowmanDelivery onto `composer-anchor-v1` (S7 #9226); confirming production rollout and rate limits (S8 #9227).

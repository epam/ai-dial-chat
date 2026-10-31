## 1. Risk-first story slice

- [x] 1.1 Build measured staging, native reindeer artwork, shared ribbon/button timeline and bounded session in `libs/celebrations/src/new-year/utils/reindeer-*.ts` and `components/NewYearReindeerTakeoff/`.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/reindeer-takeoff.spec.ts` and `libs/celebrations/src/new-year/components/NewYearReindeerTakeoff/tests/NewYearReindeerTakeoff.spec.tsx`.
- [x] 1.2 Add dedicated geometry, contact, budget, fallback and cancellation unit tests for the new utilities and component. Verify extensionless imports and no host API/client/context/env/router/storage/telemetry knowledge in the library.
  Verification: the same two exact test files via `npm run test:file --`.

## 2. Integration and adaptation

- [x] 2.1 Register ReindeerTakeoff, its deadline and secret-pool membership in the New Year event, overlay and constants; update event tests.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`.
- [x] 2.2 Add optional library label, English default, app `NewYearI18nKeys` member and `newYear.reindeerTakeoffToastMessage` in `apps/chat/src/i18n/locales/en.json`.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`.
- [x] 2.3 Verify RTL, mobile story parity and static reduced motion; add dedicated Storybook variants in `new-year/stories/NewYearScenes.stories.tsx`.
  Verification: both new test files and `libs/celebrations/src/stories/tests/story-coverage.spec.ts` via `npm run test:file --`; automate browser playback/contact screenshots and performance/resource sampling at 360/900/1280/1920.

## 3. Documentation and final verification

- [x] 3.1 Update `libs/celebrations/README.md` and record actual browser/profile evidence in this change's verification notes. Update the existing event, gift-wrapping and penguin-star specs through deltas, preserving their full modified requirements.
  Verification: event tests via `npm run test:file --`; `npm run validate:docs`, `npm run validate:specs`, and OpenSpec validation.
- [x] 3.2 Complete one `npm run verify:changed`, one `npm run verify:full`, and `npm run build:quiet`; address relevant failures and document unrelated failures precisely.
  Verification: commands above plus the focused test files from prior tasks.

## 4. Readability corrections after playback feedback

- [x] 4.1 Make the entrance traverse the measured desktop stage, borrow a reachable starter card when the composer button is blocked, and keep the complete flying formation visible before a natural exit. Preserve the existing host-anchor boundary and cleanup contract.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/reindeer-takeoff.spec.ts libs/celebrations/src/new-year/components/NewYearReindeerTakeoff/tests/NewYearReindeerTakeoff.spec.tsx`.
- [x] 4.2 Assert real UI borrowing and airborne visibility in the browser at 360/900/1280/1920, inspect contact/departure frames, profile playback and repeated cancellation, and update the README, design and verification record.
  Verification: `node libs/celebrations/browser-tests/reindeer-takeoff.browser.spec.mjs`, Nx library checks, `npm run validate:docs`, and `openspec validate add-new-year-reindeer-takeoff --strict`.

## 5. Composer ledge, caught word and snow wake

- [x] 5.1 Replace the below-page stage and borrowed buttons with a measured composer rim and one inert word fragment from the textarea value or placeholder. Lift the word under ribbon tension, preserve the live editor, and keep nose contact/RTL/restoration synchronized.
  Verification: exact reindeer utility and component test files from task 4.1, plus `libs/celebrations/src/new-year/utils/tests/reindeer-text.spec.ts`.
- [x] 5.2 Add a bounded snow wake deposited along the actual airborne sleigh path, update stories and browser assertions for rim support, text preservation, snow persistence and full departure, then update design/spec/README/verification.
  Verification: `node libs/celebrations/browser-tests/reindeer-takeoff.browser.spec.mjs`, `npm run verify:changed`, `npm run verify:full`, celebrations Nx build, documentation and strict OpenSpec validation.

## 6. Weight, contact and inertia

- [x] 6.1 Replace time-only leg swings with distance-driven planted hooves and articulated joint solving; add body compression, readable calf turns, a continuous flight arc and delayed sleigh response. Derive ribbon, harness and snow emission points from the rendered poses.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/reindeer-physics.spec.ts libs/celebrations/src/new-year/utils/tests/reindeer-takeoff.spec.ts` plus native browser contact sampling.
- [x] 6.2 Check complete playback, mobile/desktop/RTL geometry, rendering budgets and cancellation; update design/spec/README/verification and complete repository checks.
  Verification: the reindeer browser script, focused component/text tests, changed/full verification, celebrations build and strict docs/spec validation.

## 7. Character artwork and acting

- [x] 7.1 Redraw the adult and calf with distinct silhouettes, shaped torso/neck contours and expressive faces in `reindeer-art.ts`; block the pull/reaction/nose-release poses in `reindeer-composition.ts` before extending the motion. Preserve the composer, word and snow story and existing rendering budgets.
  Verification: actual-size browser captures at 360 and 1280; `npm run test:file -- libs/celebrations/src/new-year/utils/tests/reindeer-takeoff.spec.ts`.
- [x] 7.2 Coordinate neck, head, gaze and ears; give grounded legs an anatomical bend and staggered support, replace airborne pedalling with launch/tuck/glide poses, and update `ReindeerStill.tsx` to match the artwork. Keep rendered contacts and fallback lifecycle intact.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/reindeer-physics.spec.ts libs/celebrations/src/new-year/utils/tests/reindeer-takeoff.spec.ts libs/celebrations/src/new-year/components/NewYearReindeerTakeoff/tests/NewYearReindeerTakeoff.spec.tsx`; normal-speed browser captures and native contact checks at 360/900/1280/1920, including RTL.
- [x] 7.3 Record visual comparisons and runtime evidence, update README/spec/design, and complete changed/full checks and the celebrations build. Verify that all changes remain scene-local and preserve the existing host boundary.
  Verification: reindeer browser script, `npm run verify:changed`, `npm run verify:full`, celebrations Nx build, docs/spec validation and strict OpenSpec validation.

## 1. Bounded choreography (risk-first slice)

Strategy: prove bounded selection and deterministic choreography first, then connect one complete playback path, then broaden lifecycle and responsive coverage. Follow the root AGENTS.md (no lib-local AGENTS.md exists), library isolation and styling rules. No host/API/auth/router/storage/i18n imports; keep extensionless code imports and bundler resolution.

- [x] 1.1 Implement `libs/celebrations/src/halloween/utils/halloween-witch-targets.ts` and `halloween-witch-plan.ts` with bounded safe button selection, the six story beats, one/two/no-target plans, exact restoration and explicit performance limits.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-witch-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-witch-plan.spec.ts`.

- [x] 1.2 Add dedicated behavior/unit coverage for both utilities in the files above: target safety/size/scan caps, mobile budget, finite tracks, contact/landing order, exact return, no mutation and frame/animation budgets.

  Verification: the same two test files; run `npm run verify:changed` once for this completed slice.

## 2. Complete spell lesson (depends on 1)

- [x] 2.1 Add `HalloweenWitches.tsx`, articulated `HalloweenWitch.tsx` and its illustration stylesheet under `libs/celebrations/src/halloween/components/Halloween/`, plus `utils/halloween-witch-animation.ts`. Connect snapshots, frog features, shared animation clock, static fallback and idempotent cancellation. Wire `HalloweenBurstOverlay.tsx` and the Witches-only deadline in `constants/halloween.ts`; retire the obsolete Witches generic-flight code without changing Bats/New Year.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/components/Halloween/tests/HalloweenWitches.spec.tsx libs/celebrations/src/halloween/utils/tests/halloween-witch-animation.spec.ts libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx libs/celebrations/src/halloween/utils/tests/halloween.spec.ts`.

- [x] 2.2 Add dedicated animation/component tests in the files above for preserved draft/focus/selection, coherent frog/copy timing, no playback layout polling, failed setup, every interruption, source resize/mutation, toast removal, StrictMode, repeat cleanup and unsupported/reduced motion. Update existing lifetime assertions that assumed only Cat/Bats exceed fourteen seconds.

  Verification: the task 2.1 files plus `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-bat-plan.spec.ts`; run `npm run verify:changed` after the complete playback slice.

## 3. Responsive parity, documentation and completion (depends on 2)

- [x] 3.1 Verify RTL and responsive geometry at 360/900/1280/1920 using automated browser playback of the existing Witches Storybook story; preserve readable unmirrored copies and one mobile target. Record representative frames and setup/steady-state performance/resource evidence, including cancellation/replay and reduced motion. Add or adjust geometry regression cases without editing the user's `StoryHostPage.tsx` changes.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-witch-plan.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenWitches.spec.tsx libs/celebrations/src/stories/tests/story-coverage.spec.ts`; automated browser assertions and captured evidence.

- [x] 3.2 Update `libs/celebrations/README.md` and the Witches enum documentation for actual behavior and limits. Complete the five-axis quality review, library test/lint/build and docs validation; run `npm run verify:full` once and `npm run build:quiet` for changed bundling, recording any external/pre-existing failures precisely.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx libs/celebrations/src/stories/tests/story-coverage.spec.ts`; Nx test/lint/build for `@epam/ai-dial-celebrations`, `npm run validate:docs`, full verification and affected build results.

## 4. Motion-quality refinement (depends on 1–3)

Use one complete choreography slice. Preserve the existing scene, host-agnostic boundary, extensionless imports, library styling rules and performance limits; retain the user's StoryHostPage and local click-pool edits.

- [x] 4.1 Refine `halloween-witch-plan.ts` and spell positioning in `HalloweenWitches.tsx`: exact posed-hand spell origins, held broom-cast pose and contact, differentiated casting/flight easing, precomputed curved travel, ballistic hops with anticipation/landing recovery, delayed secondary motion and continuous snapshot handoff. Add regression cases to `utils/tests/halloween-witch-plan.spec.ts` for these geometric/timing guarantees.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-witch-plan.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-witch-animation.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenWitches.spec.tsx`; `npm run verify:changed` after this slice.

- [x] 4.2 Compare before/after browser frames and uninterrupted playback in the existing Witches story, verify palm/contact/handoff coordinates on desktop/mobile/RTL, repeat the layout/cancellation checks and active-phase performance profile, update README/verification evidence and review the final changes.

  Verification: the task 4.1 tests, automated browser scripts in `tmp/witches-polish/`, Nx library typecheck/lint/test/build, `npm run validate:docs`; one final `npm run verify:full` for the refined implementation, recording existing failures without unrelated edits.

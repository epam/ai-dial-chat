## 1. Bounded geometry and contact plan

Strategy: risk-first selection/geometry slice, then one complete playback slice, then responsive/performance evidence. Root AGENTS.md applies (no celebrations-local AGENTS.md). Keep library isolation, library styling, extensionless imports and bundler resolution; do not introduce app routes, flags, contexts, i18n, APIs, persistence or dependencies.

- [x] 1.1 Implement `libs/celebrations/src/halloween/utils/halloween-footprint-targets.ts` and `halloween-footprint-plan.ts`: safe bounded starter selection, 8/12 prints, coherent card contacts and shared copy/print transforms, the complete twelve-second timeline, exact handoff and no-target route.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-footprint-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-footprint-plan.spec.ts`.

- [x] 1.2 Add dedicated tests in those two files for focused/hidden/clipped/disabled/oversized/transformed targets, traversal limits, geometry bounds, contact-before-reaction, restoration, last reveal, deterministic fallback and keyframe budgets. Run `npm run verify:changed` after this slice.

  Verification: the task 1.1 tests and affected verification; record unrelated failures.

## 2. Complete invisible-cat playback (depends on 1)

- [x] 2.1 Add `components/Halloween/HalloweenFootprints.tsx`, its illustration stylesheet and `utils/halloween-footprint-animation.ts`. Connect inert snapshots, detailed paws/face, shared animation clock, static fallback and idempotent interruption cleanup. Remove only the old Footprints renderer/styles from Extras and update `HalloweenBurstOverlay.tsx`.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/components/Halloween/tests/HalloweenFootprints.spec.tsx libs/celebrations/src/halloween/utils/tests/halloween-footprint-animation.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenExtras.spec.tsx`.

- [x] 2.2 Add dedicated playback/component regression tests for preserved draft/focus/selection, budgeted SVG/animations, no frame polling, every interruption, mutation/resize/removal, unrelated toast changes, unsupported/reduced motion, StrictMode, canceled preparation, setup failure and repeat cleanup. Run `npm run verify:changed` after the complete playback slice.

  Verification: the task 2.1 tests, task 1.1 tests and affected verification.

## 3. Responsive evidence and completion (depends on 2)

- [x] 3.1 Verify the existing Footprints Storybook story at 360/900/1280/1920, mobile/desktop RTL, reduced motion and no targets. Capture before/after real-size frames and natural playback, test exact rendered card contact/handoff, inspect light/dark backgrounds, profile mobile 4× CPU and desktop, and confirm no resource accumulation.

  Verification: automated browser scripts/evidence under `tmp/footprints-implementation/`; `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-footprint-plan.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenFootprints.spec.tsx libs/celebrations/src/stories/tests/story-coverage.spec.ts`.

- [x] 3.2 Update `libs/celebrations/README.md` and this change's verification evidence. Perform the five-axis review, run Nx celebrations typecheck/lint/test/build and docs validation, then exactly one `npm run verify:full` and an affected `npm run build:quiet` for final bundling; record existing failures without unrelated edits.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx`; the Nx targets, `npm run validate:docs`, strict OpenSpec validation and `git diff --check`.

## 4. Embedded chat regression

- [x] 4.1 Correct `utils/halloween-footprint-targets.ts` so safe starters below the composer are eligible, while overlapping/unsafe targets remain excluded. Add a failing-then-passing geometry regression and a Footprints Storybook host layout that follows the real chat's composer-before-starters order. Verify rendered contact/restore in the real local chat or an equivalent host fixture at mobile/desktop and RTL. Preserve the performance caps and the user's local scene-selection override.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-footprint-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-footprint-plan.spec.ts libs/celebrations/src/stories/tests/story-coverage.spec.ts`; browser evidence in `tmp/footprints-host-fix/`; affected checks and scoped lint/typecheck/build; update verification evidence.

## 5. Composer-only contact

- [x] 5.1 Extend the private Footprints target/plan/playback/component modules to use a safe composer ledge when no starter exists. Measure it independently of starter anchors, animate a lightweight outline and attached prints together, retain the live draft/focus/selection and cleanup, and keep 8/12 prints with 13/17 tracks. Add selector/plan/playback/component regressions.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-footprint-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-footprint-plan.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-footprint-animation.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenFootprints.spec.tsx`. Library isolation: use only existing anchors and computed presentation, no app selectors, data or public API.

- [x] 5.2 Add a composer-only Storybook variant, exercise mobile/desktop, RTL, reduced motion and input/resize cleanup, and profile the new variant. Update README/verification, run slice affected verification and scoped typecheck/lint/build, docs/spec/diff validation. Preserve the user's Footprints-only selection override.

  Verification: story-coverage test, browser scripts in `tmp/footprints-composer/`, `npm run verify:changed`, Nx celebrations typecheck/lint/build, `npm run validate:docs`, strict OpenSpec validation and `git diff --check`.

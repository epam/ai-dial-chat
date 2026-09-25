## 1. Target and timeline contracts

Strategy: contract-first geometry and actor timeline, followed by a complete scene slice and bounded browser verification. All imports remain extensionless; no library or core-component changes.

- [x] 1.1 Add bounded discovery in `apps/chat/src/utils/halloween-bat-targets.ts` and staged crosswind plan in `halloween-bat-plan.ts`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-targets.spec.ts`; `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-plan.spec.ts`.
- [x] 1.2 Add dedicated target/plan tests for safe surfaces, grip geometry, wingbeat-driven responses, bounded flight paths and staggered exits in those two test files.
  - Verification: run the exact files listed in 1.1.

## 2. Complete decorative scene

Depends on section 1 contracts.

- [x] 2.1 Add expressive `HalloweenBat.tsx`, `HalloweenBats.tsx`, `HalloweenBats.module.scss`, and `apps/chat/src/utils/halloween-bat-animation.ts`; route Bats in `HalloweenBurstOverlay.tsx`. Preserve Witch rendering, Bats-only preview configuration and all previous Raven/Ghost work.
  - Verification: `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenBats.spec.tsx`; `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-animation.spec.ts`.
- [x] 2.2 Add dedicated controller/component tests for interruption, anchor mutation, deferred preparation, reduced-motion/no-WAAPI and missing-anchor fallbacks, with no focused-composer copies or draft changes.
  - Verification: run the exact files listed in 2.1, then `npm run verify:changed` once for the completed slice.
- [x] 2.3 Verify mobile/RTL physical attachment and stroke-to-reaction timing, bounded artwork/copies and natural/interrupted cleanup using an automated browser fixture; profile preparation/playback under CPU throttling.
  - Verification: run the automated fixture at 360/900/1280/1920px in LTR and RTL, plus reduced motion and cleanup cases; rerun `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-plan.spec.ts` after geometry fixes.
- [x] 2.4 Apply the user's motion refinement in `halloween-bat-plan.ts` and Bats' scene-specific duration in `apps/chat/src/constants/halloween.ts`: preserve momentum through path knots, decelerate at rests, maintain wingbeat phase, soften surface oscillations and allow 17.5 seconds of playback before eighteen-second unmount.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-plan.spec.ts`; `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-animation.spec.ts`; repeat the automated browser geometry/performance check for the final timing.
- [x] 2.5 Apply the user's further realism refinement in `HalloweenBat.tsx`, `HalloweenBats.tsx`, `HalloweenBats.module.scss`, `halloween-bat-plan.ts` and `halloween-bat-animation.ts`: remove airflow SVG entirely, articulate shoulder/outer wings, add restrained body lift and time UI responses from actual downstrokes.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-plan.spec.ts`; `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-animation.spec.ts`; `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenBats.spec.tsx`; browser check confirms no rays and intact attachment/cleanup.
- [x] 2.6 Fix premature cancellation in `halloween-bat-animation.ts` when the success notification portal disappears after five seconds. Unrelated ancestor child-list changes must preserve the scene when anchor geometry is unchanged; real anchor/layout changes and user interaction must still stop it.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-bat-animation.spec.ts`; automated browser reproduction before/after at mobile and desktop confirms full natural playback through toast dismissal and cleanup on a genuine layout shift.

## 3. Documentation and final checks

Depends on completed scene.

- [x] 3.1 Update bat behavior in `apps/chat/README.md`, validate this OpenSpec change, and run `npm run validate:docs`, `npm run verify:full` exactly once and `npm run build:quiet`. Record unrelated existing failures without drive-by changes. Leave the change active for the user's archive request.
  - Verification: all four exact test files above pass; scoped Nx typecheck and OpenSpec validation pass; record full-check/build/docs outcomes here.

## Verification record

- Target, plan, controller and component suites: 29 + 23 + 36 + 23 = 111 tests pass through Nx on Node 24.
- Browser geometry, visible story phases, articulated wings with no airflow paths, focused-draft restoration and reduced motion pass at 360/900/1280/1920px in both LTR and RTL. The screenshot fixture preserves the caret: Playwright's default caret-hiding mutates the composer style and correctly interrupts the scene.
- Final 17.5-second playback at 4× CPU: 206/210 scene nodes, 36/40 animations, 3/5 copies (mobile/desktop); setup 52.7/54.7ms, p95 frame 9.2ms, no long tasks or layout/style reads during uninterrupted playback. After 17.8s all copies/animations are gone, original opacities restored, draft/focus/backward selection preserved.
- Notification interruption regression: before the fix, browser playback ended at 5003.7ms with unchanged composer geometry; three new controller tests failed while the prior 36 passed. After the fix, all 39 controller tests pass. At 360/1280px the scene survives toast dismissal and naturally ends at 17522.8/17520.6ms, leaving zero copies/animations and preserving the draft. A genuine composer layout shift still cancels immediately. Only ambiguous ancestor child-list batches trigger bounded geometry checks; unrelated descendant mutations trigger none. Scoped controller lint/typecheck pass (existing fixture non-null-assertion warnings only).
- `verify:changed`: affected typecheck passed; lint stopped at the existing import-order error in `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`.
- `verify:full` ran once: full typecheck passed; lint stopped at that same error plus existing formatting/import-order errors in `libs/conversation-input/src/components/Input/tests/Input.command-menu.spec.tsx`, `libs/conversation-input/src/hooks/tests/useModelSelector.spec.tsx`, and `libs/conversation-input/src/hooks/useComposerSeed.ts`. Its subsequent full-test stage did not run. These files were not changed.
- Documentation and strict change validation pass. No core/library/provider edits; the Bats-only preview pool and earlier Raven/Ghost changes are preserved.
- Final affected production build and scoped Bats lint/typecheck pass. Lint has only non-null-assertion warnings in test fixtures, with no errors.

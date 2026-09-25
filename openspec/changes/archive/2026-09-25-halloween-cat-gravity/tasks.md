## 1. Target and motion contracts

Strategy: contract-first geometry/artwork, followed by one complete scene slice. Preserve existing edits and the Cat-only preview pool; all code imports stay extensionless and no libraries/core components change.

- [ ] 1.1 Add bounded button/anchor discovery in `apps/chat/src/utils/halloween-cat-targets.ts` and the contact-driven timeline in `halloween-cat-plan.ts`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-cat-targets.spec.ts`; `npm run test:file -- apps/chat/src/utils/tests/halloween-cat-plan.spec.ts`.
- [ ] 1.2 Add dedicated utility tests for exclusion/budget, physical contact, tentative/decisive pushes, accelerating falls, rebound/recoil, one-button and unavailable-anchor fallback in those two test files.
  - Verification: run the exact two files from 1.1.

## 2. Complete scene

Depends on section 1 contracts.

- [ ] 2.1 Add articulated `apps/chat/src/components/Halloween/HalloweenCat.tsx` and `HalloweenCatScene.module.scss`; replace `HalloweenCatScene.tsx` and add `apps/chat/src/utils/halloween-cat-animation.ts`. Give Cat its own duration in `apps/chat/src/constants/halloween.ts` while preserving the preview pool.
  - Verification: `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenCatScene.spec.tsx`; `npm run test:file -- apps/chat/src/utils/tests/halloween-cat-animation.spec.ts`.
- [ ] 2.2 Add controller/component tests for natural/interrupted restoration, deferred preparation cancellation, unchanged toast portals, real anchor shifts, reduced motion and fallback.
  - Verification: run the exact two files from 2.1; run `npm run verify:changed` once when the slice is complete.
- [ ] 2.3 Verify RTL/mobile geometry and performance in an automated browser fixture at 360/900/1280/1920px in LTR/RTL, including real paw contacts, original draft/selection/focus preservation and natural/interrupted cleanup.
  - Verification: browser fixture and `npm run test:file -- apps/chat/src/utils/tests/halloween-cat-plan.spec.ts` after any geometry correction; no per-frame measurement and bounded snapshots.

## 3. Documentation and final checks

Depends on the completed scene.

- [ ] 3.1 Update Cat behavior in `apps/chat/README.md`, run `npm run validate:docs`, strict OpenSpec validation, `npm run verify:full` exactly once and `npm run build:quiet`. Record unrelated failures without changing their files; leave this change active for archive approval.
  - Verification: all four exact test files above and scoped Nx lint/typecheck pass; record full verification/build/docs results below.

## Verification record

Pending.

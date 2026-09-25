## 1. Bounded possession slice

Strategy: contract-first within the scene, then vertical integration. Existing raven work and preview selection remain outside this change.

- [x] 1.1 Add `apps/chat/src/utils/halloween-ghost-targets.ts` and `halloween-ghost-plan.ts` for safe distributed homes and a finite synchronized story; preserve extensionless code imports and bundler resolution.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-ghost-targets.spec.ts` and `npm run test:file -- apps/chat/src/utils/tests/halloween-ghost-plan.spec.ts`.

- [x] 1.2 Add dedicated targeting/planning tests for unsafe controls, bounds, distinct destinations, phase ordering and fallback.

  Verification: the two exact Vitest files above.

## 2. Complete story and restoration

- [x] 2.1 After 1.1, implement `HalloweenGhosts.tsx`, its styles/artwork and `halloween-ghost-animation.ts`; route only Ghost in `HalloweenBurstOverlay.tsx`, preserving fallback and notification behavior.

  Verification: `npm run test:file -- apps/chat/src/components/Halloween/tests/HalloweenGhosts.spec.tsx` and `npm run test:file -- apps/chat/src/utils/tests/halloween-ghost-animation.spec.ts`.

- [x] 2.2 Add dedicated playback/component tests for restoration, mutations, replacement, canceled preparation, reduced motion, unsupported WAAPI and sticky cancellation across viewport/preference changes.

  Verification: the two exact Vitest files above; run `npm run verify:changed` after this complete slice.

## 3. Direction, documentation and final checks

- [x] 3.1 Verify mobile/desktop and RTL geometry, decorative semantics and bounded rendering in an automated browser fixture at 360, 900, 1280 and 1920px; measure setup/frame behavior under CPU throttling.

  Verification: ghost targeting/planning/component tests above and fixture assertions; physical decoration coordinates are intentional and must not mirror twice.

- [x] 3.2 Update `apps/chat/README.md` with the resulting Ghost story and fallback/cleanup behavior. Validate docs and OpenSpec, run exactly one `npm run verify:full` and `npm run build:quiet` for the new stylesheet/component bundle.

  Verification: `npm run validate:docs`, `openspec validate halloween-ghost-possession --strict`, verification/build commands and the four exact Ghost Vitest files above. Report unrelated failures without drive-by fixes.

## Verification results

- Targeted Nx regression run: 186 tests passed across nine files, including 89 new Ghost targeting/planning/playback/component tests, existing flight helpers and celebration runtime/context/decor tests.
- Chat typecheck and full workspace typecheck passed. Affected production build passed. Docs validation (48 files), scoped formatting, OpenSpec strict validation and diff whitespace checks passed.
- `verify:changed` ran once; new lint findings were corrected and verified by scoped lint. `verify:full` ran exactly once after those fixes. Full verification stops at pre-existing lint errors in `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`, `libs/conversation-input/src/components/Input/tests/Input.command-menu.spec.tsx`, `libs/conversation-input/src/hooks/tests/useModelSelector.spec.tsx` and `libs/conversation-input/src/hooks/useComposerSeed.ts`. No Ghost lint errors remain. Full-suite tests are therefore not claimed as run; the targeted regression run above passed independently. Follow-up: repair these unrelated baseline lint errors separately.
- Automated Chromium fixture: 360, 900, 1280 and 1920px, both LTR and RTL, nine story times per layout. Artwork/attached-eye center error below 0.008px; no horizontal overflow. Typing cancels copies and preserves draft; reduced motion shows seven stationary ghosts with no snapshots or animations.
- Isolated fixture with four-times CPU slowdown: setup approximately 31ms mobile / 47ms desktop, 134 / 222 scene nodes, 34 / 54 total animations, p95 frame interval approximately 9.2ms, no long tasks and no playback geometry/style reads. These are fixture measurements, not a whole-application performance guarantee. Copies removed on natural completion.
- Five-axis review identified RTL artwork anchoring and a duplicated pumpkin face drifting under hover. Both were fixed: explicit physical art origin, and brightness applied to the original pumpkin light group with a separate soft halo. No core page or library changes.

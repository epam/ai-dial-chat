Slicing strategy: risk-first. Prove bounded canvas rendering and connected geometry, then complete UI anchoring and integration. All source imports remain extensionless; no core or library files change.

## 1. Efficient connected weaving

- [x] 1.1 Implement `utils/halloween-web-plan.ts`, `utils/halloween-web-animation.ts` and `components/Halloween/HalloweenWebScene.tsx` with cached silk, larger cached spiders, one bounded frame loop and static reduced motion. Integrate in `HalloweenBurstOverlay.tsx` and remove obsolete per-web SVG/CSS and layout code.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-web-plan.spec.ts apps/chat/src/utils/tests/halloween-web-animation.spec.ts apps/chat/src/components/Halloween/tests/HalloweenWebScene.spec.tsx apps/chat/src/utils/tests/halloween.spec.ts`.

- [x] 1.2 Add dedicated geometry, lifecycle and component tests for connectivity, varying plans, timing, bounded draw rate, missing context, cleanup and live reduced-motion changes in the files listed above.

  Verification: run the same scoped test command; compare old/new scenes with an automated browser fixture.

## 2. Interface anchoring

- [x] 2.1 Add bounded visible target discovery in `utils/halloween-web-targets.ts` and its tests; attach corner webs in `halloween-web-plan.ts` without mutating UI elements. Preserve RTL physical alignment and all four responsive viewport sizes.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-web-targets.spec.ts apps/chat/src/utils/tests/halloween-web-plan.spec.ts apps/chat/src/components/Halloween/tests/HalloweenWebScene.spec.tsx`.

- [x] 2.2 Update `apps/chat/README.md`, run `npm run validate:docs`, strict OpenSpec validation, `npm run verify:changed`, `npm run build:quiet` and exactly one `npm run verify:full`. Record pre-existing failures without unrelated fixes.

  Verification: the commands above plus the scoped test files from 1.1 and 2.1.

## 3. Pumpkin weaving

- [x] 3.1 Include the visible main pumpkin body before conversation-history targets in `utils/halloween-web-targets.ts`, preserving the target and spider budgets, button behavior and physical RTL coordinates. Update README and OpenSpec.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-web-targets.spec.ts apps/chat/src/utils/tests/halloween-web-plan.spec.ts`; focused lint, docs/spec validation and browser pumpkin coverage/click checks.

## Verification results

- The four new suites pass 68 tests; the existing Halloween utility suite passes 20 tests. Covered connection/coverage, UI bounds, larger spider sizes, deadlines, cached drawing, raster limits, interruption and reduced-motion changes, including changed target geometry and pumpkin priority.
- An isolated Chromium fixture at 1280 × 800, three eight-second runs per implementation, reduced scene descendants from 4,766 to one canvas and CSS animations from 1,486 to zero. Median main-thread TaskDuration fell from 3,492 to 411 ms (about 88%). This measures the scene fixture, not the entire application; script time rose slightly while style/layout work fell. Reproduction scripts, screenshots and raw measurements remain in ignored `tmp/web-preview/`.
- Browser checks passed at 360/900/1280/1920 in LTR and RTL: corner attachment, text input, no overflow or recurring layout reads, static reduced motion, unmount, scrolling, resize, normal completion and high-density raster bounds. Final dark desktop, dark mobile RTL and light desktop screenshots were inspected.
- Documentation validation (48 files), strict OpenSpec validation and diff checks passed. Review found no remaining material issues in this change.
- `verify:changed` passed affected typecheck after fixing an unused local in a new test, then stopped on concurrent conversation-panel type changes. `build:quiet` also stopped on those unrelated task-badge types before the frontend build. The single `verify:full` attempt stopped at `ConversationPanelView.tsx` because `resolveTaskBadge` was absent from `UseConversationPanelItemsParams`; its lint/test phases were not reached.
- Running frontend lint without its failed typecheck dependencies exposed unrelated `ScheduledTasksIcon` and `AppPreviewChat.tsx` import-order errors. New component-test lint errors were fixed and checked separately. No concurrent conversation-panel/backend/generated-client edits or the user's temporary Web-only scene selection were changed by this task.
- Pumpkin follow-up: 42 target/plan tests, focused lint, docs/spec validation and browser checks passed. At 1280 LTR and 360 RTL, five randomized plans each include the pumpkin body, preserve 80/54 spiders and the twelve-target ceiling, and draw silk over the artwork. The pumpkin stays clickable during animation and reduced motion. Screenshots and measurements remain in `tmp/web-preview/pumpkin-*`.

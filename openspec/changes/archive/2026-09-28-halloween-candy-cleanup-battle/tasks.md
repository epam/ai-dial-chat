## 1. Contact and story plan

Risk-first slice; root AGENTS.md applies. Library isolation uses existing anchors/mobile and computed direction only; no app or external contracts. Preserve all approved beats and other scenes.

- [x] 1.1 Implement bounded target selection and the complete deterministic plan in `utils/halloween-candy-targets.ts`, `halloween-candy-plan.ts` and dedicated utility tests. Include real edge contacts, composer-only/no-target routes, persistent sweets, peck/sweep contacts, both retreats, larger returning flock, exactly two skeleton helpers, RTL and numeric budgets.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-candy-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-candy-plan.spec.ts`; then `npm run verify:changed` for this slice.

## 2. Complete playback and artwork

- [x] 2.1 Implement `components/Halloween/HalloweenCandy.tsx`, Candy SVG artwork and pigment stylesheet, plus `utils/halloween-candy-animation.ts`. Add dedicated playback/component tests. Connect the renderer/deadline, remove only old Candy artwork/CSS from Extras, and update affected count/deadline assertions. Keep source geometry/draft/focus intact, preserve all story phases and release all owned work on every interruption/setup failure/StrictMode.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-candy-animation.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenCandy.spec.tsx libs/celebrations/src/halloween/components/Halloween/tests/HalloweenExtras.spec.tsx`; then `npm run verify:changed` after this complete slice.

## 3. Browser evidence and completion

- [x] 3.1 Add Candy above/below/composer-only Storybook cases and verify 360/900/1280/1920, RTL, no anchors, reduced motion, natural full story and interruption/replay in browser scripts. Inspect real-size contact, pecking, sweeping and both departures, light/dark artwork; compare baseline and final mobile CPU ×4/desktop profiles with track/SVG/read/cleanup evidence.

  Verification: `npm run test:file -- libs/celebrations/src/stories/tests/story-coverage.spec.ts`; browser artifacts under `tmp/candy-battle/`. Do not substitute screenshots for natural motion or unit counts for profiling.

- [x] 3.2 Update the library README and change verification, perform five-axis review, run scoped Nx celebrations typecheck/lint/test/build, docs validation, exactly one `npm run verify:full`, affected `npm run build:quiet`, strict OpenSpec and whitespace checks. Record unrelated repository failures without drive-by fixes.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx`; Nx targets above, `npm run validate:docs`, `openspec validate halloween-candy-cleanup-battle --strict`, `git diff --check`.

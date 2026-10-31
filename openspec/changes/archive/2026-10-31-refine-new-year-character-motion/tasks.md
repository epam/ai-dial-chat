## 1. Penguin contact and locomotion slice

Strategy: risk-first contact correction, then scene-local timing, then combined browser verification. Do not edit snowman or shared runtime/timeline files.

- [x] 1.1 Fix body/flipper parenting, mirrored capture/release, three walking intervals and continuous star flight in `libs/celebrations/src/new-year/utils/penguin-star-composition.ts`. Add behavioral contact and approach-step regressions in its existing test file, retaining all budgets.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/penguin-star.spec.ts libs/celebrations/src/new-year/components/NewYearPenguinStar/tests/NewYearPenguinStar.spec.tsx`.

## 2. Elf pose and hop slice

- [x] 2.1 Restrain cap/recoil motion and author separate ascent/descent timing in `libs/celebrations/src/new-year/utils/gift-wrapping-composition.ts`, preserving artwork and winding grips. Add hop and cap-range regression checks.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`.

## 3. Browser evidence and closure

- [x] 3.1 Add a browser harness under `libs/celebrations/browser-tests/` for both revised scenes at 360/900/1280/1920, including RTL, native shoulder/grip checks, normal-speed recordings, budgets, static fallback and cancellation. Audit reindeer against its existing checks and baseline captures; record findings and visual evidence in this change's `verification.md`.
  Verification: new browser harness and `libs/celebrations/browser-tests/reindeer-takeoff.browser.spec.mjs`; inspect captured contact/reaction/departure frames at actual size, including light/dark backgrounds.
- [x] 3.2 Update `libs/celebrations/README.md`, finish five-axis self-review and changed/full verification plus affected build and docs/spec validation. Confirm extensionless imports, scene-local changes, no host API/auth/env/storage/telemetry knowledge, unchanged snowman/shared sources and unchanged budgets.
  Verification: `npm run verify:changed`, one `npm run verify:full`, `npm run build:quiet`, `npm run validate:docs`, `npm run validate:specs`, `openspec validate refine-new-year-character-motion --strict`, and `git diff --check`.

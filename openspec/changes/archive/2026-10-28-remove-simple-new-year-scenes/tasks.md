## 1. Remove basic effects and assign triggers

Strategy: one vertical slice across the event, host labels and consumers.

- [x] 1.1 Remove Snow/Confetti/Sleigh from `libs/celebrations/src/new-year` and their app translation keys; set PenguinStar as the only click scene and GiftWrapping as the only secret scene. Keep library isolation and extensionless code imports intact.

  Verification: run `npm run test:file -- libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx` and `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx` after updating their existing assertions for the new trigger behavior.

- [x] 1.2 Update Storybook and `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs` to reference only surviving scenes. Preserve existing mobile, RTL and reduced-motion variants.

  Verification: run `npm run test:file -- libs/celebrations/src/stories/tests/story-coverage.spec.ts` and the existing PenguinStar/GiftWrapping component suites; check browser script syntax and build the library.

## 2. Documentation and verification

- [x] 2.1 Update `libs/celebrations/README.md` and the current celebration specs to describe the two trigger assignments; clarify external pack examples.
- [ ] 2.2 Run slice verification, documentation/spec validation and exactly one full verification; record any unrelated existing failures without modifying unrelated work.

## Archive verification note

Archived at the user's request on 2026-10-28 after reporting the incomplete repository-wide verification. Task 2.2 remains open: both broad verification commands stopped during lint after the turn was interrupted; no completed full-suite result is available.

Passed: all 1197 celebrations tests, the updated New Year contract and app host integration tests, celebrations lint/build, full workspace typecheck, documentation validation, spec-reference validation on Node 24 (zero errors, existing warnings), strict change validation and diff whitespace checks. The browser baseline harness was updated and syntax-checked, but not executed.

Slicing strategy: risk-first. Prove contact geometry and bounded borrowing, then complete the visual story and browser verification. All changes stay in the application Halloween layer; no core UI or library edits.

## 1. Shared contact geometry and targets

- [x] 1.1 Add `utils/halloween-raven-targets.ts` and `utils/halloween-raven-plan.ts` with bounded visible targets, a shared grip/cargo timeline, randomized collectors and mobile/RTL fallbacks. Add corresponding `utils/tests/halloween-raven-targets.spec.ts` and `halloween-raven-plan.spec.ts`.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-raven-targets.spec.ts apps/chat/src/utils/tests/halloween-raven-plan.spec.ts`.

## 2. Interactive nest scene

- [x] 2.1 Add `components/Halloween/HalloweenRavens.tsx`, raven artwork and stylesheet, plus `utils/halloween-raven-animation.ts`. Integrate in `HalloweenBurstOverlay.tsx`, remove obsolete ravens from `HalloweenExtras.tsx`/SCSS and extend only the raven deadline in `constants/halloween.ts`.
- [x] 2.2 Add animation/component regression tests for coupled motion, the one-row/fragment budgets, separate pickup points, staggered departures and forward-facing flight, interruption, restoration, static/live reduced motion, desktop/mobile and fallback behavior. Update `HalloweenExtras.spec.tsx` for the new drawing structure.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-raven-animation.spec.ts apps/chat/src/components/Halloween/tests/HalloweenRavens.spec.tsx apps/chat/src/components/Halloween/tests/HalloweenExtras.spec.tsx apps/chat/src/context/tests/CelebrationContext.spec.tsx`; run `npm run verify:changed` once after the slice.

## 3. Browser, performance and documentation

- [x] 3.1 Verify the real scene in an isolated browser fixture at 360/900/1280/1920 in LTR/RTL, including no overflow, real-row/strip fallback, contact alignment, interruption, reduced motion and a throttled-CPU performance trace. Tune only the agreed visual story.
- [x] 3.2 Update the Halloween behavior in `apps/chat/README.md`; run focused lint, formatting, `npm run validate:docs`, strict OpenSpec validation, `npm run build:quiet` and exactly one `npm run verify:full`. Review the final diff on correctness, readability, architecture, security and performance; record unrelated failures without changing their files.

  Verification: commands above plus the complete chat test target when integration concerns require it. Store fixture evidence in ignored `tmp/raven-preview/`.

## Verification results

- Focused Nx regression run: 144 tests passed across the raven, shared celebration, mimic, spider theft, bowling and mummy suites. After fixing cancellation across the responsive breakpoint, the raven component suite passed all 8 tests (including 2 new regressions).
- Chromium fixture: 360/900/1280/1920px in LTR and RTL passed. Maximum measured cargo/beak discrepancy was 1.38px; no horizontal overflow. Verified scroll, resize across the desktop breakpoint, source mutation, live reduced motion, unmount and natural expiry restore copies and animations. Direction checks passed for 55 visible flight segments. Dark/light captures and browser scripts are in ignored `tmp/raven-preview/`.
- Final desktop 4× CPU trace: 311 scene nodes, 67 finite animations, 106ms setup, 9.2ms p95 frame interval, no playback long tasks and no playback geometry/computed-style reads. Earlier mobile 4× trace: 190 nodes, 97ms setup. An 80-descendant custom row reached 277ms setup at 4× CPU; this cost is confined to the bounded initial snapshot, so the scene still skips larger rows. These are isolated scene measurements, not whole-app performance claims.
- Full workspace typecheck, affected production build, scoped formatting, documentation validation (48 files), strict OpenSpec validation and diff whitespace check passed.
- `verify:changed` and the single `verify:full` invocation stopped at existing lint errors outside this change: import order in `AppPreviewChat.tsx`; formatting/import order in `Input.command-menu.spec.tsx`, `useModelSelector.spec.tsx`, and `useComposerSeed.ts`. Full test/format stages consequently did not run. No unrelated files were changed to bypass these failures. Raven source files have no lint errors; tests retain non-null assertion warnings.
- The user's local Ravens-only preview selection in `HALLOWEEN_CLICK_BURSTS` remains untouched. It explains the 5 existing scene-registration test failures when running `HalloweenExtras.spec.tsx`; do not ship that preview selection as part of the raven feature.
- Five-axis self-review: original DOM/data/focus ownership is preserved, copying and target discovery are bounded, actor/cargo motion and cleanup have regression coverage, no core components or libraries are changed, and documentation matches the new behavior. No remaining blocking findings in this feature's scope.

## 4. Flight direction follow-up

- [x] 4.1 Correct the row-lift flight classification and align artwork to the full travel vector in `utils/halloween-raven-plan.ts` and `halloween-raven-animation.ts`. Preserve beak/cargo attachment and grounded tugging. Add targeted facing regressions and verify actual rendered motion throughout flights, including turn boundaries.

  Verification: `npm run test:file -- apps/chat/src/utils/tests/halloween-raven-facing.spec.ts apps/chat/src/utils/tests/halloween-raven-plan.spec.ts apps/chat/src/utils/tests/halloween-raven-animation.spec.ts`; dense Chromium sampling in the existing isolated fixture.

Follow-up verification: all 52 focused raven tests passed, including 14 new flight-heading regressions; the chat TypeScript target passed. Rendered geometry sampled every 20ms across 12 seeded mobile/desktop LTR/RTL variants yielded 19,838 visible moving-flight observations with zero negative head-to-beak alignment against travel. A separate review checked interpolation around turns at 2ms intervals. Short body-pivot projections during turns are not treated as flight-direction failures; head direction remains forward. Cargo contact checks still passed at 360/900/1280/1920px in both directions (maximum discrepancy 1.38px). The earlier midpoint-only direction verification missed the row lift and has been superseded by this coverage. Scripts and results: ignored `tmp/raven-preview/direction-multiple.mjs` / `direction-multiple.json`.

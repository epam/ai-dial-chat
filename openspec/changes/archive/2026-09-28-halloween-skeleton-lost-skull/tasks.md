## 1. Geometry and contact plan

Root AGENTS.md applies. Keep library isolation, lib styling rules and extensionless imports; no app routes, flags, contexts, i18n, APIs, persistence or dependencies.

- [x] 1.1 Add `utils/halloween-skeleton-targets.ts` (bounded composer measurement, RTL) and `utils/halloween-skeleton-plan.ts` (storyboard, `skeletonHandPoint`, contacts, composer/floor stage, mobile scale, budgets) with dedicated specs covering unsafe targets, traversal limits, contact continuity, handoffs, RTL mirroring, floor fallback and keyframe budgets.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-skeleton-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-skeleton-plan.spec.ts`.

## 2. Playback and artwork (depends on 1)

- [x] 2.1 Add `utils/halloween-skeleton-animation.ts`, `components/Halloween/HalloweenSkeletons.tsx`, `HalloweenSkeletonArt.tsx` and `HalloweenSkeletons.module.scss`; remove the old Skeletons renderer/styles from Extras; register the new component and the 12 s deadline.
- [x] 2.2 Add playback/component specs: draft/focus/selection preserved, animation/SVG budgets, no playback measurement, every interruption, composer mutation/resize/removal, static fallbacks, StrictMode, cancelled preparation, setup failure and idempotent stop.

  Verification: `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-skeleton-animation.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenSkeletons.spec.tsx libs/celebrations/src/halloween/components/Halloween/tests/HalloweenExtras.spec.tsx`.

## 3. Evidence and completion (depends on 2)

- [x] 3.1 Update `libs/celebrations/README.md`; run Nx celebrations typecheck/lint/test, `npm run validate:docs`, strict OpenSpec validation and `git diff --check`.
- [x] 3.2 Watch the Storybook Skeletons story at mobile/desktop, RTL and reduced motion; record observed frames and profiling limits in `verification.md`.

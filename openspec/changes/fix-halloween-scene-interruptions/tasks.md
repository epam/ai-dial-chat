## 1. Portal cancellation slice

Strategy: vertical slices, starting with the reproduced input bug and the shared observation lifecycle.

- [x] 1.1 Add focused regression tests for input in a pre-focused composer and target invalidation in `halloween-portal.spec.ts`; add behavior tests for the new observer in `src/utils/tests/scene-targets.spec.ts`.
- [x] 1.2 Implement the internal observer and wire Portal input/cleanup, preserving original rows and scene timing.

### Verification

Run `npm run test:file -- libs/celebrations/src/utils/tests/scene-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-portal.spec.ts`, then `npm run verify:changed` after the slice.

## 2. Train and Web cancellation slice

- [x] 2.1 Reuse target observation in `halloween-train.ts` and `halloween-web-animation.ts`; collect Web target identities during existing bounded selection and pass them from `HalloweenWebScene.tsx`.
- [x] 2.2 Add source/ancestor change, removal, resize and cleanup regressions in the Train/Web test files; preserve existing mobile/RTL geometry and normal playback budgets.

### Verification

Run `npm run test:file -- libs/celebrations/src/halloween/utils/tests/halloween-train.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-web-animation.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-web-targets.spec.ts libs/celebrations/src/halloween/components/Halloween/tests/HalloweenWebScene.spec.tsx`, then `npm run verify:changed` after the slice.

## 3. Documentation, browser verification and shipping

- [x] 3.1 Update `libs/celebrations/README.md`, run docs validation, and record automated browser checks/profiling at mobile/desktop sizes, RTL and reduced motion in `verification.md`.
- [x] 3.2 Run library test/lint/build, one `npm run verify:full`, OpenSpec validation and the five-axis quality review. Check library isolation explicitly: no host contracts or new public API, dependencies or per-frame layout reads.
- [x] 3.3 Commit, push the isolated worktree branch, and create a draft PR targeting development, without an issue reference.

### Verification

Use resolved Nx targets for the celebrations library, `npm run validate:docs`, `npm run validate:agent-docs` if the commit scope taxonomy changes, and `openspec validate fix-halloween-scene-interruptions --strict`. Record any unrelated baseline failures rather than changing other projects.

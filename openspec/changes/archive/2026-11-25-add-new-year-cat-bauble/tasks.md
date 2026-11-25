Slicing strategy: **risk-first**. First prove the measured plan and its contacts in pure functions (targets â†’ composition â†’ probe tests). Then wire playback and the copy. Then register the scene and add host strings and docs. Each slice is verified on its own.

Architecture guard for every `libs/celebrations` task: no `/api` paths, generated clients, app contexts, i18n, env, feature flags, routing, telemetry or storage keys. Anchors and labels arrive only through `CelebrationEnvironmentContext`.

## 1. Targets and modes

- [x] 1.1 Add `NewYearScene.CatBauble` and `CatBaubleMode` to `libs/celebrations/src/new-year/types/new-year.ts`.
- [x] 1.2 Implement `libs/celebrations/src/new-year/utils/cat-bauble-targets.ts`: a one-shot `measureComposer`, model selector eligibility (D4, spec limits) and stage orientation (D2).
- [x] 1.3 Unit tests in `libs/celebrations/src/new-year/utils/tests/cat-bauble.spec.ts` for selector, tangerine and static modes: focus, oversize, out of reach, RTL and no headroom.
  - Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/cat-bauble.spec.ts`

## 2. Art and composition

- [x] 2.1 Author `libs/celebrations/src/new-year/utils/cat-bauble-art.ts`: the cat rig groups (D3), the fir with baubles and an empty hook, and the tangerine. Use only flat fills and strokes.
- [x] 2.2 Implement `libs/celebrations/src/new-year/utils/cat-bauble-composition.ts`: the beat table (D5), body, leg, head and tail tracks, fir pendulums, copy track, Lottie layers, copy WAAPI frames and `probe`.
- [x] 2.3 Extend `cat-bauble.spec.ts` with probe contacts on desktop and mobile, LTR and RTL:
  - the paw on the selector top at contact;
  - feet on the rim;
  - the slide edge meeting the trunk;
  - the hook keeping the copy's top;
  - the mouth on the copy while carried;
  - an exact restore;
  - the miss at the pounce apex.
  Also cover the tangerine mode and the spec budgets.
  - Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/cat-bauble.spec.ts`

## 3. Playback and component

- [x] 3.1 Implement `libs/celebrations/src/new-year/utils/cat-bauble-animation.ts`: timings, the copy layer, target observers, and the copy started on the Lottie clock with interruption detection.
- [x] 3.2 Implement `libs/celebrations/src/new-year/components/NewYearCatBauble/NewYearCatBauble.tsx` and `CatBaubleStill.tsx`, following `NewYearElfFireworks`.
- [x] 3.3 Component tests in `libs/celebrations/src/new-year/components/NewYearCatBauble/tests/NewYearCatBauble.spec.tsx`:
  - one composition, with the copy started on the first frame;
  - tangerine mode borrows nothing;
  - interruption events release everything;
  - a snapshot stop before restore cancels;
  - reduced motion shows the still without the player;
  - no headroom shows the still;
  - replay accumulates nothing.
  - Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYearCatBauble/tests/NewYearCatBauble.spec.tsx`

## 4. Registration, labels and host strings

- [x] 4.1 Register the scene in `libs/celebrations/src/new-year/components/NewYear/NewYearSceneOverlay.tsx`, `libs/celebrations/src/new-year/constants/new-year.ts` (duration and click pool) and `libs/celebrations/src/new-year/event.tsx`. Add `catBaubleToastMessage` to `libs/celebrations/src/new-year/models/labels.ts` and `libs/celebrations/src/new-year/constants/labels.ts`.
- [x] 4.2 Update the event contract tests in `libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`.
  - Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`
- [x] 4.3 i18n: add `NewYearI18nKeys.CatBaubleToastMessage` in `apps/chat/src/constants/i18n-keys/new-year.ts` and `newYear.catBaubleToastMessage` in `apps/chat/src/i18n/locales/en.json`. Adjust `apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx` for the larger click pool.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx` and `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx`

## 5. RTL, stories and browser check

- [x] 5.1 RTL: the plan uses logical start and end through `dir`. The copy frames carry no negative scale, and the RTL test cases are in 2.3.
- [x] 5.2 Add `CatBauble`, `CatBaubleMobile`, `CatBaubleRtl`, `CatBaubleReducedMotion` and `CatBaubleInterruption` stories to `libs/celebrations/src/new-year/stories/NewYearScenes.stories.tsx`.
- [x] 5.3 Browser check in Storybook: desktop, mobile, RTL, reduced motion, interruption and replay. Confirm that no copy, layer or timer remains, and record the observations in `openspec/changes/add-new-year-cat-bauble/evidence.md`.

## 6. Docs and closing verification

- [x] 6.1 Update `libs/celebrations/README.md`: the scenes section, the `NewYearScene` list and the pools. Then run `npm run validate:docs`.
- [x] 6.2 Run `npm run validate:specs`.
- [x] 6.3 Run `npm run verify:changed` after the slices, then `npm run verify:full` once.
- [ ] 6.4 Follow-up, out of scope: `openspec/specs/celebration-source-selection/spec.md` still lists four New Year scenes. Refresh it in a separate change.

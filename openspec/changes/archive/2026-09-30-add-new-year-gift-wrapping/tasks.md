## 1. Original wrapping story vertical slice (completed baseline)

Strategy: one vertical scene slice, followed by visual/resource validation. No new engine, app context or host contract. Sections 1–2 record the original implementation and its verification. Section 3 records the completed comic artwork/story revision. Section 4 records the completed Lottie motion revision. Section 5 redraws the characters and compact arm rig following the user's selected mischievous cartoon style; completed historical tasks do not establish completion of that redraw.

- [x] 1.1 Implement bounded target selection and pure choreography in `libs/celebrations/src/new-year/utils/gift-wrapping-{targets,plan}.ts`; keep hands, hat and ribbon on shared coordinates through all five beats.

  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts`.

- [x] 1.2 Add articulated artwork and scene in `libs/celebrations/src/new-year/components/NewYearGiftWrapping/`, plus the cancellable runner in `utils/gift-wrapping-animation.ts`. Preserve focused input and zero host mutations; implement static and decorative-parcel fallbacks.

  Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`.

- [x] 1.3 Add dedicated unit/integration coverage for target eligibility, contact, every lifecycle interruption, repeated playback, partial failures, reduced motion and SVG/animation budgets in the two new test files above.

  Verification: run both exact files with `npm run test:file -- <path>`.

- [x] 1.4 Register `GiftWrapping` in `new-year/event.ts` and `components/NewYear/types.ts`; add its Storybook examples in `new-year/stories/NewYearScenes.stories.tsx`. Keep the existing secret and selection behavior.

  Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx libs/celebrations/src/stories/tests/story-coverage.spec.ts`.

  App integration: extend the known click-scene notification list in
  `apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx` and run
  that exact test through the app's Nx test target.

- [x] 1.5 Add optional/default notification label in `new-year/models/labels.ts` and `constants/labels.ts`; add `NewYearI18nKeys.GiftWrappingToastMessage` and `newYear.giftWrappingToastMessage` to `apps/chat/src/constants/translation-keys.ts` and all supported `apps/chat/src/i18n/locales/*.json`, including `en.json`.

  Verification: `npm run test:file -- libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`; verify locale placeholders and keys match.

- [x] 1.6 Verify mobile/RTL geometry and direction inheritance, both characters, preserved story and viewport cancellation; use logical layout utilities and keep copied text count zero.

  Verification: both new test files, then Playwright Storybook captures at 360/900/1280/1920 in LTR and RTL.

- [x] 1.7 Update `libs/celebrations/README.md` for the public enum and actual scene/fallback behavior; review isolation, extensionless imports and unchanged frontend bundler resolution. No app routes, auth, env, SDK, persistence or integration classes in the lib.

  Verification: `npm run validate:docs`, the New Year event test above, and once-completed-slice `npm run verify:changed`.

## 2. Original browser evidence and completion (completed baseline)

Depends on the complete scene slice.

- [x] 2.1 Capture actual-size contact/caught-hat/release/finale frames and normal-speed playback using the existing Storybook. Record desktop/mobile browser frame/layout/paint profiles, SVG/path/keyframe counts and repeated cancellation resource checks in `verification.md`; retain both characters and all approved beats when correcting defects.

  Verification: scripted Playwright captures/profiles plus the two new exact test files after any choreography fixes.

- [x] 2.2 Perform the five-axis quality review; run `npm run build:quiet`, `npm run validate:docs` and exactly one `npm run verify:full`. Record outcomes and any unrelated/environment failures. Leave this change unarchived.

  Verification: command results and review evidence in `verification.md`.

## 3. Comic artwork and story revision

Strategy: one replacement scene slice, then responsive visual evidence and a quality pass. Reuse the existing host contract, finite lifecycle, event registration and labels. Depends on the completed baseline above.

- [x] 3.1 Redraw the stout green master and lanky coral helper in `libs/celebrations/src/new-year/components/NewYearGiftWrapping/GiftWrappingArt.tsx`; revise `utils/gift-wrapping-plan.ts`, `utils/gift-wrapping-animation.ts` and `components/NewYearGiftWrapping/NewYearGiftWrapping.tsx` as required for the proud pause, anticipated pull, master's tumble into a torso-bound ribbon cocoon, awkward reaction, frustrated hops and reel-carrying departure. Retain the 18-second story, 18.5-second mount deadline and all existing interruption paths; use a bound-master/proud-helper static fallback. Update the two existing focused test files for actual hand/knot/torso contact, story timing and the revised SVG/animation budgets. Preserve extensionless imports, bundler resolution and library isolation: anchors, labels and mobile state still enter through `CelebrationEnvironment`; no app/external integration knowledge enters the library.

  Verification: run `libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts` and `libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx` through the existing Nx test target. Confirm at most 32 animations, 640 desktop/600 mobile keyframes, 80 nodes/40 paths/800 commands/3 gradients/9 animated groups per elf, 200 total SVG nodes and no filters, masks, particles, snapshots or host mutations.

- [x] 3.2 Inspect the revised scene at actual size at 360/900/1280/1920 widths in LTR and RTL, on light and dark surfaces, plus reduced-motion and decorative-parcel fallbacks. Capture the setup, proud pause, pull contact, cocoon reveal, contrasting reactions and hopping departure, including normal-speed desktop/mobile playback. Recheck shared contact geometry, silhouette/expression readability, overflow, preserved draft/focus/selection, repeated interruption cleanup and desktop/mobile browser profiles. Record fresh revision evidence and its limitations separately from the original baseline in `openspec/changes/add-new-year-gift-wrapping/verification.md`.

  Verification: scripted Playwright Storybook captures and profiles with recorded viewport and CPU conditions; structural tests alone do not establish visual quality or measured frame time. Depends on 3.1.

- [x] 3.3 Update `libs/celebrations/README.md` and this change's proposal/design/specs to describe the implemented comedy and unchanged public contract. Perform the five-axis quality review and run `npm run verify:changed`, `npm run build:quiet`, `npm run validate:docs` and exactly one revision `npm run verify:full`; record actual results and unrelated/environment failures in `verification.md`. Keep this change unarchived.

  Verification: focused test, review, build, docs, changed/full verification and OpenSpec validation outcomes; verify no new labels, APIs, dependencies or app-owned integration details were introduced. Depends on 3.1–3.2.

## 4. Lottie motion and continuous ribbon revision

Strategy: risk-first composition slice, then player/lifecycle integration and browser/build validation. Depends on the completed comic revision; preserve its public event/label contract and existing interruption rules. Sections 1–3 are historical WAAPI work, whose budgets and evidence do not describe this Lottie revision.

- [x] 4.1 Replace sampled pose tracks and separate scaled ribbon segments with locally authored native Lottie vectors and a pure composition builder under `libs/celebrations/src/new-year/`; replace `utils/gift-wrapping-plan.ts` choreography as required. Use a 16-second 60 fps composition with subframes, sparse intentional Bézier movement, no interpolated facing through zero, continuous composer trim paths from the working grip, and front/back torso loops during the reversal. Preserve shared hand/ribbon/reel contacts, both elves, comic pauses, hops and departure at mobile/desktop sizes in LTR/RTL. Add focused composition/geometry and target selection coverage in `utils/tests/gift-wrapping.spec.ts`, and enforce the revised layer/path/vector/keyframe/serialized-size budgets. Preserve extensionless imports, bundler resolution and library isolation: host anchors, labels and mobile state still enter through `CelebrationEnvironment`; no app or external service contracts enter the lib.

  Verification: run `libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts` through `npm run test:file -- <workspace-relative-path>`; verify exactly two elves, at most 12 top-level layers, 80 KB minified static vectors, 240 KB composition, 1,400 keyframes and 900 static-artwork Bézier vertices, with no external URLs, fonts, raster assets, expressions, filters, masks, particles or snapshots.

- [x] 4.2 Integrate the light SVG build of `lottie-web` as a private runtime dependency of `libs/celebrations/package.json`, with a scene-local dynamic loader/player adapter and changes to `components/NewYearGiftWrapping/NewYearGiftWrapping.tsx` and `utils/gift-wrapping-animation.ts`. Bound import to two seconds and SVG readiness to a further 250 ms, perform no host measurement while awaiting the player import, use the existing static SVG fallback for reduced motion/missing APIs/load or render failure, and ignore late results after cancellation. Preserve all existing interruption paths; ignore generated SVG mutations; destroy each initialized player exactly once on completion/error/timeout/unmount. Add player/component lifecycle coverage, including cancellation during loading, failure/timeout, late resolution, repeated activation, host preservation and generated-mutation isolation. Keep the provider's 18.5-second deadline, labels and app integration unchanged.

  Verification: run `libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`, `libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx` and `libs/celebrations/src/stories/tests/story-coverage.spec.ts` through `npm run test:file -- <workspace-relative-path>`, then run `npm run verify:changed` once for the completed slice. Depends on 4.1.

- [x] 4.3 Capture normal-speed Storybook playback and intermediate ribbon/contact frames at 360/900/1280/1920 widths in LTR/RTL, on light/dark surfaces, plus reduced-motion and decorative-parcel fallbacks. Check continuous movement, trim-path wrapping/retraction, body occlusion, reactions, overflow, preserved draft/focus/selection and repeated interruption cleanup. Record fresh desktop/mobile browser profiles with viewport/CPU conditions, generated SVG/path counts, production scene/player gzip bytes and evidence limitations in `verification.md`; enforce 500 SVG descendants, 180 rendered path nodes and an 80 KB gzip scene/player ceiling. Update `libs/celebrations/README.md` and these artifacts to match the final implementation, regenerate `docs/host-install-matrix.md` for the dependency change, and perform the five-axis quality review. Keep this change unarchived.

  Verification: scripted Playwright captures/profiles and focused tests after any motion fixes; `npm run build:quiet`, `npm run validate:docs`, `openspec validate add-new-year-gift-wrapping`, and exactly one Lottie-revision `npm run verify:full`. Record actual results, including unrelated/environment failures; neither historical WAAPI runs nor structural tests prove Lottie smoothness or measured frame cost. Depends on 4.1–4.2.

## 5. Mischievous cartoon characters and compact arm rig

Strategy: one focused artwork/rig slice, followed by geometric regression coverage and fresh responsive visual/profile evidence. Depends on the completed Lottie slice. Preserve its story, scene registration, labels, private player dependency, loading deadlines, 16-second composition, 18.5-second mount deadline and interruption rules. Sections 1–4 record completed historical revisions; their screenshots and measurements do not establish this redraw's quality.

- [x] 5.1 Redraw the stocky green master and nimble coral helper in `libs/celebrations/src/new-year/components/NewYearGiftWrapping/GiftWrappingArt.tsx` and `assets/gift-wrapping-elves.json` in the user-selected mischievous cartoon style, with smaller noses, readable brows/grins and mutually exclusive expression/surprise/annoyed faces. Make the static bound master annoyed. Introduce shared character constants in `utils/gift-wrapping-rig.ts` and consume them in artwork and `utils/gift-wrapping-composition.ts`: shoulder `(17, -56)`, upper arm 18, local palm `(19, 0)`, reel `(-25, -35)`, head `(0, -66)`, cap `(0, -94)` and leg pivot y = -22. Keep shoulder/elbow/wrist/mitten joined with small shape overlap, positive elbow bends within 20–120 degrees, and the master's sleeve behind his head. Match native-vector transforms to the same rig, remove the old duplicated 35-unit contact assumptions, and adapt working/pulling/presenting gestures to the shorter reach without changing the approved story. Preserve extensionless imports, bundler resolution and library isolation: anchors, labels and mobile state still arrive through `CelebrationEnvironment`; the rig contains only local character geometry.

  Verification: run `npm run test:file -- libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts` and `npm run test:file -- libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`. Verify native-vector output, static artwork and composition contacts agree, and retain the existing lifecycle/fallback assertions.

- [x] 5.2 Extend meaningful geometry coverage in `libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts` for the emitted compact rig: connected shoulder/elbow/wrist positions, stable segment lengths totaling 37 units, with bent poses naturally shortening the shoulder-to-hand distance, positive elbow working range, and real transformed mitten/ribbon/reel contact during work, anticipated pull and presentation on mobile/desktop in LTR/RTL. Preserve the coil continuity/occlusion tests and viewport-headroom boundary tests. Extend `components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx` only where needed to verify redesigned static faces and matched fallback artwork. Assert emitted geometry and visible expression states rather than constants against themselves. Keep both characters and the story at every supported layout, and maintain the numerical asset/composition/keyframe budgets.

  Verification: run the two exact files above with `npm run test:file -- <workspace-relative-path>`, plus `libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx` and `libs/celebrations/src/stories/tests/story-coverage.spec.ts`; run `npm run verify:changed` once after the completed artwork/rig slice. Depends on 5.1.

- [x] 5.3 Capture before/after actual-size and enlarged-contour comparisons plus normal-speed Storybook playback at 360/900/1280/1920 widths in LTR/RTL, on light/dark surfaces, with reduced-motion and decorative-parcel fallbacks. Inspect distinct silhouettes, brows/noses/grins, exclusive reaction faces, attached sleeves/elbows/wrists, hand/prop contact and the unchanged wrapping joke during working, extreme pull, proud presentation, cocoon and hopping poses. Record fresh desktop/mobile browser profiles under the previous Lottie viewport/CPU conditions and compare style/layout/paint, frame intervals, generated SVG complexity and gzip output in `verification.md`; retain at most 500 SVG descendants, 180 rendered paths, 80 KB minified static vectors, 240 KB composition, 1,400 property keyframes, 900 static-artwork Bézier vertices and 80 KB gzip scene/player payload. Update `libs/celebrations/README.md` and these artifacts to match the final artwork, perform the five-axis quality review, and keep this change unarchived.

  Verification: scripted Playwright captures/profiles; focused tests after any joint/contact corrections; `npm run build:quiet`, `npm run validate:docs`, `openspec validate add-new-year-gift-wrapping`, and exactly one character-revision `npm run verify:full`. Record actual outcomes and unrelated/environment failures; distinguish geometric checks, artistic inspection and measured rendering cost. Depends on 5.1–5.2.

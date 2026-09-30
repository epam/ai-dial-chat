## 1. Wrapping story vertical slice

Strategy: one vertical scene slice, followed by visual/resource validation. No new engine, app context or host contract.

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

## 2. Browser evidence and completion

Depends on the complete scene slice.

- [x] 2.1 Capture actual-size contact/caught-hat/release/finale frames and normal-speed playback using the existing Storybook. Record desktop/mobile browser frame/layout/paint profiles, SVG/path/keyframe counts and repeated cancellation resource checks in `verification.md`; retain both characters and all approved beats when correcting defects.

  Verification: scripted Playwright captures/profiles plus the two new exact test files after any choreography fixes.

- [x] 2.2 Perform the five-axis quality review; run `npm run build:quiet`, `npm run validate:docs` and exactly one `npm run verify:full`. Record outcomes and any unrelated/environment failures. Leave this change unarchived.

  Verification: command results and review evidence in `verification.md`.

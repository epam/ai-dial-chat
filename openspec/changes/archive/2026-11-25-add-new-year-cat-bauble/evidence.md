# Evidence: add-new-year-cat-bauble

## Browser check

The check ran on 2026-11-24 against the Storybook dev server (`npx storybook dev -p 6010` in `libs/celebrations`) with headless Chromium through Playwright. The local script was `tmp/cat-bauble-check.mjs` (Git-ignored). Captures and `report.json` are in `tmp/cat-bauble-verification/`.

| Story | Viewport | Mode | SVG nodes | Console errors | After the end |
| --- | --- | --- | --- | --- | --- |
| `CatBauble` | 1280 × 900 | selector | 122 | none | 0 copies, 0 toy layers, selector opacity 1, 0 animations on it |
| `CatBaubleMobile` | 390 × 844 | tangerine¹ | 131 | none | same |
| `CatBaubleRtl` | 1280 × 900 | selector | 122 | none | same |
| `CatBaubleReducedMotion` | 1280 × 900 | still | — | none | no animated host, still shown |

¹ The story host's mobile composer wraps the selector onto a second row, about 41 px below the rim. That is beyond the mobile reach of 35.6 px (`catReach`), so the tangerine fallback plays, as specified.

- **Interruption.** A pointer press at 13 s, while one copy hung on the fir, removed the scene and the copy at once. The selector's opacity was back to 1.
- **Frame gaps.** A `requestAnimationFrame` loop over the whole playback gave p50 16.7 ms and p95 16.8 ms on desktop, mobile and RTL, with a maximum of 16.8 ms. This is headless Chromium on a desktop CPU without throttling, so it is a smoke signal, not a mobile profile.
- **Story beats.** Captures at 1.5–20.8 s show the trot, the miss and the grooming, then the paw hooking the copy over the rim (8.9 s), the slide and the fir shaking, the copy hanging on the hook (14 s), the carry home in the mouth (17.5 s) and the nap.

## Findings fixed during the check

- **The copy hung behind the fir.** At first it hung from its top centre, so a 72 px selector was mostly hidden behind the branches. It now hangs and is carried by one grip on its top edge near its fir-side end, with an 8° tilt, so its body stays clear of the tree. The probe tests were updated to the grip.
- **The still was crowded.** The still's ornament overlapped the cat's head, and the fir was clipped at the right. The layout and view box were adjusted.
- **Captures cancelled the scene.** `page.screenshot()` with its default `caret: 'hide'` injects a style, and the target observer correctly reads that as a host mutation. Captures must use `caret: 'initial'`, as `browser-tests/new-year-character-motion.browser.spec.mjs` already does. This was a harness issue, not a scene defect.

## Known limitation

With starters above the composer (the story host's default), the fir and the cat stand in front of the starter row on the rim, as the elf fireworks scene does. In DIAL Chat the starters render below the composer, so the band above the rim is free. Measuring the starter row to pick a lower stage, like the snowman does, is out of scope here.

## Unit and component tests

- `libs/celebrations/src/new-year/utils/tests/cat-bauble.spec.ts`: 50 tests covering targets, contacts on four layouts plus a selector-at-start case, tangerine mode and budgets.
- `libs/celebrations/src/new-year/components/NewYearCatBauble/tests/NewYearCatBauble.spec.tsx`: 13 tests covering playback, the copy on frame 0, the tangerine, six interruption events, snapshot-stop cancellation, reduced motion, no headroom and replay.
- `libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`, `apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx` and `apps/chat/src/context/tests/CelebrationHost.spec.tsx` all pass.

Measured composition budgets for the desktop selector layout:

- composition data: about 92 KB, against a limit of 180 KB;
- keys per property: at most 128, against 160;
- layers: 2 (fir and cat), against 8.

## Closing verification

- **`npm run verify:changed`: passed.** This covers `typecheck:affected`, `lint:affected` and `test:changed`.
- **`npm run verify:full`: ran once.**
  - `typecheck:full` passed.
  - `lint:check` failed in `scheduled-tasks-consumer-fixture:lint` only. ESLint read `tools/scheduled-tasks-consumer-fixture/.npm-cache/_cacache/tmp/**/active-scheduled-task.js`, a bundled file left in the Git-ignored local npm cache by an earlier fixture run. This change does not touch that project.
  - The chain stops on the lint failure, so `npm run test:full:quiet` was run separately: 87 of 88 tasks passed. `@epam/chat-api:test` had 11 failures in 5 files:
    - `app-config/tests/managed-runtime/managed-activation.spec.ts`
    - `shadow-comparison.spec.ts`
    - `managed-content-activation.spec.ts`
    - `app-config.controller.spec.ts`
    - `config/tests/explicit-environment.spec.ts`

    All 5 pass in isolation (121/121 with `npm run test:file`), so the failures are load-dependent and not caused by this change, which does not touch `apps/chat-api`.

# Tasks

**Slicing strategy: risk-first.** The order is:

1. Make comparison evidence safe to capture.
2. Move the shared player boundary, which is mechanical.
3. Prove the session alone with fake timers.
4. Wrap the session in the hook.
5. Switch GiftWrapping over.

Every slice keeps the existing suites green and is verifiable on its own. Paths are relative to the repository root, and `L/` stands for `libs/celebrations/src/`.

Discovery was completed during the proposal (see `design.md` §Context). Apply-time investigation is limited to the specific checks named below.

## 0. Preflight

- [x] 0.1 Create the S1 branch from `origin/development`, not from `docs/celebrations-s0-contracts-baseline`. Then record:
  - `git rev-parse --short=9 HEAD`
  - `git status --short`
  - that `git diff --stat 1cfb11468 HEAD -- libs/celebrations/src` prints nothing

  If `libs/celebrations/src` has moved since `1cfb11468`, stop and re-check the citations in `design.md` before you edit anything. Leave unrelated working-tree changes untouched.
  - Verification: the three outputs are pasted under this task.
  - Result (apply, 2026-10-01): branch `feat/celebrations-s1-lottie-session` from `origin/development` at `bd5d8ced9`. `git status --short` lists only `?? openspec/changes/extract-shared-lottie-playback-lifecycle/`. `git diff --stat 1cfb11468 HEAD -- libs/celebrations/src` prints nothing. `libs/celebrations` matches `605b21273` (the harness is present), and `package-lock.json:346` is still `"lottie-web": "^5.13.0"`.

## 1. Harness capture identity (prerequisite for group 7; dev-only)

- [x] 1.1 In `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs`, replace the HEAD-only `output` (`:28-32`) with a capture ID:
  - `<rev9>` for a clean tree
  - otherwise `<rev9>-wt-<8 hex>`, a SHA-256 over `git diff HEAD --binary` and the bytes of every file listed by `git ls-files --others --exclude-standard`

  Use `execFileSync('git', …)` only. Add no environment variables, so the S0 `process.env` guard keeps holding.
- [x] 1.2 Before any browser launch, throw when `<output>/artefacts.sha256` exists. The message names the directory and says it is a finalized capture.
- [x] 1.3 Replace the global `mergeResults('environment', …)` (`:611-620`) with a per-scene `environment` field inside each scene's result. The field holds:
  - `captureId`, `revision`, `dirty` and `fingerprint`
  - `storybookIndexMtime`, the mtime of `storybook-static/index.json`
  - browser, OS, CPU, CPU count, Node and seed
  - `startedAt` and `finishedAt`

  Keep the merge of scene keys.
- [x] 1.4 In `libs/celebrations/browser-tests/summarize-baseline.mjs`:
  - print one environment row per scene
  - exit with status 1, naming the scenes, when the captured scenes disagree on `revision` or `fingerprint`
  - for a legacy `results.json`, which has only a top-level `environment` (the `1cfb11468` layout), keep printing that record so the published summary can still be reproduced

  Also change `:141`: when `artefacts.sha256` already exists, write it only if the new manifest is byte-identical. Otherwise exit 1 without writing, so a finalized capture is never rewritten.

  The script still takes the directory name as `argv[2]`.
  - Verification. Never run the summarizer inside `tmp/celebrations-baseline/1cfb11468/` itself.
    - `cp -R tmp/celebrations-baseline/1cfb11468 tmp/celebrations-baseline/s1-legacy-check`
    - `node libs/celebrations/browser-tests/summarize-baseline.mjs s1-legacy-check` exits 0, and its gift-wrapping, sleigh and cat tables match part 2
    - editing one hash line in the copy's `artefacts.sha256` and rerunning exits 1, and leaves the edited file in place
    - a copy whose `results.json` has two scene `environment` records with different fingerprints exits 1
    - `cd tmp/celebrations-baseline/1cfb11468 && shasum -a 256 -c --quiet artefacts.sha256` exits 0
    - delete the `s1-*` copies afterwards
    - `npm exec nx lint @epam/ai-dial-celebrations` passes
    - `grep -nE "process\.env|/api|localStorage|i18next" libs/celebrations/browser-tests/*.mjs` prints nothing

  Do not run the full matrix in this group.

## 2. Shared player module, exact pin, PenguinStar imports

- [x] 2.1 Create `L/utils/lottie-player.ts` containing:
  - `LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION = '5.13.0'`
  - the `LottiePlayer` interface, moved from `L/new-year/utils/gift-wrapping-player.ts:4-6`
  - `loadLottiePlayer`, the same dynamic import as `:9-13`, with no module state
  - `createLottieLightSvgAnimation(player, container, animationData)`, which applies the options from `L/new-year/utils/gift-wrapping-animation.ts:74-86` and then `setSubframe(true)`

  Add JSDoc to each export, describing *what* it does (the internal module still follows the JSDoc rule).
- [x] 2.2 Delete `L/new-year/utils/gift-wrapping-player.ts`. Point the GiftWrapping imports (`NewYearGiftWrapping.tsx:9-12`, `gift-wrapping-animation.ts:6`) at `../../utils/lottie-player` and `loadLottiePlayer`, and keep its lifecycle unchanged in this slice. In PenguinStar, change only:
  - the imports in `NewYearPenguinStar.tsx:4-7`
  - the type import in `penguin-star-animation.ts:2`
  - the `loadAnimation` + `setSubframe` call in `penguin-star-animation.ts:95-107`, which becomes `createLottieLightSvgAnimation`

  Nothing else in `penguin-star-animation.ts` changes.
- [x] 2.3 Update the mock's module path and the loader name, and nothing else, in:
  - `L/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx:7-10,30-32`
  - `L/new-year/components/NewYearPenguinStar/tests/NewYearPenguinStar.spec.tsx:7-10,30-32`
- [x] 2.4 Pin `"lottie-web": "5.13.0"` in `libs/celebrations/package.json:34`. Run `npm install --package-lock-only --ignore-scripts` at the root. Do not use `--workspace`. Confirm that `git diff package-lock.json` changes only the `libs/celebrations` workspace entry (`:346`). If it changes more, revert it and record why.
- [x] 2.5 Add `L/utils/tests/lottie-player.spec.ts` with these cases:
  - "the installed player matches the pinned profile": read `lottie-web/package.json` through `createRequire(import.meta.url)`, and read the library manifest, and compare both with `LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION`
  - "creates the renderer with the lottie-light-svg-v1 options": a fake player records the options, and `setSubframe(true)` comes after `loadAnimation`
- Verification for group 2:
  - `npm run test:file -- libs/celebrations/src/utils/tests/lottie-player.spec.ts libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts libs/celebrations/src/new-year/components/NewYearPenguinStar/tests/NewYearPenguinStar.spec.tsx libs/celebrations/src/new-year/utils/tests/penguin-star.spec.ts libs/celebrations/src/new-year/utils/tests/penguin-star-selector.spec.ts`
    - Expect 41 + 31 GiftWrapping tests unchanged, and the existing PenguinStar counts unchanged.
  - `grep -rn "gift-wrapping-player\|loadGiftWrappingPlayer" libs/celebrations/src` prints nothing.
  - `npm run validate:docs` passes. The manifest changed, and check 5 must accept the exact version.
  - Then run `npm run verify:changed` once.
  - Result (apply, 2026-10-01):
    - **Targeted tests:** 6 files, 157/157. That is 3 new tests, 41 + 31 GiftWrapping and 82 PenguinStar, the same 82 as on the base tree.
    - **Old loader:** the grep for `gift-wrapping-player`/`loadGiftWrappingPlayer` prints nothing.
    - **`validate:docs`:** passes, and accepts the exact version.
    - **Lockfile:** `package-lock.json` changed only at `:346`.
    - **`verify:changed`, typecheck:** passes. The first run failed in `@epam/ai-dial-chat-shared:typecheck` because the local `node_modules` had `@epam/ai-dial-ui-kit` 0.15.0-dev.30 while the lockfile pins dev.35. `npm install` synced it without changing any manifest.
    - **`verify:changed`, lint:** `@epam/ai-dial-celebrations` passes. Two prettier errors remain in files this change does not touch (`libs/chat-shared/src/constants/entity-colors.ts:20` and `libs/attachment-canvas/.../AttachmentCanvasBody.spec.tsx:124`). They are pre-existing on `development` and were left alone.
    - **`test:changed`:** it covers every project because the lockfile changed, and took 41 min under load. Four failures:
      - two 5000 ms timeouts caused by the load: `gift-wrapping.spec.ts` (31/31 in isolation) and `Input.send-tooltip.spec.tsx` (25/25 in isolation)
      - the two known S0 failures, `useSkillFileSystemPicker.spec.ts` and `app-config.service.spec.ts`
    - **Deviations:**
      - Both component specs mock `utils/lottie-player` through `importOriginal`, so the real `createLottieLightSvgAnimation` stays available.
      - `createLottieLightSvgAnimation` destroys its renderer (falling back to `replaceChildren`) before it rethrows a `setSubframe` failure. Before the change the caller held the `AnimationItem` and released it in `finish`; with the helper it no longer can. A test covers this.

## 3. Imperative session (`L/utils/lottie-scene-session.ts`)

- [x] 3.1 Implement the module as specified in `design.md` D1–D7:
  - the enums `LottieSceneSessionState`, `LottieSceneOutcome` and `LottieDataOwnership`
  - the types `LottieSceneTimings`, `LottieAnimationContext` and `LottieScenePlayback`
  - `createLottieSceneSession({ playback, prepare, onPrepared, onTerminal, loadPlayer = loadLottiePlayer })`

  Follow these constraints:
  - Use the global `setTimeout` and `clearTimeout`, not `window.*`.
  - Do not reference observers, anchors or layout.
  - Wrap each teardown step in its own `try/catch`, in the D6 order.
  - Use `JSON.parse(JSON.stringify(…))` only for `Shared`.
  - Write multi-line comments as `/* … */`.
- [x] 3.2 Add `L/utils/tests/lottie-scene-session.spec.ts`. Use fake timers and a fake player whose `loadAnimation` appends an `svg` and mutates `animationData` in place. Test names describe behavior:
  - "starts the playback deadline at readiness, not at import or renderer creation"
  - "fails when the player import exceeds the load deadline and ignores its late resolution"
  - "fails at the readiness deadline when the renderer reports isLoaded without DOMLoaded"
  - "fails immediately when DOMLoaded arrives on an unloaded renderer"
  - "plays once when DOMLoaded repeats and ignores callbacks after the end"
  - "cancels without importing when disposed before the start microtask"
  - "cancels without importing when the document is hidden at start"
  - cancellation in each phase: `loading`, `prepared`, `initializing` and `playing`. It ends `cancelled`, never reports `failed` later, and leaves no timer.
  - "ignores an import that resolves after cancellation: no preparation, no renderer"
  - "does not notify after dispose and tolerates repeated cancel and dispose"
  - "reports exactly one outcome when completion, the deadline and an interrupt coincide"
  - "removes renderer nodes and still runs every disposer when destroy throws"
  - "runs the remaining disposers and destroy when one disposer throws"
  - "fails and releases resources when loadAnimation, setSubframe, play or onAnimationCreated throws"
  - "maps complete to completed and data_failed or error to failed"
  - "prepares only after the import resolves, exactly once"
  - "clones shared animation data for every playback so a mutating player cannot alter the source"
  - "hands transferred data to the player once and ignores a second attach"
  - "a rejected import does not prevent a later session from loading"
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-scene-session.spec.ts`. The file must cover every row of `design.md` D5.
  - Result (apply, 2026-10-01): 28/28 pass; the celebrations typecheck and eslint are clean. Deviation from the D1 sketch: `.claude/rules/all-ts.md` puts shared enums in `types/` and shared interfaces in `models/`. The enums therefore live in `L/types/lottie-scene.ts` (together with the hook's `LottieScenePhase`), and the session and hook interfaces in `L/models/lottie-scene.ts`. `utils/lottie-scene-session.ts` holds only `createLottieSceneSession`. Names and behavior are as designed. The hook-level D5 row (load or readiness failure, then input) is covered in group 4.

## 4. React adapter (`L/hooks/useLottieSceneSession.ts`)

- [x] 4.1 Implement `useLottieSceneSession({ enabled, playback, prepare })`. It returns `{ phase, preparation, hostRef, cancel }`, where `LottieScenePhase` is a string enum.
  - **Session effect:** depends on `[enabled, ended, failed]`. It creates and starts one session per run and calls `dispose()` on cleanup.
  - **Attach effect:** keyed on the preparation state, which carries its session. It calls `session.attach(hostRef.current)`.
  - `prepare` is held in a ref.
  - `cancel` is a stable `useCallback`. It hides `hostRef.current`, cancels the current session, and sets `Ended` from any phase, including `Failed`. That preserves today's input-after-fallback path.
  - Outcome mapping: `Completed`/`Cancelled` → `Ended`, `Failed` → `Failed`. A disposed session never updates state.
  - Write a JSDoc that explains why the hook exists, per `.claude/rules` for hooks.
- [x] 4.2 Add `L/hooks/tests/useLottieSceneSession.spec.tsx`. Use `renderHook` with a `StrictMode` wrapper where named, and mock `../../utils/lottie-player`:
  - "imports the player and prepares once under StrictMode"
  - "never calls the loader while disabled"
  - "ends instead of falling back when cancelled during a pending import"
  - "keeps an ended scene ended when the load deadline later elapses"
  - "does not restart or reset the load deadline when the caller re-renders with a new prepare function"
  - "disposes the session on unmount without state updates or remaining timers"
  - "reports failure when the import rejects"
  - Verification: `npm run test:file -- libs/celebrations/src/hooks/tests/useLottieSceneSession.spec.tsx libs/celebrations/src/utils/tests/lottie-scene-session.spec.ts`. Then run `npm run verify:changed` once for groups 3–4.
  - Result (apply, 2026-10-01): 38/38 (28 session tests and 10 hook tests). Eslint (react-hooks included) and the typecheck are clean. The full `@epam/ai-dial-celebrations:test` passes 69 files / 1205 tests.
    - Deviation: `verify:changed` was not repeated for this slice. The lockfile change marks every project affected (the group 2 run took 41 min), while groups 3–4 change only new files in `libs/celebrations`. The scoped run above replaced it, and the next `verify:changed` covers groups 3–5 together.
    - Extra hook tests: "ends the static fallback when cancelled after a failure" (the D5 failure-then-input row), "prepares with the latest prepare function", and "keeps cancel referentially stable across renders".

## 5. GiftWrapping adopts the session

- [x] 5.1 Rewrite `L/new-year/utils/gift-wrapping-animation.ts` as the scene adapter. It exports:
  - `GIFT_WRAPPING_TIMINGS = { loadTimeoutMs: 2000, readyTimeoutMs: 250, playbackMs: GIFT_WRAPPING_MS }`
  - `GIFT_WRAPPING_PLAYBACK: LottieScenePlayback<GiftWrappingComposition>`, with `ownership: Transferred`, `getAnimationData: (c) => c.animationData`, and `onAnimationCreated`

  `onAnimationCreated` installs today's `MutationObserver` (the filter at `:92-115` and the options at `:116-130`), the `ResizeObserver` on up to 24 ancestors (`:131-138`) and the 0.5 px `moved` check (`:62-72`), when `target.source` exists. It registers one disposer that disconnects both observers. Every stop condition calls `ctx.cancel()`.

  Remove `animateGiftWrapping`.
- [x] 5.2 Rewrite the lifecycle in `L/new-year/components/NewYearGiftWrapping/NewYearGiftWrapping.tsx`.
  - Keep: the `initial`/`changed`/`supported` computation (`:25-34`).
  - Replace both effects (`:43-140`) with:
    - `useLottieSceneSession({ enabled: !reduced && supported && !changed, playback: GIFT_WRAPPING_PLAYBACK, prepare: () => buildGiftWrappingComposition(getGiftWrappingTarget(anchors, isMobile), isMobile) })`
    - one effect that installs the existing interrupt list (`:56-71`, unchanged), calling `cancel`. It depends on `[cancel, changed, ended]`, and the visibility handler still ignores `visibilitychange` while the document is visible.
  - Keep the render branches and markup byte-for-byte (`:142-174`): `ended || changed` → `null`; the static art when reduced, unsupported or `Failed`; `null` before preparation; the host `div` with `ref={hostRef}` and `data-gift-target`.
- [x] 5.3 Add a test to `L/new-year/utils/tests/gift-wrapping.spec.ts`: "keeps the load, readiness and playback budget inside the provider lifetime". It asserts `GIFT_WRAPPING_TIMINGS` equals `{ 2000, 250, 16000 }`, and that their sum is at most `NEW_YEAR_SCENE_DURATIONS[NewYearScene.GiftWrapping]` (18500).
- [x] 5.4 Add these tests to `NewYearGiftWrapping.spec.tsx`. Do not edit the existing tests.
  - "interrupting renderer initialization destroys the renderer once and ignores a late DOMLoaded"
  - "a second activation renders a newly built composition", which checks that the second `loadAnimation` `animationData` is not the first object
- Verification for group 5:
  - `npm run test:file -- libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts libs/celebrations/src/new-year/components/NewYearPenguinStar/tests/NewYearPenguinStar.spec.tsx libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx libs/celebrations/src/context/tests/CelebrationRuntime.spec.tsx libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx libs/celebrations/src/stories/tests/story-coverage.spec.ts`
    - All 41 original GiftWrapping component tests pass with their assertions unchanged.
  - Then `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx`, which is consumer verification. Expect 19/19.
  - Then run `npm run verify:changed` once.
  - Result (apply, 2026-10-01):
    - **Targeted tests:** 7 library files, 179/179. GiftWrapping is 43 component tests (41 original, assertions unchanged, plus 2 new) and 32 utils tests (31 plus the budget test).
    - **Host tests:** 19/19.
    - **Typecheck:** `verify:changed` typecheck passes.
    - **Lint:** two errors in the new test (render-result naming) were fixed. `@epam/ai-dial-celebrations` lint passes. `lint:affected` still fails only on the two pre-existing prettier errors in untouched `libs/chat-shared` and `libs/attachment-canvas`, so `verify:changed` stops before its test step.
    - **`test:changed`** (run directly): fails only on the two known S0 tests, `app-config.service.spec.ts` and `useSkillFileSystemPicker.spec.ts`.

## 6. Lazy chunks and architecture guard

- [x] 6.1 Run `npm exec nx run @epam/ai-dial-celebrations:build -- --skip-nx-cache` and record:
  - `grep -o 'import("[^"]*lottie_light[^"]*")' libs/celebrations/dist/new-year.js`, which returns exactly one match
  - `grep -nE '(^|;)import[^(]*lottie_light|from"?\s*"\./lottie_light' libs/celebrations/dist/new-year.js`, which returns nothing
  - `grep -c lottie_light libs/celebrations/dist/index.js libs/celebrations/dist/halloween.js`, which returns 0 for both
  - the emitted `lottie_light-*.js` size

  Size changes are recorded and not claimed as gains.
- [x] 6.2 Run `npm exec nx run @epam/chat:build` (or `npm run build:quiet`, because bundling is affected). Find the chunk that contains `data-new-year-scene`. Record that it references the `lottie_light-*.js` file only inside `import(`/`__vitePreload`, and that no entry chunk imports `lottie_light` statically.
- [x] 6.3 Run the architecture guard. Each of these must print nothing:
  - `grep -nE "window\.|visualViewport|getBoundingClientRect|Observer\b|anchors|composer|/api|chat-api-client|server-api|Storage|indexedDB|process\.env|i18n|fetch\(" libs/celebrations/src/utils/lottie-player.ts libs/celebrations/src/utils/lottie-scene-session.ts libs/celebrations/src/hooks/useLottieSceneSession.ts`
  - `grep -n "lottie-player\|lottie-scene-session\|useLottieSceneSession" libs/celebrations/src/index.ts libs/celebrations/src/new-year/index.ts libs/celebrations/src/halloween/index.ts`

  `npm exec nx lint @epam/ai-dial-celebrations` passes (`@nx/dependency-checks` included).
- Result (apply, 2026-10-01):
  - **Library build** (`--skip-nx-cache`):
    - `dist/new-year.js` contains exactly one `import("./lottie_light-DVla0_7m.js")` and no static import.
    - `index.js` and `halloween.js` have 0 `lottie_light` references.
    - The lazy chunk is `lottie_light-DVla0_7m.js` at 220,422 B, the same name and size as the S0 baseline.
    - `new-year.js` is 117.57 kB raw / 26.07 kB gzip, against 115.10 / 24.80 kB at `1cfb11468`. This is recorded only; no size claim is made.
  - **Chat build:**
    - The `data-new-year-scene` chunk is `new-year-C-3raTC1.js`, 87,810 B (85,907 B at the baseline).
    - It references `lottie_light-Bkub-vI-.js` (169,432 B, identical to the baseline) only through `await import(...)` inside the preload helper.
    - No chunk imports `lottie_light` statically.
  - **Architecture guard:** both greps print nothing, and `@epam/ai-dial-celebrations` lint passes.

## 7. GiftWrapping browser comparison

- [x] 7.1 Build Storybook with `npm exec nx run @epam/ai-dial-celebrations:build-storybook`. Then, from `libs/celebrations`, run `node --test --test-name-pattern='^gift-wrapping baseline' browser-tests/celebrations-baseline.browser.spec.mjs`. Record:
  - the capture ID
  - whether the host was idle
  - Chromium, OS and Node versions

  If the run fails or cannot run, leave this task unchecked and record why. Do not estimate values.
- [x] 7.2 Run `node libs/celebrations/browser-tests/summarize-baseline.mjs <captureId>`. Write `tmp/celebrations-baseline/<captureId>/comparison.md`, which compares each of the 17 cells and both cycle modes with [#9219 part 2](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933167447). Use three sections:
  - **Observed equal or different:**
    - elements, `svg` and `data-gift-target` at 50 %
    - the player request present for motion cells and absent for reduced-motion cells
    - `rendererInsertsAfterMountMs = []` for `cancel-load`
    - end + 500 ms: layer gone, 0 animations, 0 detached `svg`
    - cycle maxima: 0–0 elements and 0 copies
  - **Reported only:** ready times, frames p50/p95/max, heap and request timing.
  - **Unmeasured:** cancellation during deferred preparation, renderer initialization (jsdom-only, groups 3–5), and PenguinStar.

  Any "different" row blocks completion until it is explained or fixed.
  - Verification:
    - `cd tmp/celebrations-baseline/1cfb11468 && shasum -a 256 -c --quiet artefacts.sha256` still exits 0
    - publish nothing to GitHub without an explicit user request (`design.md` Open Question 1)
  - Result (apply, 2026-10-01):
    - **Run:** capture ID `bd5d8ced9-wt-2a611f7a` (`origin/development` plus the uncommitted S1 tree). Chromium 148.0.7778.96, darwin 25.6.0 arm64, Node v20.19.5. Started 17:12:52Z and finished 17:33:38Z, with exit 0.
    - **Host:** not idle. A Vite dev server from another session ran at about 100 % CPU, and Spotlight was indexing; load average 30–44 on 12 cores.
    - **Comparison:** `tmp/celebrations-baseline/bd5d8ced9-wt-2a611f7a/comparison.md`, Git-ignored. It was generated by a scratchpad script from both `results.json` files, so no harness change was needed. All 17 cells and both 20-cycle modes are **equal** to `1cfb11468`, with 0 differences:
      - 316 elements at 50 % with the composer target, 320 with the parcel target, 128 static
      - a player request in every motion cell, none under reduced motion
      - `cancel-load` renderer inserts `[]`
      - end + 500 ms: layer gone and 0 animations
      - 0 detached `svg` and 0 copies in every cell and cycle
    - **Reported only:** for example, desktop-ltr-motion ready at 21.1 ms vs 16.3 ms and Slow 4G at 1529.6 ms vs 1550.4 ms. Frames, heap and request offsets are recorded without pass/fail, because the host was busy.
    - **Baseline integrity:** `tmp/celebrations-baseline/1cfb11468/artefacts.sha256` still verifies.
    - Nothing was published.

## 8. Validation and close

- [x] 8.1 Run `openspec validate extract-shared-lottie-playback-lifecycle --strict`.
- [x] 8.2 Run `npm run validate:docs`, because `libs/celebrations/package.json` changed. Confirm that no README or `docs/**` needs an edit: no export, prop, class or entry point changed.
- [x] 8.3 Run exactly one `npm run verify:full`. If it fails only in `apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts` or `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` (the S0 task 5.2 failures), record the output and leave this task open until those are fixed separately or explicitly accepted. Any other failure is S1's to fix.
  - Result (apply, 2026-10-01). **Not green, so the task stays open.**
    - One `npm run verify:full`: `typecheck:full` passes. `lint:check` fails only in `@epam/ai-dial-chat-shared:lint` (`src/constants/entity-colors.ts:20`) and `@epam/ai-dial-attachment-canvas:lint` (`AttachmentCanvasBody.spec.tsx:124`). Both are prettier errors that already exist on `origin/development` (confirmed with `git show origin/development:…`), in files this change does not touch.
    - Because of that, `verify:full` stopped before `test:full`. The equivalent all-project run is the post–group 5 `test:changed` (the lockfile change makes every project affected). It fails only on the two S0 tests, `useSkillFileSystemPicker.spec.ts` and `app-config.service.spec.ts`.
    - Every changed and new S1 file passes `prettier --check`.
    - Closing this task needs either separate fixes for these four out-of-scope failures or an explicit acceptance.
    - Accepted (2026-10-01): the user explicitly accepted these four out-of-scope failures for S1 (option 1) and asked for the commit and PR.
- [x] 8.4 Map the evidence to every #9220 criterion in the PR description, using the table in `proposal.md` §Acceptance criteria. Include the lazy-chunk output (group 6), the test counts (groups 2–5) and the comparison summary (group 7).
  - Result (apply, 2026-10-01): the evidence for each criterion is in the description of [#9249](https://github.com/epam/ai-dial-chat/pull/9249).

## 9. Follow-ups (record only; out of scope)

- [ ] 9.1 S7 (#9226): decide whether PenguinStar adopts the session. That needs a readiness-policy decision for `penguin-star-animation.ts:70,175` and a disposer for frame-driven borrowing.
- [ ] 9.2 S2 (#9221): add the `AbortSignal` animation-data loader (C3) ahead of `prepare`, using `LottieDataOwnership.Shared`.
- [ ] 9.3 S4 (#9223): the deterministic Cat pre-readiness cancellation cell that S0 left unmeasured.

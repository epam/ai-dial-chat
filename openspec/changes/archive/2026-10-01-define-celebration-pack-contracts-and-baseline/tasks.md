**Slicing strategy: contract-first, then risk-first evidence.**

- The contracts are already fixed in `specs/` and `design.md`.
- The apply phase turns them into evidence in this order: reproducible text inventory first, then browser capture (the riskiest part: new automation), then the contract hand-off checks.
- No task changes runtime code. The only files outside this change directory are the dev-only browser harness, its summarizer and its Nx target (group 3).
- Measurements are point-in-time, so they are **published on #9219 instead of committed** (see `specs/celebration-migration-baseline`). `D = tmp/celebrations-baseline/1cfb11468/evidence` (Git-ignored) holds the drafts of those comments, and task 5.4 publishes them. The contract examples stay in the repository under `X = openspec/changes/define-celebration-pack-contracts-and-baseline/examples`.

How the tasks map to the #9219 acceptance criteria:

| #9219 acceptance criterion | Tasks |
| --- | --- |
| AC1: first asset authorable against a pinned profile and documented schema | 4.1, 4.2 |
| AC2: reproducible baseline; historical LOC not shown as current | 1.1, 2.1–2.5, 3.1–3.6, 5.4 |
| AC3: every layer owned; no app/API/auth/config/locale knowledge in libs | 4.3 |
| AC4: rollback distinguishes bundled, external-only and post-start failures | 4.1 (fixture checks the fallback matrix references) |
| AC5: ZIP, arbitrary URLs, scripts/CSS/fonts and a DSL excluded | 4.1 (negative fixtures) |
| OpenSpec artifacts validate | 5.1 |

The source counts, file payloads and regression-suite counts were observed while the proposal was prepared, so these tasks only record them. Group 3 was measured during apply. `design.md` §Baseline carries a summary; the full numbers are in the #9219 baseline comments.

## 1. Baseline record

- [x] 1.1 Draft `D/baseline.md` (baseline comment, part 1). It records:
  - the `ai-dial-chat` implementation revision `1cfb11468688de5c13c7c4e6de4e0e8771b3776e`, with its date
  - the planning reference `62b34e244`
  - `git log --oneline 62b34e244..1cfb11468`
  - the `epam/ai-dial-chat-themes` revision `22cdaddbcb00c3b69c2dc021cb3bc594ace79f8d`
  - the resolved versions of `lottie-web` and `playwright`, plus `node --version`
  - a scoped `git status --short` stating that `libs/celebrations`, `apps/chat/src/context`, `apps/chat-api/src/themes` and `libs/chat-overlay` are clean

  State that the implementation baseline has 21 scenes and the planning reference has 20, and that PenguinStar is a measured delta outside the pilots.
  - Verification: `git rev-parse HEAD`; `git merge-base --is-ancestor 62b34e244 1cfb11468`; `gh api repos/epam/ai-dial-chat-themes/commits/development --jq .sha`; `node -p "require('./node_modules/lottie-web/package.json').version"`; `git status --short -- libs/celebrations apps/chat/src/context apps/chat-api/src/themes libs/chat-overlay` prints nothing.

## 2. Reproducible inventory (depends on 1.1)

- [x] 2.1 Write `D/count-celebrations-source.mjs`. It takes a revision argument and reads every file with `git ls-tree` and `git show`, using the counting rule in `specs/celebration-migration-baseline/spec.md`. Record its output for `62b34e244` and `1cfb11468` in `D/baseline.md`, and note beside the numbers that the 24,785 figure belongs to `1cfb11468` only. The script is published inside the baseline comment.
  - Verification: `node D/count-celebrations-source.mjs 62b34e244` prints `124 / 22,779 / 22,026` total, and `node D/count-celebrations-source.mjs 1cfb11468` prints `133 / 24,785 / 23,996` total.
- [x] 2.2 Draft `D/scene-inventory.md`. It has one row for each of the 21 IDs in `libs/celebrations/src/halloween/types/halloween.ts` and `libs/celebrations/src/new-year/types/new-year.ts`, and marks which 20 belong to the planning reference. Each row records:
  - story
  - pool
  - `durationMs` and the scene's internal clock
  - renderer
  - anchors read, and whether host controls are measured, copied or moved live
  - reduced-motion, missing-target and unsupported-API fallback
  - interrupt events
  - `Math.random` sites
  - own files with physical lines

  Shared files and the decor behaviors go in separate tables. Every cell cites `path:line` or says "unverified".
  - Verification: `node D/verify-scene-inventory.mjs`, asserting that the table's ID set equals `Object.values(HalloweenScene)` ∪ `Object.values(NewYearScene)`, parsed from the two enum files with a regex; `wc -l` re-check of every listed file.
- [x] 2.3 Write `D/measure-payload.mjs` (raw, gzip level 9, Brotli quality 11) and draft `D/payload.md`. Measure every `git ls-files 'libs/celebrations/src/**/assets/*'` entry, plus `node_modules/lottie-web/build/player/lottie_light.min.js` and `lottie.min.js`. Note that `gift-wrapping-elves.json` is a contour rig, not a Lottie export.
  - Verification: `node D/measure-payload.mjs $(git ls-files 'libs/celebrations/src/**/assets/*') node_modules/lottie-web/build/player/lottie_light.min.js` reproduces the values in `design.md` §Baseline.
- [x] 2.4 Record built chunk sizes in `D/payload.md`. Cover the `@epam/ai-dial-celebrations` entries `index.js`, `halloween.js` and `new-year.js`, and the lazily emitted `lottie_light` chunk. Also cover the `@epam/chat` emitted chunks containing the `halloween`/`new-year` modules and `lottie_light`. Give raw and gzip sizes from the build reporter (`reportCompressedSize: true`, `libs/celebrations/vite.config.mts`). This is read-only measurement: commit no build output.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:build` and `npm exec nx run @epam/chat:build` succeed; `ls libs/celebrations/dist` and the `apps/chat/dist/assets` listing match the recorded names.
- [x] 2.5 Draft `D/regression-suites.md` with the per-file pass counts and the Nx project names (`@epam/ai-dial-celebrations`, `@epam/chat`; target `test`).
  - Verification: `npm run test:file -- libs/celebrations/src/context/tests/CelebrationRuntime.spec.tsx libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx libs/celebrations/src/halloween/components/Halloween/tests/HalloweenCatScene.spec.tsx libs/celebrations/src/halloween/utils/tests/halloween-cat-targets.spec.ts libs/celebrations/src/halloween/utils/tests/halloween-cat-animation.spec.ts libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx` passes 9 files / 251 tests (observed at proposal time); `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx` passes 2 files / 19 tests.

## 3. Browser baseline harness and capture (depends on 2.x)

- [x] 3.1 Add `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs`. It follows the `node:test` plus `playwright` pattern of `apps/chat/browser-tests/text-refinement.browser.spec.mjs`. It builds the static Storybook (`npm exec nx run @epam/ai-dial-celebrations:build-storybook`), serves it with `express.static`, and asserts that the story IDs `new-year-scenes--sleigh`, `new-year-scenes--gift-wrapping` and `halloween-scenes--cat` exist in `index.json`. Register the Nx target `test-baseline-browser` (`"command": "node --test browser-tests/celebrations-baseline.browser.spec.mjs"`, `cwd: libs/celebrations`) in `libs/celebrations/package.json` `nx.targets`.

  Architecture guard: the harness imports nothing from `apps/*`, `@epam/ai-dial-chat-api-client` or `server-api`; it is not part of the `src/` build; `exports` and `files` are unchanged. Read `.claude/rules/libs.md` before editing the manifest.
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-baseline-browser` runs the story-ID test green; `npm exec nx show project @epam/ai-dial-celebrations --json` lists the target; `npm run validate:docs` passes.
- [x] 3.2 Add the determinism controls to the harness:
  - `page.addInitScript` replaces `Math.random` with a seeded PRNG, and records the seed
  - viewports 1440×900 at DPR 1, 390×844 at DPR 3 with touch, and 360×780
  - `<html dir>` set to `ltr`/`rtl` before activation
  - `page.emulateMedia({ reducedMotion })`
  - a CDP network profile for "Slow 4G"
  - capture points: activation, renderer ready, 25/50/75% of `durationMs`, end, and end + 500 ms
  - metrics: transferred bytes per request, element count in `.dial-celebrations-scene-layer`, a rAF frame sampler plus long-task `PerformanceObserver` (p50/p95), `document.getAnimations().length`, and the heap after `HeapProfiler.collectGarbage` when available

  Frames go to `tmp/celebrations-baseline/1cfb11468/<scene>/<cell>/`, plus a Playwright trace per run.
  - Verification: a smoke test in the same spec asserts that two runs with the same seed produce identical per-capture element counts for `sleigh` at desktop/LTR.
- [x] 3.3 Capture `sleigh`: {desktop, mobile 390, mobile 360} × {LTR, RTL} × {motion, reduced}. Add cancellation (`pointerdown` at 50% of the playback) and 20 activate→complete plus 20 activate→cancel cycles. Mark missing-anchor N/A with the reason "reads no anchors".
  - Verification: `npm exec nx run @epam/ai-dial-celebrations:test-baseline-browser` passes for the sleigh cases; the frames and trace exist for every non-N/A cell.
- [x] 3.4 Capture `gift-wrapping`: the same matrix, plus:
  - composer anchor removed before activation (expect the parcel path)
  - `pointerdown` before the `lottie_light` chunk resolves (expect no SVG renderer node afterwards)
  - `pointerdown` at 50% of the playback
  - a "Slow 4G" run, recording when the 2000 ms load deadline is hit
  - a reduced-motion run, recording that no `lottie_light` request is made
  - 20+20 replay cycles
  - Verification: the same Nx target passes for the gift-wrapping cases; the request log for the reduced-motion cells contains no `lottie_light` chunk.
- [x] 3.5 Capture `cat`: the same matrix, plus:
  - composer anchor removed (expect the CSS crossing fallback)
  - cancellation during preparation and at 50%
  - 20+20 cycles, recording the remaining copied-control nodes and live animations after the last cycle
  - Verification: the same Nx target passes for the cat cases; post-cycle counts are recorded and no assertion is made beyond what was observed.
- [x] 3.6 Draft `D/browser-baseline.md` (baseline comment, part 2) with the environment (OS, CPU, Chromium build), the seed, every cell's metrics or its N/A reason, and the artefact count with the SHA-256 of `artefacts.sha256`. The tables come from `libs/celebrations/browser-tests/summarize-baseline.mjs`, which also writes `tmp/celebrations-baseline/1cfb11468/artefacts.sha256`. If any cell cannot run, record why and leave its task unchecked. Do not estimate missing values.
  - Verification: `cd tmp/celebrations-baseline/1cfb11468 && shasum -a 256 -c --quiet artefacts.sha256`; the cell count equals the matrix size minus the documented N/A cells.

## 4. Contract hand-off checks (independent of group 3)

- [x] 4.1 Commit example fixtures in `X/fixtures/`:
  - `config.v1.example.json` and `manifest.sleigh.v1.example.json`, matching the spec examples
  - negative fixtures: undeclared asset reference, `event` block on a known event, text layer, `schemaVersion: 2`, an absolute URL in `file`, a `script`/`css` field

  Also commit `X/check-contract-examples.mjs`. It checks ID regexes, asset-reference integrity, the inequality `maxLifetimeMs ≥ loadTimeoutMs + readyTimeoutMs + playbackDurationMs` with every value under its cap, unknown capability IDs, and the excluded fields. This is a dev-only planning check, not the S2 validator.
  - Verification: `node X/check-contract-examples.mjs` exits 0 for the positive fixtures and reports the expected rule for each negative fixture.
- [x] 4.2 Draft `D/player-profile.md` (published with part 1) with the evidence behind `lottie-light-svg-v1`:
  - the `package-lock.json` resolution
  - `grep -n "registerRenderer('" node_modules/lottie-web/build/player/lottie_light.js`, showing only `svg`
  - no `registerEffect(` call sites outside its definition
  - expressions installed only through `installPlugin`
  - the exact `loadAnimation` options quoted from `libs/celebrations/src/new-year/utils/gift-wrapping-animation.ts:74-86`

  State the open S1 decision: an exact pin in `libs/celebrations/package.json`, or a resolved-version check.
  - Verification: the commands in the file reproduce the quoted output.
- [x] 4.3 Architecture guard for the whole change:
  - `git diff --name-only origin/development` lists only this change directory, `libs/celebrations/browser-tests/**` and `libs/celebrations/package.json` (the `nx.targets` entry only)
  - `grep -rnE "/api|chat-api-client|server-api|localStorage|process\.env|i18next" libs/celebrations/browser-tests` returns no matches
  - Verification: both commands produce the stated results.
  - Result (apply, 2026-10-01): `origin/development` had moved on to `6f02fe559`, so the diff was taken against the baseline HEAD `1cfb11468` instead. `git status --short` listed only `libs/celebrations/package.json` (11 added lines, the `nx.targets.test-baseline-browser` entry), `libs/celebrations/browser-tests/` and this change directory. Lint then required one more file: `libs/celebrations/eslint.config.mjs`, where `{projectRoot}/browser-tests/**` was added to `@nx/dependency-checks` `ignoredFiles`, the same exemption the lib already has for Storybook files. Without it, `express` and `playwright` would have had to move into shipped dependencies, which `.claude/rules/libs.md` forbids. The grep returned no matches (exit 1), after the harness's `BASELINE_SCOPE`/`BASELINE_CELLS` environment switches were replaced by `node --test --test-name-pattern`. Edits from a parallel session (`apps/chat-api/src/share/**`, `libs/share/**`, `libs/attachment-canvas/**`) were present during the run, were left untouched at the user's request, and are not part of this change.

## 5. Validation (closes the change)

- [x] 5.1 `openspec validate define-celebration-pack-contracts-and-baseline --strict` passes.
- [ ] 5.2 After group 3, run `npm run verify:changed` once. Close with exactly one `npm run verify:full`. Run `npm run validate:docs` because `libs/celebrations/package.json` changed. Do not run `npm run build:quiet`: no shipped bundle changes.
  - Result (apply, 2026-10-01). **Not green, so the task stays open.**
    - `npm run validate:docs` passes.
    - `npm run verify:changed` was run twice. The first run failed on `@nx/dependency-checks`; that was fixed (see 4.3). On the second run, typecheck and lint pass, and the `@epam/ai-dial-celebrations` tests pass. One `@epam/chat` test fails: `apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts` › "resolves with the downloaded files from their own bucket" (expected `'# Notes'`, received `'[object Blob]'`). It fails 3/3 in isolation at baseline HEAD `1cfb11468`, upstream has not touched it, and this change edits nothing under `apps/chat`.
    - `npm run verify:full` (one run): typecheck, lint and format pass. Tests: 1 failure each in two projects. One is the same `useSkillFileSystemPicker` test. The other is `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` › "exposes only refinement availability for model undefined" (expected `true` to be `false`), which passes 2/2 in isolation, so it depends on test order or shared state. This change touches nothing in `apps/chat-api`.
    - Both failures are outside this change's files. Closing the gate needs either a separate fix or an explicit acceptance.
- [ ] 5.3 Before archiving, confirm that every task in groups 1–4 and 5.4 is checked and that the #9219 baseline comments exist. Archive S0 only then, because its contract specs become main specs that S1–S6 will MODIFY.
  - Status (apply, 2026-10-01): groups 1–4 are checked, and the drafts in `D/` reproduce their recorded results. Still blocked on 5.2 and 5.4.
- [x] 5.4 After the user has reviewed the text, publish the baseline comments on #9219: part 1 (revisions, source counts with the script, scene inventory, payload, regression suites, player profile) and part 2 (browser baseline). Each part must stay under GitHub's 65,536-character comment limit. Then add the comment links to `design.md` §Baseline.
  - Verification: `gh issue view 9219 --repo epam/ai-dial-chat --comments` shows both parts, and the totals in them match `node D/count-celebrations-source.mjs` and `artefacts.sha256`.
  - Publication (2026-10-01, explicitly requested by the user): [part 1](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933161567), [part 2](https://github.com/epam/ai-dial-chat/issues/9219#issuecomment-5933167447). Both saved bodies match the prepared publication files. All 365 binary artefacts match `artefacts.sha256`; the comments publish the measurements and digest, while binaries remain in Git-ignored `tmp/`. Part 2 preserves the outstanding Cat preparation-cancellation and rerun-provenance limitations. Tasks 5.2 and 5.3 remain open.

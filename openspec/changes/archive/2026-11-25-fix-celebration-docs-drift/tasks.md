# Tasks

Slicing: one slice per surface (JSDoc, README, specs), each verifiable on its own.
There is no runtime change, so no new tests. The existing `celebrations` suite
proves nothing executable moved.

## 1. JSDoc in `libs/celebrations`

- [x] 1.1 Replace the `Spiders`, `Ghost`, `Bats` and `Cat` JSDoc in `libs/celebrations/src/halloween/types/halloween.ts` with the text in `design.md` "Exact text". Leave `Web`, `Witches` and the other members alone. Verify: `git diff` touches comment lines only and no "will-o" remains (`grep -rn "will-o" libs/celebrations/src`).
- [x] 1.2 Replace the `NewYearScene.ReindeerTakeoff` JSDoc in `libs/celebrations/src/new-year/types/new-year.ts` with the design text. Verify: `grep -rn "page button" libs/celebrations/src/new-year` returns nothing.
- [x] 1.3 Replace the `isCelebrationSceneSupported` JSDoc in `libs/celebrations/src/utils/celebration-pack-scene.ts` with the design text. Leave the function body unchanged. Verify: `git diff` of that file is one comment line.
- [x] 1.4 Architecture guard: the edited comments name no app class, route, `/api` path, storage key or app context. Verify: `npm exec nx lint @epam/ai-dial-celebrations` and `npm run test:file -- libs/celebrations/src/utils/tests/celebration-pack-scene.spec.ts` pass, then run `npm run verify:changed` once for the slice.

## 2. README

- [x] 2.1 In `libs/celebrations/README.md`, PenguinStar section, change "picks the penguin, the snowman or the fireworks elf" to "picks the penguin, the snowman, the fireworks elf or the cat". Verify: the sentence matches the GiftWrapping section and `NEW_YEAR_CLICK_SCENES` in `libs/celebrations/src/new-year/constants/new-year.ts`; `npm run validate:docs` passes.

## 3. Specs

- [x] 3.1 Re-read the four delta specs under `openspec/changes/fix-celebration-docs-drift/specs/` against HEAD. If `development` changed any of the four requirement blocks since `b3e254229`, merge the upstream text into the delta before going on. Verify: `openspec validate fix-celebration-docs-drift --strict` passes.
- [x] 3.2 Run `npm run validate:specs` and `npm run spec:impact`. Verify: no failure. Any new warning is either a cited identifier that exists (`CelebrationAnchors`, `HALLOWEEN_SCENE_DURATIONS`) or is resolved.

## 4. Close

- [x] 4.1 Run `npm run verify:full` once. Verify: it passes, with the doc and spec checks from groups 2–3 still green.
  - Result (2026-11-25): typecheck, lint, format and every test target except `@epam/chat-api:test` passed. `@epam/chat-api:test` fails 211 tests in 8 files under `apps/chat-api/src/app-config/` and `apps/chat-api/src/config/tests/explicit-environment.spec.ts` (e.g. `pairs.map is not a function` in `readManagedRuntimeSettings`) when the suite runs whole. The same files pass in isolation. `chat-api` imports nothing from `libs/celebrations`, and this change edits only comments and markdown, so the failure is independent of it. Accepted by the user as out of scope.

## Workflow follow-up

- Archive with `/opsx:archive fix-celebration-docs-drift` after merge, so the four deltas sync into `openspec/specs/`. If S7 `00` archived first and touched `celebration-migration-portfolio` "New Year decisions", rebase that delta first.
- Follow-up change: `new-year-elf-fireworks` scene spec (stages, targets, fallbacks, budgets from `libs/celebrations/src/new-year/utils/elf-fireworks-*.ts`).
- Follow-up change: remove the unused `buildHalloweenWisps` and `HALLOWEEN_WISP_COUNT` from `libs/celebrations/src/halloween`.
- S7 `00`: the portfolio line "Click and secret pools SHALL stay unchanged" no longer matches `NEW_YEAR_CLICK_SCENES`.

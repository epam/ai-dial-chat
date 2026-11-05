Branch: `refactor/split-use-conversation-stream` (PR #9763, together with F5). Diagnostics were measured locally against the worktree's own lib sources and are confirmed by CI (design D2).

## 1. Guard first

- [x] 1.1 Add `tools/typecheck-targets.spec.mjs` (design D3) and the `typecheck:targets:test` script. Run it on the current tree and confirm that it fails and names `@epam/chat`. Result: it failed with "typecheck is disabled for: @epam/chat".

## 2. Enable

- [x] 2.1 Remove `"noEmit": true` from `apps/chat/tsconfig.spec.json`. `npm run typecheck:targets:test` passes, and `nx show project @epam/chat --json` shows a `tsc --build` typecheck command. Result: the guard passes; the command is `tsc --build --emitDeclarationOnly`. `nx sync:check` in a clean checkout reports the workspace up to date.
- [x] 2.2 Add `npm run typecheck:targets:test` as a step before "Typecheck all projects" in the `typecheck` job of `.github/workflows/pr.yml`.
- [x] 2.3 Push as a draft PR and collect the `@epam/chat` diagnostics from the CI `typecheck` job. If there are more than about 100, or any fix needs a behavior change, stop and report the list. Result: measured locally first. A temporary tsconfig extended the app and spec configs and mapped every `@epam/*` entry to the worktree's `@epam/source` files, so libs did not resolve through the junction. It reported 9 diagnostics in `apps/chat`, none needing a behavior change.

## 3. Fix

- [x] 3.1 Fix each `apps/chat` diagnostic, type-only, without suppression (design D2). Group commits by area. Fixed:
  - `useResourceSaveNotification` / `ResourceSavePanelContainer` (2 errors): `notifiableEntity` was the whole `NotifiableEntity` enum, so `notifyOperationSuccess` accepted no operation. It is now `SaveNotifiableEntity` — the catalog kinds except `Model`, which are exactly the entities its callers pass.
  - `Conversation.tsx` (1): the data source's `notFoundMessageKey` is an opaque `string`, so `t()` gets it with the page's own message as `defaultValue`. Output is unchanged for a valid key.
  - Test fixtures (4): `additionalContentLocales: []` in three client-config fixtures, `isUnread: false` in a project-conversation item.
  - `usePinnedProjectsPanel.spec.ts` (1): a cast to `{ onClick: () => void }` replaced by clicking a rendered button that forwards its React event, the pattern `CatalogView.spec.tsx` already uses.
  - `project-preview-test-helpers.tsx` (1): `resolvePdfContent` is typed with the resolver signature, so `mock.calls[0][0]` is typed.
  - `useResourceSaveNotification.spec.ts` (2, arrived with #9764 after rebasing onto it): `ApiErrorDetails` mocks now include the required `message: null`.
- [ ] 3.2 Re-run CI until the `typecheck` job passes.

## 4. Close

- [x] 4.1 Update `docs/architecture.md` "Typechecking and verification": the project counts (39 projects, 36 with `typecheck`) and one line on the guard and `noEmit`. Run `npm run validate:docs`.
- [x] 4.2 `npm run validate:specs` passes, and `nx run-many -t test lint -p @epam/chat` passes.
  Result: `validate:specs` 0 errors; `apps/chat` vitest 277 files / 4108 tests pass; eslint with the app config 0 errors (3 pre-existing warnings in untouched files).

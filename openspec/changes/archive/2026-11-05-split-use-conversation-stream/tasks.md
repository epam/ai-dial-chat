Slicing: one extraction per slice. After each slice, run the stream specs, `generation-resume.spec.ts` and the `apps/chat` caller specs (`pages/Conversation/tests/Conversation.spec.tsx`, `ConversationReloadConflict.spec.tsx`, `pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`), and ESLint for `libs/chat-hooks`. Branch: `refactor/split-use-conversation-stream`.

## 1. Baseline

- [x] 1.1 Record the line counts, the `it` count (116 in `useConversationStream.spec.ts`), the vitest test totals of the slice suites, the export list of both chat-hooks entry points, and the chat-hooks typecheck result on the clean tree.

## 2. Types and helpers

- [x] 2.1 `conversation-stream.types.ts` (design D1), with the re-export from `useConversationStream.ts`. Switch `generation-resume.ts` to import from it, and confirm the export lists are unchanged.
- [x] 2.2 `stream-errors.ts`: `resolveStreamErrorMessage`, `findResumedBackgroundGenerationId` and the constants.

## 3. State hooks

- [x] 3.1 `useStreamPathState.ts` (design D2).
- [x] 3.2 `useConversationReloadErrors.ts`
- [x] 3.3 `useStopGeneration.ts` (design D4).

## 4. Session

- [x] 4.1 `stream-session.ts`: `runStreamSession` and `StreamSessionContext` (design D3). `startStream` delegates to it with an unchanged dependency array.

## 5. Spec split

- [x] 5.1 `tests/conversation-stream-harness.ts`. Compare the duplicated `makeAttachStream` and `renderAndFail` copies before merging them (design D5). Result:
  - The three `makeAttachStream` copies were identical except that the first also returns `end()`. That superset now lives in the harness.
  - The two `renderAndFail` helpers turned out not to be duplicates. They differ in the conversation fixture and the parameters, so both stay local to their describes.

  `libs/chat-hooks/tsconfig.lib.json` now excludes `src/**/tests/**`, and `tsconfig.spec.json` includes `src/**/tests/**/*.ts`, following the `libs/celebrations` `test-utils` precedent. This keeps the harness out of the library build. `libs/chat-hooks/eslint.config.mjs` adds the same folders to `@nx/dependency-checks` `ignoredFiles`, so the harness's `vitest` import is not treated as a runtime dependency.
- [x] 5.2 Move the describes and direct `it`s into the seven concern files, then delete `tests/useConversationStream.spec.ts`. The `it` total must be 116 and the vitest totals must equal the baseline. Result:
  - The spec split into eight files rather than seven. `resumeIfAwaitingGeneration` and the lifecycle notifications went into `useConversationStream.lifecycle.spec.ts`, which keeps `.send.spec.ts` under about 1000 lines (981).
  - The largest file is `.unsaved-answers.spec.ts` at 1076 lines; it is a single top-level describe.
  - Vitest runs 140 tests across the eight files, the same 140 the single file ran.

## 6. Close

- [x] 6.1 Confirm the line counts against the proposal, a JSDoc summary on every new module, and that `generation-resume.ts` no longer imports `./useConversationStream`. Actual sizes:
  - `useConversationStream.ts`: 339 lines (was 1292);
  - `stream-session.ts`: 681;
  - `useStreamPathState.ts`: 184;
  - `useStopGeneration.ts`: 138;
  - `useConversationReloadErrors.ts`: 81;
  - `conversation-stream.types.ts`: 197;
  - `stream-errors.ts`: 62.
- [x] 6.2 `nx run-many -t test lint build typecheck -p @epam/ai-dial-chat-hooks` passes, pinned to the worktree and compared with the baseline. `validate:docs`, `validate:specs` and `validate:lib-duplicates` also pass. Results:
  - Tests: 232 files / 3495 tests pass. The build passes.
  - `tsc` on `tsconfig.lib.json` reports 27 errors before and after, none of them in this folder. On `tsconfig.spec.json`, no errors are in the new spec files.
  - The export lists of both entry points are identical before and after, checked with the TypeScript checker.
  - Lint shows `@nx/dependency-checks` "package is not used" errors from the junctioned worktree environment, the same as on the clean baseline.
  - The validators pass. `validate:docs` needed the re-export written as an explicit `export type { … }` list, because its export resolver does not read `export type * from`.
  Re-run in the main checkout, without the junctioned `node_modules`: `nx run @epam/ai-dial-chat-hooks:typecheck` with its 20 dependency tasks passes with no errors. Lint has 0 errors, and the build passes. The stream specs (212) and the caller specs (54) pass.

- [x] 6.3 Run `npm run verify:full` once. Waived locally: `verify:full` (typecheck + lint + tests on all projects) was covered by CI on PR #9772 head `98bec0c` — "Workspace lint and typecheck (all projects)" and "run_tests / test / code_checks" pass ([run](https://github.com/epam/ai-dial-chat/actions/runs/42120459208)).

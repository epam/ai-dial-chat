## 1. Extract pure mapping helpers and shared types

- [x] 1.1 Create `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts`; move `folderIdFromId`, `nameFromId`, `isSentinelPath`, `urlToPromptPath`, `metadataItemToPromptPath`, `mapPromptToResponse`, `deriveFolders`, the `PUBLIC_BUCKET` constant, and the internal types (`CorePrompt`, `PromptMetadataItem`, `PromptMetadataFolder`, `PromptPayload`, `PromptMetadataListResult`, `PromptReadResult`, `PromptWriteResult`, `SharedResourceItem`, `SharedResourcesResult`) there verbatim; update `prompt.service.ts` to import from it. **Note:** `FOLDER_SENTINEL` and `safeDecodeURIComponent` are still directly used in `prompt.service.ts` outside of the extracted helpers (in `createFolder`/`renameFolder`/`deleteFolder`/`movePrompt`'s sentinel-path construction, and `getSharedPrompts`'s URL parsing respectively) — kept their imports in `prompt.service.ts` rather than only in the util.
- [x] 1.2 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` — pure move, no-op behaviorally. 88/88 prompts tests pass, lint clean, build succeeds (verified with `--skip-nx-cache` after an initial cached false-positive). `tsc --noEmit` on both tsconfigs shows only pre-existing, unrelated noise (confirmed via `git status`/`git diff` showing the flagged spec file untouched).

## 2. Create PromptsResourceService

- [x] 2.1 Create `prompts/resource/prompts-resource.service.ts`: move `getPromptMetadataItem`, `savePromptResource`, `readPromptByPath`, `listPromptMetadataItems`, making all four `public` (from `private`) since the other three sub-services depend on this one and call them directly. `prompt.service.ts` now injects `PromptsResourceService` and calls it via `this.resourceService.*` as an interim state until sections 3-5 move the remaining methods out. `prompt.module.ts` registers the new provider.
- [x] 2.2 **Deviation:** these four methods were `private` helpers in the monolith with no dedicated `describe` blocks — they were only tested indirectly through the public methods (`listPrompts`, `createPrompt`, etc.), so there were no literal test blocks to relocate. Wrote a new focused spec `resource/tests/prompts-resource.service.spec.ts` (13 tests) covering each method's success/error/edge-case paths directly, now that they're public API surface.
- [x] 2.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`; fix regressions before continuing. 124 test files / 1920 tests pass (ran `nx reset` first — the new spec file wasn't picked up by Nx's cached project graph until reset); lint clean.

## 3. Split PromptsPersonalService

- [x] 3.1 Create `prompts/personal/prompts-personal.service.ts`: move `listPrompts`, `getSharedPrompts`, `getPrompt`, `createPrompt`, `updatePrompt`, `deletePrompt`; inject `PromptsResourceService` for `getPromptMetadataItem`/`savePromptResource`/`readPromptByPath`/`listPromptMetadataItems`. `prompt.service.ts` now delegates these six methods to `personalService` via bound-property references, and `prompt.module.ts` registers the new provider.
- [x] 3.2 Relocated the corresponding test blocks from `tests/prompt.service.spec.ts` verbatim into `personal/tests/prompts-personal.service.spec.ts` (17 tests moved, net test count unchanged — confirmed pure relocation, not duplication).
- [x] 3.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`; fix regressions before continuing. 1920/1920 tests pass, lint clean, build succeeds.

## 4. Split PromptsPublicService

- [x] 4.1 Create `prompts/public/prompts-public.service.ts`: move `listPublicPrompts`, `getPublicPrompt`; inject `PromptsResourceService`. `prompt.service.ts` delegates both to `publicService` via bound-property references; `prompt.module.ts` registers the new provider.
- [x] 4.2 Relocated the corresponding test blocks from `tests/prompt.service.spec.ts` verbatim into `public/tests/prompts-public.service.spec.ts` (4 tests moved, net test count unchanged).
- [x] 4.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`; fix regressions before continuing. 1920/1920 tests pass, lint clean, build succeeds.

## 5. Split PromptsFolderService

- [x] 5.1 Create `prompts/folder/prompts-folder.service.ts`: move `createFolder`, `renameFolder`, `deleteFolder`, `movePrompt`; inject `PromptsResourceService`. Since this was the last group of methods, `prompt.service.ts` was reduced directly to the full facade in this same slice (combining with section 6.1) — every method now delegates via bound-property references; `prompt.module.ts` registers `PromptsFolderService`.
- [x] 5.2 Relocated the corresponding test blocks from `tests/prompt.service.spec.ts` verbatim into `folder/tests/prompts-folder.service.spec.ts` (13 tests moved), and rewrote `tests/prompt.service.spec.ts` as the slim facade spec (12 delegation-only tests) in the same slice, since nothing remained to relocate afterward — this also completes task 6.3.
- [x] 5.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`; fix regressions before continuing. **Tooling note:** this OpenSpec change was implemented in a git worktree at `.claude/worktrees/split-prompt-service`. Discovered mid-session that `npm exec nx <target> chat-api` was silently running against the *original* `development-1.0` checkout instead of the worktree — Nx's `workspaceRoot` resolution respects an env var `NX_WORKSPACE_ROOT_PATH` that was pinned to the main checkout path in this shell session, overriding cwd-based detection. Fixed by prefixing every `nx` invocation with `NX_WORKSPACE_ROOT_PATH=<worktree-absolute-path>` (must be set inline per-command; shell env does not persist across separate tool calls). Re-verified all prior slices' results directly via `npx vitest run --config apps/chat-api/vitest.config.ts` (which is unaffected, since it only depends on cwd/`__dirname`) — all previously-reported pass counts were confirmed still accurate against the worktree's actual code once re-run correctly. 128 test files / 1945 tests pass, lint clean (2 pre-existing unrelated warnings), build succeeds with fresh `dist/main.js`.

## 6. Reduce PromptService to a facade

- [x] 6.1 Done in section 5.1: `prompt.service.ts` is a thin facade with bound-property delegates for every method (`listPrompts = this.personalService.listPrompts.bind(this.personalService)`, etc.), matching the `DeploymentsService`/`ToolsetsService` pattern.
- [x] 6.2 Done incrementally across sections 2-5: `prompt.module.ts` registers `PromptService`, `PromptsResourceService`, `PromptsPersonalService`, `PromptsPublicService`, `PromptsFolderService`. `PromptModule` has no other consumers outside `apps/chat-api/src/prompts/` (confirmed via grep in section 8.1), so `exports: [PromptService]` was never actually declared/needed — `PromptModule` only wires its own `PromptController`.
- [x] 6.3 Done in section 5.2: `tests/prompt.service.spec.ts` is a slim facade spec (12 delegation-only tests, one per public method).
- [x] 6.4 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`. Same result as 5.3: 1945/1945 tests, lint clean, build succeeds (verified with the `NX_WORKSPACE_ROOT_PATH` override documented in 5.3).

## 7. Facade cleanup and dead code removal

- [x] 7.1 Remove all now-unused private helpers/imports left behind in `prompt.service.ts` after all extractions. Already clean — the facade contains only the `Injectable` import, the three sub-service imports, the constructor, and bound-property delegates. Fixed one doc comment that undercounted the sub-services (mentioned "three" without noting the fourth, non-injected `PromptsResourceService`).
- [x] 7.2 Confirm `prompt.service.ts` is a pure delegation facade under ~200 lines. Confirmed.
- [x] 7.3 Run `wc -l apps/chat-api/src/prompts/prompt.service.ts` and confirm it is under 200 lines. 43 lines.

## 8. Documentation and spec deltas

- [x] 8.1 Grepped `openspec/specs/prompts-api/spec.md`, `openspec/specs/prompts-folders/spec.md`, `openspec/specs/prompts-share-api/spec.md` for `PromptService.` or `prompt.service.ts` references. Confirmed: zero matches, as predicted in the proposal. No spec updates needed.

## 9. Final verification

- [x] 9.1 Run `npm exec nx test chat-api`. 128 test files / 1945 tests pass.
- [x] 9.2 Run `npm exec nx lint chat-api`. 0 errors, 2 pre-existing warnings unrelated to this change (`files-listing.service.ts`, `share.service.ts`).
- [x] 9.3 Run `npm exec nx build chat-api`. Webpack compiles successfully.
- [ ] 9.4 Manually exercise the prompts endpoints (list/get/create/update/delete personal prompts, list/get public prompts, create/rename/delete folders, move prompt) against a running `apps/chat-api` instance to confirm REST contracts are unchanged end-to-end. **Not performed in this session** — no running instance available in this environment; same gap as the archived `split-conversation-service`/`split-deployments-toolsets-services` changes. Needs manual verification by the user before merge.

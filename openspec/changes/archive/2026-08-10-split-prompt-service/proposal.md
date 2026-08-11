## Why

`apps/chat-api/src/prompts/prompt.service.ts` (866 lines) is a god service mixing four responsibilities: low-level DIAL Core resource I/O shared by everything else (metadata lookup, save, read-by-path, paginated listing), personal prompt CRUD + listing (including cross-bucket shared-prompt resolution), organisation/public-bucket prompt reads, and folder operations (create/rename/delete/move). It was flagged in the local refactoring audit as the largest remaining backend god service after the `ConversationService` (archived `2026-08-07-split-conversation-service`) and `DeploymentsService`/`ToolsetsService` (archived `2026-08-07-split-deployments-toolsets-services`) splits. This follows the same facade + focused-sub-services pattern established by those two changes.

## What Changes

- Extract the shared low-level resource helpers (`getPromptMetadataItem`, `savePromptResource`, `readPromptByPath`, `listPromptMetadataItems`) into a new injectable `PromptsResourceService` — every other sub-service depends on it instead of duplicating DIAL Core resource I/O, since (unlike prior splits) these helpers need `DialClientService`/`Logger` and cannot be pure functions.
- Split the remaining behavior into `PromptsPersonalService` (`listPrompts`, `getSharedPrompts`, `getPrompt`, `createPrompt`, `updatePrompt`, `deletePrompt` — personal-bucket CRUD and shared-with-me resolution), `PromptsPublicService` (`listPublicPrompts`, `getPublicPrompt` — organisation/public-bucket reads), and `PromptsFolderService` (`createFolder`, `renameFolder`, `deleteFolder`, `movePrompt` — folder lifecycle and single-prompt moves), each injecting `PromptsResourceService`.
- Extract the module-level pure mapping/path helpers (`folderIdFromId`, `nameFromId`, `isSentinelPath`, `urlToPromptPath`, `metadataItemToPromptPath`, `mapPromptToResponse`, `deriveFolders`) plus the shared internal types (`PromptPayload`, `PromptMetadataListResult`, `PromptReadResult`, `PromptWriteResult`, `SharedResourceItem`, `SharedResourcesResult`) into a dedicated `utils/prompt-mapper.util.ts`, imported by whichever service needs them.
- Reduce `PromptService` to a thin facade delegating every public method to exactly one of the four services above (bound-property pattern for pure 1:1 forwards).
- Split `prompt.service.spec.ts` (762 lines) into per-sub-service spec files, plus a slim facade spec for cross-service delegation assertions.
- **Not BREAKING**: REST contracts, request/response shapes, status codes, and structured logging are unchanged — this is an internal refactor only. No frontend changes, no OpenAPI regeneration.

## Capabilities

### New Capabilities
- `prompts-service-decomposition`: ownership map of which service owns which prompts responsibility (shared resource I/O, personal CRUD, public/organisation reads, folder lifecycle, facade) and the equivalence contract guaranteeing behavior is preserved across the split.

### Modified Capabilities
- None. This is an implementation-detail refactor; existing capability specs (`prompts-api`, `prompts-folders`, `prompts-share-api`) do not reference `PromptService` by method name or file path, so no delta spec updates are needed there. Scenario-level requirements are unchanged.

## Impact

- **Code**: `apps/chat-api/src/prompts/` — new `resource/`, `personal/`, `public/`, `folder/`, `utils/` sub-folders; `prompt.service.ts` shrinks to a facade; `prompt.module.ts` registers the new providers.
- **Tests**: `tests/prompt.service.spec.ts` (762 lines, mirrors the current service) is split into per-sub-service spec files under matching `tests/` sub-folders; a slim facade spec remains for delegation checks.
- **Dependents**: none outside `apps/chat-api/src/prompts/` — `PromptService` is only injected by `PromptController`, which keeps calling the unchanged facade.
- **No impact**: frontend (`apps/chat`), OpenAPI spec/generated client, REST contracts, external callers.

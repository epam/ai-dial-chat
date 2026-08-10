## Context

DIAL Core has no distinct "copy" concept beyond `copyResource` (`POST /v1/ops/resource/copy`, `{ sourceUrl, destinationUrl, overwrite }`) and no distinct "cross-folder move" beyond the same `moveResource` (`POST /v1/ops/resource/move`) that `/rename` already uses. Both are already exposed on the injected SDK client (`this.client.copyResource` / `this.client.moveResource` — confirmed at `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts:7790,7845`), and `moveResource` is already wired into `FilesService.renameFileItem` (`apps/chat-api/src/files/files.service.ts:1126`).

The project already solved the "batch + optional folder expansion + partial failure" shape twice — `deleteFiles`/`deleteFolderItem` and `renameFiles`/`renameFolderItem`, both in `apps/chat-api/src/files/files.service.ts`. Both reuse `expandFolderContents` (paginated `recursive: true, limit: 1000`, following `nextToken`), run top-level batch items via `Promise.all`, and process a folder's expanded children **sequentially** in a `for` loop (no concurrency constant exists in the current code — the archived rename design doc's `RENAME_CONCURRENCY = 4` was never implemented; verified by grepping `files.service.ts` for `CONCURRENCY`). Copy and cross-folder move should follow the exact same shape rather than introducing a new pattern.

On the frontend, `useDialFileManager.onMoveToFiles` (`apps/chat/src/hooks/files/useDialFileManager.ts:1392`) currently ignores its `sourceFolder`/`destinationFolder` parameters and unconditionally calls `renameFiles()` — it was built rename-only because that was the only capability at the time. Checking the ui-kit contract directly (`getEntityDetails("component", "DialFileManager")` via the `ai-dial-ui-kit` MCP server) shows there is only **one** `onMoveToFiles` prop, documented as firing for "cut-paste or rename" — ui-kit does not expose a separate cross-folder-move callback. `onCopyFiles(items, destinationFolder)` is a distinct, already-defined prop for copy-paste.

There is no destination-folder-picker UI in this change (that is step 10 / `add-file-manager-select-folder-modal`). Copy and cross-folder move are reachable in this slice only through ui-kit's own clipboard affordances inside the grid/tree (copy/cut an item, navigate to another folder in the same manager instance, paste) — no new menu entry or picker modal is added here.

## Goals / Non-Goals

**Goals:**
- `POST /api/v1/files/copy` — batch copy (file or folder) via `copyResource`, folder case reusing `expandFolderContents`.
- `POST /api/v1/files/move` — batch cross-folder move via `moveResource`, same expansion strategy, kept as a **separate endpoint** from `/rename`.
- `useDialFileManager.onCopyFiles` wired to `/copy`.
- `useDialFileManager.onMoveToFiles` extended to dispatch same-folder calls to the existing `/rename` path (unchanged behavior) and cross-folder calls to the new `/move` path.
- An `OperationLoaderModal` shown during copy/move with a cancel affordance, modeled on the legacy component's visual shape (spinner + title + text + cancel) but rebuilt with current conventions (react-i18next, ui-kit `Spinner`/`DialPopup`, no Redux).
- Copy/Move rows added to the `my_files`-only, WRITE-gated action-label table alongside the existing Rename row.

**Non-Goals:**
- Destination-folder picker UI / `variant=folder-picker` (row #46, step 10 — `add-file-manager-select-folder-modal`).
- Same-folder duplicate (row #39, step 11 — `add-file-manager-duplicate`).
- `actionProfile=full` and the full standalone action matrix / dedicated Copy-Move-Duplicate menu entries that open a picker (row #45, step 12 — `add-file-manager-standalone-actions`).
- Cross-bucket copy/move (shared/organization tabs stay read-only or download-only; not addressed here).
- True server-propagated cancellation of in-flight DIAL Core calls (see D6).
- `overwrite: true` / replace-on-conflict (matches existing `/rename` decision).

## Decisions

### D1 — Two new endpoints, `/copy` and `/move`, both separate from `/rename`

**Decision**: `POST /api/v1/files/copy` and `POST /api/v1/files/move`.

**Rationale**: `/rename` already has a narrow, shipped contract (same-folder only, powers inline rename). Overloading it with a `mode` field or a `destinationFolder` that may differ from the source folder would silently change an existing endpoint's semantics and risk breaking the attach-modal and standalone inline-rename flows that depend on it today. A verb-per-operation naming scheme (`/delete`, `/rename`, `/download-archive`) is already established in `FilesController`; `/copy` and `/move` extend it consistently. `/move` (not `/move-to`) reads naturally as "move these items" and pairs with `/copy` the same way `moveResource`/`copyResource` pair in the SDK.

**Alternative considered**: a single `/move` endpoint with a `mode: 'rename' | 'move'` field routing to the same logic as today's `/rename` — rejected because it forces every existing `/rename` caller (attach modal, standalone inline rename) to add a field it doesn't need, for no behavioral gain; `moveResource` already handles both cases identically server-side, so splitting by endpoint name is purely a caller-ergonomics choice, and keeping `/rename` frozen minimizes risk to already-shipped behavior.

### D2 — POST over PUT/PATCH, same as delete/rename

**Decision**: `POST`, `@HttpCode(200)`, matching `/delete` and `/rename`. Batch body, not a single-resource path param.

### D3 — `onMoveToFiles` dispatches by folder equality; no new ui-kit-facing prop

**Decision**: Keep the single `onMoveToFiles(items, sourceFolder, destinationFolder)` hook callback (it already matches ui-kit's one prop for this purpose). Internally, partition `items` by whether each item's resolved source parent folder equals its destination parent folder:
- Same folder → existing rename path, unchanged: build `RenameItemDto[]`, call `renameFiles()`.
- Different folder → new path: build `MoveItemDto[]`, call `moveFiles()`.

A single `onMoveToFiles` invocation could in principle mix same-folder and cross-folder items (e.g. a multi-select cut spanning selections made in different folders before one paste) — split into two DTO batches and issue both calls; success/failure notifications are computed per batch and merged before rendering (still a single toast summarizing total failures, consistent with today's `onMoveToFiles` error handling).

**Rationale**: Confirmed via `getEntityDetails("component", "DialFileManager")` that ui-kit has exactly one callback for this interaction ("Callback fired when files cut-paste or rename"). Adding a second app-level prop is impossible — ui-kit does not call one. Branching inside the existing handler is the only option that doesn't require a ui-kit change.

**Alternative considered**: always treat `onMoveToFiles` calls as rename when `item.sourceUrl` and `item.destinationUrl` share the same parent, else move — this is exactly what "partition by folder equality" does; stated separately only to make explicit that the branch is computed from the ui-kit-supplied `DialCopiedItem.sourceUrl`/`destinationUrl` pair per item, not from the batch-level `sourceFolder`/`destinationFolder` params (which describe where the *interaction* started/ended, not necessarily every item's individual paths in a mixed selection).

### D4 — Folder copy/move: reuse `expandFolderContents`, one call per file, sequential per folder

**Decision**: `copyFolderItem`/`moveFolderItem` follow `renameFolderItem`'s exact shape (`apps/chat-api/src/files/files.service.ts:1170`):

```
{copy,move}FolderItem(bucket, srcPrefix, destPrefix, at):
  normalise srcPrefix/destPrefix to trailing "/"
  children ← expandFolderContents(bucket, srcPrefix, '', at)   // paginated, same helper
  for each child in children (sequential, not Promise.all):
    relative  = child.archivePath                               // relative to srcPrefix
    destChild = destPrefix + relative
    {copy,move}FileItem(bucket, child.path, destChild, at)       // one SDK call per file
  folder succeeds only if ALL children succeed; any failure ⇒ partial failure
```

Top-level batch items (multiple files/folders in one request) run in parallel via `Promise.all`, exactly matching `deleteFiles`/`renameFiles` today. No new concurrency constant is introduced — `RENAME_CONCURRENCY`-style throttling was proposed in the archived rename design doc but never implemented, so copy/move should not invent one either; if throttling turns out to be needed under load, it should be added to all three operations (delete/rename/copy/move) together in a follow-up, not introduced asymmetrically here.

**`.dial_folder` marker**: included in the expanded listing like any other file and copied/moved with the rest (same as rename).

### D5 — Batch HTTP semantics: 200 with per-item results, matching delete/rename

**Decision**: A structurally valid request (passes DTO validation) always returns `200` with `{ results: [{ sourcePath/destinationPath, success, error? }] }`. Endpoint-level HTTP errors (`400`/`401`/`429`) are reserved for validation, auth, and throttle failures — never for individual Core-side item failures. This exactly mirrors `RenameFilesResponseDto`/`DeleteFilesResponseDto`.

**Error mapping** (mirrors `getRenameErrorMessage`, `apps/chat-api/src/files/files.service.ts:111`):

| DIAL Core response | `error` string |
|---|---|
| 409 Conflict | `"Conflict"` |
| 403 Forbidden | `"Forbidden"` |
| 404 (source) | `"Not found"` |
| other | `"Copy failed"` / `"Move failed"` |

Folder-level partial failure uses `"Partial copy"` / `"Partial move"` (parallel to `"Partial rename"`).

### D6 — Rate limit: 10/min for both, matching rename/delete

**Decision**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` on both `/copy` and `/move` — same rationale as rename: a single request can fan out into many Core calls for a large folder.

### D7 — Cancel is frontend-abort-only; no server-propagated cancellation

**Decision**: `OperationLoaderModal`'s cancel button aborts the in-flight `fetch` from the browser (`AbortController` passed to the generated client call) and immediately hides the modal and clears `isCopying`/`isMoving`. It does **not** cancel work already dispatched from `FilesService` to DIAL Core — the BFF has no per-batch cancellation channel today (no request ID threading, no upstream `AbortSignal` wired from the Nest request to the SDK calls beyond the existing per-call timeout). Cancelling mid-batch may leave a folder partially copied/moved; on cancel, the hook still triggers a `retry()`/cache-invalidation on next mount so the user sees actual state, but no error toast is shown for the aborted call itself.

**Rationale**: Implementing true server-side cancellation would require threading a cancellation token through `FilesService`'s per-child loop and is a materially larger change (new request-lifecycle plumbing shared with delete/rename) that the #7503 scope does not ask for. Overpromising "cancel" as fully stopping server work would be misleading; documenting the frontend-only scope here avoids that.

**Alternative considered**: disable the cancel button entirely — rejected because even a frontend-only abort has real value (stops the tab from waiting on/retrying a huge batch, frees the UI immediately) and matches user expectation from the legacy `OperationLoaderModal`, which also only aborted client-side (Redux thunk cancellation, no Core-side cancellation either).

### D8 — Generated-client impact

- `filesControllerCopyFiles` → `filesApi.copyFiles({ copyFilesDto })`, `filesControllerMoveFiles` → `filesApi.moveFiles({ moveFilesDto })` (handler names `copyFiles`/`moveFiles` become the SDK method names via `operationIdFactory`, matching `renameFiles`).
- Request DTOs: `CopyFilesDto`/`MoveFilesDto` (each wrapping `CopyItemDto[]`/`MoveItemDto[]`, structurally identical to `RenameItemDto` — `bucket`, `sourcePath`, `destinationPath`, `nodeType`, `name`).
- Response DTOs: `CopyFilesResponseDto`/`MoveFilesResponseDto` (each wrapping `CopyItemResultDto[]`/`MoveItemResultDto[]`, structurally identical to `RenameItemResultDto`).
- Frontend callers use the normal (non-`Raw`) generated methods — no headers/status needed beyond the parsed JSON body, same as `renameFiles`.
- `apps/chat/src/server-api/files.api.ts` gains `copyFiles(items: CopyItemDto[])` / `moveFiles(items: MoveItemDto[])`, following the exact shape of the existing `renameFiles` wrapper.

### D9 — OperationLoaderModal is a new component, not a shared-state overlay

**Decision**: `OperationLoaderModal` lives at `apps/chat/src/components/DialFileManagerModal/OperationLoaderModal.tsx` (co-located with the existing `UploadProgressModal` it's structurally closest to) and is rendered by `DialFileManagerShell` exactly like `UploadProgressModal` — driven by `isCopying`/`isMoving` state and a `cancelCopyMove` callback returned from the hook, not by a new shared "any operation in progress" overlay (that unification is out of scope — tracked separately, matching the #7505 unified-overlay item referenced in the roadmap). It reuses ui-kit's `Spinner`/`DialPopup`, not the legacy local `Spinner` component that no longer exists on this branch.

**Rationale**: `UploadProgressModal` is the closest existing pattern for "long-running batch operation with per-item state and a cancel button" already reviewed and shipped in this codebase; reusing its shape (not its code — upload tracks per-file progress, copy/move only needs an aggregate count) keeps the new component small and consistent.

### D10 — NestJS conventions

All backend implementation follows `apps/chat-api/AGENTS.md` as source of truth (URI versioning, thin controllers, `Logger` + `ConfigService`, validated DTOs with allowlist `@Matches`/`@IsValidFilePath`, typed HTTP exceptions).

## Risks / Trade-offs

**Large folder fan-out** → Copying/moving a folder with thousands of files issues one Core call per file, sequentially within that folder. At the existing (unthrottled-within-batch) pattern, a very large folder copy is slow. Mitigation: same as rename — rate limit bounds repeated abuse, structured logging records `batchSize`/`successCount`/`failedCount` and elapsed time for diagnosis; a progress indicator beyond an indeterminate spinner is out of scope here.

**Mixed same-folder/cross-folder `onMoveToFiles` batches** → Splitting one ui-kit callback invocation into two DTO batches (D3) means a single user action can partially succeed as "renamed" and partially succeed/fail as "moved," which is harder to summarize in one toast. Mitigation: compute one merged failure count across both batches for the notification; log which items went to which endpoint for support/debugging.

**No server-side cancellation (D7)** → A "cancelled" copy/move may still be running on the BFF/Core side after the modal closes, and will complete before the user's next retry. Mitigation: documented explicitly in D7; hook still invalidates cache and re-fetches so eventual state is reflected, even though it might race with the still-in-flight cancelled request. No data loss — worst case is a copy/move that "looks cancelled" but actually completed.

**DIAL Core lacks folder-level copy/move** → Same non-atomicity risk as rename: a mid-flight failure leaves a folder partially duplicated (copy) or split across old/new location (move). Mitigation: identical to rename — partial-failure result, refresh, no rollback, since DIAL Core has no transactional multi-resource operation to roll back with.

## Migration Plan

1. Add `CopyItemDto`/`CopyFilesDto`/`CopyItemResultDto`/`CopyFilesResponseDto` and `MoveItemDto`/`MoveFilesDto`/`MoveItemResultDto`/`MoveFilesResponseDto` (mirroring `rename-files.dto.ts`).
2. Add `copyFiles`/`copyItem`/`copyFileItem`/`copyFolderItem` and `moveFiles`/`moveItem`/`moveFileItem`/`moveFolderItem` to `FilesService`, reusing `expandFolderContents`.
3. Add `POST /api/v1/files/copy` and `POST /api/v1/files/move` routes to `FilesController`.
4. Run `npm run openapi` to regenerate `libs/chat-api-client`; add `copyFiles`/`moveFiles` wrappers to `apps/chat/src/server-api/files.api.ts`.
5. Extend `useDialFileManager`: add `onCopyFiles`, extend `onMoveToFiles` per D3, add `isCopying`/`isMoving`/`cancelCopyMove` state.
6. Add `OperationLoaderModal` component; wire into `DialFileManagerShell`.
7. Extend `DialFileManagerShellLabels` (Copy/Move labels, operation-loader copy) and the shell's `actionLabels` mapping.
8. Add i18n keys (`en.json` + `DialFileManagerI18nKeys` enum) and confirm RTL is a no-op (ui-kit-owned grid/tree chrome; the new modal reuses `DialPopup`/`Spinner` logical layout, same as `UploadProgressModal`).
9. Update `file-manager-tabs` capability spec (Copy/Move rows).

**Rollback**: remove the two new controller routes and revert the hook/shell changes. No DB or storage migration; DIAL Core resources already copied/moved are not reverted (matches rename/delete rollback posture — this change only adds a transport, it doesn't alter existing data on rollback).

## Open Questions

- **Folder copy/move ordering**: as with rename, does DIAL Core require any specific ordering for `copyResource`/`moveResource` when the destination folder doesn't exist yet as a virtual entity? Current design moves/copies in listing order (arbitrary), matching rename's unresolved open question — verify against a real DIAL Core deployment before shipping if folder-copy/move behavior differs from rename in practice.
- **Mixed-batch UX**: is a single merged toast sufficient for a batch that is part-rename/part-move (D3), or should the UI eventually distinguish "renamed" vs "moved" in the same notification? Deferred until real usage data or design feedback surfaces a need.

## Context

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`, 2482 lines) is the single hook backing both the attach-modal and standalone `/files` page surfaces. It composes ~35 pieces of `useState`/`useRef` state and ~25 `useCallback`/`useMemo` derivations across six concerns: folder listing/tree/search, upload batches, folder creation, CRUD mutations (delete/rename/copy/move/download), sharing (share/unshare/revoke), and single-file metadata. All six concerns share three cross-cutting pieces of state: `bucket`/`rootLabel`/`activeTab` (inputs), the per-folder `cache: Map<string, ListFilesItemDto[]>` + `listingPermissionsCache`, and `retryCounter` (a shared invalidation signal every mutation bumps to force the listing effect to refetch).

`DialFileManagerShell.tsx` (635 lines) already consumes `UseDialFileManagerResult` as a flat prop bag and independently builds ui-kit `*Options` objects (`gridOptions`, `treeOptions`, `toolbarOptions`, `bulkActionsToolbarOptions`, `destinationFolderPopupOptions`, `fileMetadataPopupOptions`) via its own `useMemo` calls — the composer hook does **not** build these option bags itself, correcting the assumption in the originating request. This means Shell's contract is exactly `UseDialFileManagerOptions` in / `UseDialFileManagerResult` out; the refactor only has to preserve that one interface.

Backend precedent: `2026-07-16-split-files-service` decomposed the NestJS `FilesService` god-service into per-concern services behind a thin facade. This change mirrors that same shape on the frontend — a thin composer plus focused sub-hooks — but the concrete boundary lines differ because frontend concerns are keyed by *cache/UI state*, not by REST resource.

## Goals / Non-Goals

**Goals:**

- Split state and logic ownership across five sub-hooks (`useDialFileListing`, `useDialFileUploadBatch`, `useDialFileMutations`, `useDialFileSharing`, `useDialFileMetadata`) plus pure-function `*.util.ts` modules, so no single file mixes more than one concern.
- Keep `useDialFileManager`'s public `UseDialFileManagerOptions` / `UseDialFileManagerResult` byte-for-byte identical — same field names, same semantics — so `DialFileManagerShell`, `DialFileManagerModal`, `DialFileManagerPage`, and existing tests need zero changes.
- Preserve every existing behavior: tab-aware fetch/cache invalidation, search debounce, upload concurrency/abort, copy/rename-as-move disambiguation (D3), sharing/unshare/revoke, and the `isAnyOperationInProgress` aggregate flag's exact inclusion/exclusion list.
- Reduce composer size to <250 lines and cap each sub-hook file at ~450 lines (excluding tests).
- Split the 4017-line spec file by concern with no loss of assertion coverage.

**Non-Goals:**

- Changing `DialFileManagerShell`'s UI structure, ui-kit component APIs, or any visual/interaction behavior.
- Any backend or `@epam/chat-api-client` change.
- Rewriting or merging `useDialFileManagerState` (a separate, already-thin hook used by `NewConversationComposer`).
- Migrating `ConversationView`'s inline attach-modal state to `useDialFileManagerState` — tracked as an optional follow-up task only if it falls out with zero added risk; otherwise a separate change.
- New i18n keys, new e2e tests, or new user-facing functionality of any kind.

## Decisions

### D1 — Shared cache/invalidation state lives in `useDialFileListing`; sibling hooks invalidate through a callback, not shared `useState`

`cache`, `listingPermissionsCache`, `folderPath`, `retryCounter`, and `sharedRootMetaRef` all belong to listing/navigation. Mutation, upload, and sharing hooks need to invalidate specific cache keys and trigger a refetch after they succeed. Rather than lifting cache state to the composer (which would re-inflate it into a god-object) or duplicating cache state per hook (which would desync), `useDialFileListing` exposes a narrow imperative surface — `invalidateFolders(apiPaths: string[])` and `bumpRetry()` — that the other four hooks call after their own async work settles. The composer wires `useDialFileListing`'s output into the other hooks' inputs.

- **Alternative considered:** Lift `cache`/`retryCounter` to the composer and pass setters down to every sub-hook. Rejected — it re-creates a shared-mutable-state god-object at the composer level, defeating the point of the split, and forces the composer itself to know cache-key formats.
- **Alternative considered:** Give every sub-hook its own cache. Rejected — the existing behavior relies on one cache shared across listing, mutations, and popups (e.g. `onFolderPopupPathChange` reads/writes the same cache the grid listing effect populates); duplicating it would diverge behavior.

### D2 — `bucket`, `rootLabel`, `activeTab`, `variant`/`actionProfile` stay as plain parameters threaded into every sub-hook

These five values are true cross-cutting inputs (not derived state) already passed into `useDialFileManager`. Each sub-hook takes them as direct parameters (not via Context), matching the existing project convention that only long-lived cross-page state uses Context, while page/feature-local composition uses parameter passing between co-located hooks (see `useFavicon`/`ThemeContext` split in `openspec/config.yaml`).

### D3 — Sub-hooks keep their own `server-api/files.api` imports; no shared "files repository" hook

Each sub-hook imports exactly the `files.api` functions its concern needs (e.g. `useDialFileMutations` imports `deleteFiles`/`renameFiles`/`copyFiles`/`moveFiles`/`downloadFile`/`downloadArchive`; `useDialFileSharing` imports `shareFiles`/`discardShared`/`revokeAccess`/`listSharedByMe`). This matches the "Server-api boundary" note in the source request and keeps each hook's dependency list self-documenting instead of introducing an intermediate repository abstraction that isn't otherwise used in this codebase.

- **Alternative considered:** A single `useDialFilesApi` wrapper hook re-exporting all `files.api` functions. Rejected — it would be a pure re-export with no behavior, adding an indirection layer for no benefit (violates the "no premature abstraction" guideline).

### D4 — i18n stays in each sub-hook that needs translated strings; no `useDialFileManagerLabels` extraction

The source request flagged i18n ownership as a design decision. Auditing actual `t(...)` call sites: they are not concentrated in one place needing extraction — they're inherent to whichever concern produces the user-facing message (upload failure toast, delete confirmation, rename validation error, share error, etc.). Each sub-hook calls `useTranslation()` itself and owns only the keys its own concern needs (e.g. `useDialFileMutations` owns `ItemDeletedSuccessfully`/`RenameError`/`CopyError`/etc.; `useDialFileListing` owns `FolderLoadError`; `useDialFileSharing` owns `UnshareError`/`RemoveAccessError`). The composer's `actionLabels`/`visibleColumns`/`dateLocale`/`disabledNewButtonTooltip` derivations (tab- and actionProfile-dependent UI labels, not concern-specific) are the one piece that stays in the composer, since they read `activeTab`/`actionProfile`/`uploadEnabled` — outputs of multiple sub-hooks — and don't belong to any single sub-hook.

- **Alternative considered:** Introduce a `useDialFileManagerLabels` hook to centralize all `t(...)` calls. Rejected after auditing the call sites — they're not one cohesive "labels" concern, they're scattered notification/validation messages that belong with their owning logic; centralizing them would separate a handler from the message it produces, hurting readability without reducing line count in any single owning hook.

### D5 — Composer merges `isAnyOperationInProgress` and derived tab/action UI state, nothing else

The composer's only remaining logic is: call the five sub-hooks in sequence, thread `useDialFileListing`'s cache-invalidation callbacks into the other four, and combine outputs into the flat `UseDialFileManagerResult` object — including `visibleColumns`, `actionLabels`, `uploadEnabled`, `isNewButtonDisabled`, `disabledNewButtonTooltip`, and `isAnyOperationInProgress`, all of which read flags from more than one sub-hook and have no other natural owner.

### D6 — Extraction order follows dependency direction, not file size

Tasks extract `useDialFileListing` first (all other hooks depend on its cache-invalidation callbacks), then upload, then mutations, then sharing, then metadata (independent, smallest, safest to save for last risk-wise but could go anytime). Utils/types are extracted before any hook, since hooks import them.

## Risks / Trade-offs

- **[Risk] A missed dependency in a `useCallback`/`useMemo` array during extraction silently changes memoization or introduces a stale-closure bug** (e.g. `onDeleteFiles` currently closes over `folderPath` for the "was the current folder deleted" check). → Mitigation: extract one hook per task-list slice, run `npm exec nx test chat` after each slice, and keep the relocated spec's assertions verbatim so behavior regressions surface as failing tests, not silent drift.
- **[Risk] Cache invalidation ordering changes** — today every mutation calls `setCache`/`setListingPermissionsCache` then `setRetryCounter(c => c + 1)` inline; splitting this across a callback boundary could reorder these relative to the listing effect's own state updates. → Mitigation: `invalidateFolders`/`bumpRetry` must perform the exact same two `setState` calls in the exact same order the monolith does today; verify via the relocated cache-invalidation test assertions in each mutation's spec.
- **[Risk] The shared `sharedRootMetaRef` (owner-bucket resolution for the Shared tab) is read by listing, upload, mutations, and sharing hooks alike.** Splitting ownership incorrectly could leave one hook resolving against a stale ref. → Mitigation: `sharedRootMetaRef` and `resolveOwnerCoords` stay owned by `useDialFileListing` (it's the only hook that populates the ref from a listing fetch); it's returned/exposed as a stable ref object (not copied) to the other sub-hooks, exactly as `useRef` values are today.
- **[Risk] Spec-file split loses coverage or duplicates setup boilerplate.** → Mitigation: relocate `describe` blocks verbatim per task-list slice (no assertion rewrites unless a hook's constructor signature actually changed), and diff total assertion count before/after each slice.
- **[Trade-off] Five sub-hooks plus a composer is more files to navigate than one file**, but each file is independently testable and under the size threshold that made the monolith hard to review — accepted per the proposal's stated goal.

## Migration Plan

Implementation proceeds in the incremental slices defined in `tasks.md` (utils/types → listing → upload → mutations → sharing → metadata → slim composer → delete dead code), each gated by `npm exec nx test chat`. No deployment or data migration is involved — this is a same-behavior internal refactor shipped as a normal PR series. Rollback is a standard git revert of any slice if `nx test chat`/`nx build chat` regress; because `UseDialFileManagerOptions`/`UseDialFileManagerResult` never change shape mid-series, each slice is independently revertable without breaking consumers.

## Open Questions

- Whether the optional `ConversationView` → `useDialFileManagerState` migration (source request's item 1.6) should be folded into this change's final task or filed as its own change — deferred to `tasks.md`, default is a separate change unless implementation reveals it's trivial.

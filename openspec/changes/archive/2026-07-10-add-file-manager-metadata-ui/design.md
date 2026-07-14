## Context

The installed `@epam/ai-dial-ui-kit@0.12.0-dev.25`'s `FileMetadataPopupOptions` (`node_modules/@epam/ai-dial-ui-kit/dist/src/components/FileManager/FileManager.d.ts:25-35`) is:

```ts
export interface FileMetadataPopupOptions {
  fileMetadata?: DialFile;
  loading?: boolean;
  clearMetadata?: () => void;
  header?: ReactNode;
  nameLabel?: string;
  pathLabel?: string;
  modifiedDateLabel?: string;
  sizeLabel?: string;
  authorLabel?: string;
}
```

**Correction (superseding an earlier draft of this document)**: an earlier pass claimed no label fields exist on this type — that was checked against a different point in the ui-kit's history and is factually wrong for the version actually installed. The compiled bundle (`node_modules/@epam/ai-dial-ui-kit/dist/index-7pZX5DCZ.js`) confirms each label prop defaults to a hardcoded English string (`header = "Information"`, `nameLabel = "Name:"`, `pathLabel = "Path:"`, `modifiedDateLabel = "Modified Date:"`, `sizeLabel = "Size:"`, `authorLabel = "Author:"`) when the host omits it — i.e. the popup works with zero label props, but the host **does** have a lever to override them. This matches the legacy Redux `useFileManager`'s `fileMetadataPopupOptions` (`origin/development`, lines 855-879) more closely than previously believed, and this repo's i18n-coverage expectation (all user-facing text goes through `t()`) means this slice now wires those six label props through i18n rather than leaving them as ui-kit's hardcoded English defaults. See D5.

`onGetInfo(file: DialFile): void | Promise<void>` and `DialFileManagerActions.Info` exist. Checking `GridOptions.actionLabels`, `FileTreeOptions.actionLabels`, and `BulkActionsToolbarOptions.actionLabels` in the installed `.d.ts` shows `Info` is present **only** in `GridOptions.actionLabels` — it has no tree or bulk-toolbar surface. This matches `onGetInfo`'s single-`DialFile` signature (no array/batch variant) and confirms Info is inherently a single-row, grid-only action.

The current metadata endpoint (`apps/chat-api/src/files/dto/get-file-metadata.dto.ts`, confirmed unchanged by `add-file-manager-metadata-ui`) validates `path` with `@Matches(/[^/]$/, { message: 'path must not end with /' })` — a folder path (which this codebase always represents with a trailing `/`) is rejected by the BFF today. Legacy's `handleGetInfo` (`origin/development`, `useFileManager.tsx:1351-1357`) dispatched `getFileMetadata({ fileId: item.path })` unconditionally from the frontend, but that only shows the frontend didn't gate on `nodeType` — it says nothing about whether the legacy *backend* actually returned meaningful data for a folder path, and that legacy backend is not available to test against. This design does not assume legacy supported folder metadata; it treats folder metadata as genuinely out of scope given the current, confirmed BFF constraint.

`useDialFileManager` already resolves bucket/path per active tab for other single-item operations (`onDownloadFiles`, `onDeleteFiles`): current user's bucket on `my_files`; for `shared`, root-level shared items carry their owner's bucket already embedded in their normalized `path`/`url` (from `listSharedFiles`'s response), while nested items under a shared folder resolve their owner bucket via the existing `sharedRootMetaRef`/`resolveOwnerCoords` internal helper (confirmed present in `useDialFileManager.ts` by the codebase-verification pass for this proposal); `organization` items resolve against the public bucket. `onGetInfo` reuses this exact resolution, not a new one.

## Goals / Non-Goals

**Goals:**
- `useDialFileManager.onGetInfo(file)` resolves bucket/path per the existing per-tab pattern and calls the existing `getFileMetadata` wrapper.
- `fileMetadataPopupOptions` wired with `{ fileMetadata, loading, clearMetadata }` plus the six ui-kit label props (`header`, `nameLabel`, `pathLabel`, `modifiedDateLabel`, `sizeLabel`, `authorLabel`), each sourced from a new i18n key so the popup respects the active locale instead of ui-kit's hardcoded English defaults.
- `Info` visible in the grid (only) for file rows (not folders) across all three tabs, gated on `actionProfile === Full`.

**Non-Goals:**
- Folder metadata — would require changing `GetFileMetadataQueryDto`'s trailing-slash rejection and deciding what "folder metadata" even means for Core (aggregate size? item count?), which is a BFF design question this slice does not open. `Info` is simply absent for `nodeType === folder` rows.
- Extending metadata to the `Attach`/`Browse` profiles — `Info` is `Full`-only, consistent with Share/Unshare/Remove access from `add-file-manager-sharing`.
- New BFF endpoint, DTO, or generated-client change of any kind.

## Decisions

### D1 — Reuse the existing `getFileMetadata` wrapper as-is; no backend change

**Decision**: `onGetInfo` calls `apps/chat/src/server-api/files.api.ts`'s existing `getFileMetadata({ bucket, path }): Promise<FileMetadataResponseDto>` unchanged.

**Rationale**: the endpoint, DTO, and generated client already fully cover this slice's data need (name, size, type, author, permissions, dates — all present on `FileMetadataResponseDto`). Per the `api-design` skill and `openspec/config.yaml` scope-discipline rule, a slice must not touch backend code it doesn't need to; this one doesn't.

### D2 — `fileMetadata`/`loading`/`clearMetadata` state lives in the hook, not a new context

**Decision**: `useDialFileManager` owns `fileMetadata: DialFile | undefined` and `isFileMetadataLoading: boolean` as plain hook state (matching how `isCopying`/`isDeleting`/etc. are already owned). `onGetInfo(file)` sets loading, resolves bucket/path, calls `getFileMetadata`, maps the `FileMetadataResponseDto` response into a `DialFile`-shaped object (reusing whatever normalization helper the hook already applies to listing responses, so the popup receives the same shape as any other `DialFile`), and clears loading. `clearMetadata()` resets both fields to `undefined`/`false` and is passed straight through as `fileMetadataPopupOptions.clearMetadata` — ui-kit calls it when the popup closes.

**Rationale**: matches the existing per-action state pattern in this hook family; no new context needed since only `DialFileManagerShell` (a single consumer) needs this state.

### D3 — Info is grid-only, file-only, all three tabs, `Full`-profile-only

**Decision**: `gridOptions.actionLabels` includes `DialFileManagerActions.Info` when `row.nodeType !== folder` and `actionProfile === Full`, on **all three tabs** (`my_files`, `shared`, `organization`) — unlike Copy/Move/Duplicate/Delete/Rename, Info is read-only and carries no write-permission risk, so it is not additionally gated on `uploadEnabled`/WRITE permission. `treeOptions.actionLabels` and `bulkActionsToolbarOptions.actionLabels` never include `Info` (no ui-kit surface for it there, per Context).

**Rationale**: viewing metadata is safe on any tab a user can already browse (including read-only `shared`/`organization` tabs), and the ui-kit contract itself only exposes Info on the grid, so there's no tree/bulk variant to design.

### D4 — Per-tab bucket/path resolution reuses the existing helper, not a new one

**Decision**: `onGetInfo`'s bucket/path resolution calls the same resolution function `onDownloadFiles` already uses per tab (current user bucket on `my_files`; the item's own normalized bucket for root-level `shared` items; `sharedRootMetaRef`/`resolveOwnerCoords` for nested `shared` folder children; the public bucket for `organization`). No new resolution logic is written for this slice.

**Rationale**: this exact bucket/path resolution problem (mapping a `DialFile` row on any of the three tabs to the Core-addressable `{ bucket, path }` pair) is already solved once in this hook; duplicating it for a second single-item action would violate scope discipline and risk the two resolutions drifting apart.

### D5 — Popup labels are wired through i18n, not left as ui-kit's hardcoded English defaults

**Decision**: `DialFileManagerShell` passes `header`, `nameLabel`, `pathLabel`, `modifiedDateLabel`, `sizeLabel`, and `authorLabel` on `fileMetadataPopupOptions`, each sourced from a new `DialFileManagerShellLabels` field (`metadataHeader`, `metadataNameLabel`, `metadataPathLabel`, `metadataModifiedDateLabel`, `metadataSizeLabel`, `metadataAuthorLabel`) that both `DialFileManagerPage` and `DialFileManagerModal` resolve via `t()` against six new `DialFileManagerI18nKeys` members / `en.json` keys.

**Rationale**: the installed ui-kit's `FileMetadataPopupOptions` (see corrected Context) exposes these as optional overrides with hardcoded-English fallbacks. This repo's i18n-coverage rule (`.claude/rules/all-ts.md`) requires user-facing text to go through `t()`; leaving these six strings on ui-kit's English defaults would mean the metadata popup silently ignores the active locale (including RTL locales, since these are plain label strings with no directional concerns beyond normal text). Since the lever now demonstrably exists, using it is the correct scope, not a deferred nice-to-have.

## Risks / Trade-offs

**No folder metadata (D3/Non-Goals)** → a user browsing `my_files` cannot get size/date/permission info for a folder, only files. Mitigation: documented as an explicit, scoped-out gap; revisit only if product feedback asks for it, at which point it is a BFF-contract change (relaxing/branching `GetFileMetadataQueryDto`'s trailing-slash rule), not a frontend-only follow-up.

## Migration Plan

1. Add `fileMetadata`/`isFileMetadataLoading` state, `onGetInfo`, and `clearMetadata` to `useDialFileManager`.
2. Wire `fileMetadataPopupOptions={{ fileMetadata, loading: isFileMetadataLoading, clearMetadata, header, nameLabel, pathLabel, modifiedDateLabel, sizeLabel, authorLabel }}` and `onGetInfo` through `DialFileManagerShell` to the underlying `DialFileManager`.
3. Extend the shell's `gridOptions.actionLabels` computation to include `DialFileManagerActions.Info` for file rows when `actionProfile === Full`, on all three tabs — never `treeOptions`/`bulkActionsToolbarOptions`.
4. Add the `Info` action-label i18n key (`dialFileManager.infoAction`) plus the six metadata-popup label keys to `en.json` + `DialFileManagerI18nKeys`.
5. Update `file-manager-tabs` capability spec (Info row).

**Rollback**: revert the hook/shell changes. No BFF, DTO, or generated-client changes to roll back.

## Open Questions

- **Folder metadata**: is there product demand to show folder-level info (item count, aggregate size)? If so, scope a follow-up change that relaxes `GetFileMetadataQueryDto`'s path validation and decides what folder metadata Core can actually provide (Core's resource metadata endpoint is file-oriented; a folder "metadata" would likely need to be computed from a listing, not a single Core call).

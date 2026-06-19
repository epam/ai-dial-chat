## Context

`DialFileManagerModal` is the new file picker used in `ConversationRoute` and `ConversationView`. It wraps `DialFileManager` from `@epam/ai-dial-ui-kit` and provides upload, folder creation, and download via `useDialFileManager`. The Attach button currently calls `onAttach(selectedFiles)` with zero safety checks.

The legacy `FileManagerModal` (Redux-based, `apps/chat/src/components/Files/FileManagerModal.tsx`) enforced MIME filtering, file-size caps, attachment count limits, and hidden-path guards through a combination of grid `isRowSelectable`, a `getDisabledTooltip` callback, and an `handleAttachFiles` handler. The feature now needs to be replicated in the new modal without any Redux dependency.

Key file-system metadata already available in each `FileManagerGridRow`:
- `nodeType`: `DialFileNodeType.ITEM` | `DialFileNodeType.FOLDER`
- `contentType`: MIME string (present for files, absent for folders)
- `contentLength`: byte size (present for files)
- `path`: full DIAL storage path (e.g., `files/bucket/.dial_folder`, `files/bucket/hidden-dir/.dial_folder`)

Existing utilities:
- `isMimeTypeAllowed(mimeType, allowedTypes)` in `apps/chat/src/utils/attachment-mime.ts` — supports wildcards, returns `true` when `allowedTypes` is empty.
- `mimeTypesToExtensionLabels(types)` — human-readable label from MIME array.
- `HIDDEN_FILE = '.dial_folder'` in `libs/chat-shared/src/constants/dial.ts`.

`maximumAttachmentsAmount` maps to DIAL Core's `max_input_attachments` field on `DeploymentData` (snake_case from Jackson `@JsonNaming(SnakeCaseStrategy.class)`). It is currently absent from the BFF mapping chain: `RawDeploymentDto` → `DeploymentItemDto` → `chat-shared DeploymentItem`. This change adds it across all three layers.

`maxSelectableFileSize` is **not** in the DIAL Core API. The value is a frontend constant: **512 MB** (`512 * 1024 * 1024` bytes), matching the legacy modal's default. It is hardcoded in `apps/chat/src/constants/` and passed as a fixed prop to the modal whenever `inputAttachmentTypes` is non-empty (i.e., when the deployment accepts attachments at all).

## Goals / Non-Goals

**Goals:**
- Propagate `max_input_attachments` from DIAL Core through the BFF stack (`RawDeploymentDto` → `DeploymentItemDto` → `DeploymentItem` in chat-shared) so the frontend has the max attachment count.
- Add MIME filtering, 512 MB file-size cap, attachment-count limit, and hidden-path guard to `DialFileManagerModal`.
- Add an informational header description (allowed types / max size / max count).
- Add disabled-row tooltips for hidden paths.
- Add folder-row selectability when `canAttachFolders` is `true`, with parent-folder dedup.
- Extend `onAttach` to carry folder paths alongside files.
- Wire constraints at both call sites (ConversationRoute, ConversationView) from the active deployment.
- No regression to upload, download, folder-creation flows from `add-file-manager-transfer-actions`.

**Non-Goals:**
- Tabs, rename, delete, move/copy, share, search, upload-archive, standalone File Manager page.
- `maxSelectableFileSize` from DIAL Core (not exposed; frontend constant 512 MB).
- `canAttachFolders` from DIAL Core (not exposed; prop defaults to `false`, folder attach enabled manually via prop when the deployment model supports it).

## Decisions

### Decision 1 — Validation logic lives in `DialFileManagerModal`, not in hooks or call sites

**Rationale:** The legacy modal co-located selection rules with the modal component. Putting validation in the modal keeps the call sites thin: they pass constraints as props and let the modal decide what to do. Moving it into a hook (e.g., `useDialFileManagerState`) would force both call sites to duplicate the error-toast logic and couple the hook to `showNotification`.

Alternative considered: validate in `handleAttach` in each call site (ConversationRoute, ConversationView). Rejected — duplicates logic across two call sites.

### Decision 2 — `isHiddenPath` helper goes in `apps/chat/src/utils/` (not in a lib)

**Rationale:** Hidden-path logic depends on `HIDDEN_FILE` from `chat-shared`. But the implementation (string contains check) is trivially shareable as a pure utility in the app. A lib cannot import app-level details; the reverse is fine. If a second app ever needs it, it can be promoted to `libs/chat-shared`.

```ts
// apps/chat/src/utils/file-path.ts  (or add to existing file utils)
import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';

export const isHiddenPath = (path: string): boolean =>
  path.includes(HIDDEN_FILE);
```

### Decision 3 — `onAttach` extended to `AttachResult` union type

**Rationale:** Keeping `onAttach: (files: DialFile[]) => void` and adding a separate `onAttachFolders` callback would force all call sites to wire two handlers and combine results. Extending the shape to `{ files: DialFile[]; folderPaths: string[] }` is cleanest.

```ts
export interface AttachResult {
  files: DialFile[];
  folderPaths: string[];
}
```

`useDialFileManagerState.handleAttach` updated to accept `AttachResult`; `dialFilesToAttachments` remains files-only (folder paths are passed separately for now as the conversation model decides how to represent folder attachments).

Alternative: always pass `(files: DialFile[], folderPaths: string[])` as two arguments. Rejected — harder to add future fields.

### Decision 4 — Parent-folder dedup is a simple string-prefix check

When `canAttachFolders` is `true` and a folder is selected, any selected file or nested folder whose path starts with that folder path is excluded from the final result. This matches legacy `isParentFolderSelected` semantics. The dedup runs inside `handleAttach` in `DialFileManagerModal`.

### Decision 5 — Toast strategy uses `showNotification` from `NotificationContext`

The legacy modal used Redux `UIActions.showToast`. The current app uses `showNotification` from `useNotification()`. Since `DialFileManagerModal` is an app-level component, it may call `useNotification()` directly.

For "unsupported files skipped" (info): shown after Attach click, modal closes with valid files. This matches the legacy behavior (skips silently and shows a toast, doesn't block the user).

For "too many files" (error): shown after Attach click, **modal stays open** and selection is not consumed. This is a blocking error.

### Decision 6 — `maxInputAttachments` from DIAL Core; `maxSelectableFileSize` is a frontend constant

**`maxInputAttachments`** (`max_input_attachments` in JSON) is added to the BFF mapping chain:
1. `RawDeploymentDto.max_input_attachments?: number`
2. `DeploymentItemDto.maxInputAttachments?: number` (with `@ApiPropertyOptional`)
3. `mapToDeploymentItem` maps `raw.max_input_attachments` to `maxInputAttachments`
4. `DeploymentItem` in `libs/chat-shared/src/models/deployment.ts` gains `maxInputAttachments?: number`

Call sites read it from the active deployment and pass it to the modal as `maximumAttachmentsAmount`. When absent (deployment did not specify a limit), the modal allows any count.

**`maxSelectableFileSize`** is a hardcoded constant `MAX_SELECTABLE_FILE_SIZE_BYTES = 512 * 1024 * 1024` in `apps/chat/src/constants/files.ts` (or an existing constants file). It is always passed to the modal when `inputAttachmentTypes` is non-empty. When a deployment accepts no attachments the modal is not shown, so the constant is irrelevant.

Alternative considered for `maxSelectableFileSize`: make it a prop defaulting to `undefined` (no limit). Rejected — there is no source for a custom value today, and 512 MB matches the legacy behaviour exactly.

### Decision 7 — `allowedTypes` propagated from deployment's `inputAttachmentTypes`

Both `ConversationRoute` and `ConversationView` already compute `inputAttachmentTypes` from the active deployment. They now pass it to `DialFileManagerModal` as `allowedTypes`. When the array is empty the modal allows all file types (no restriction), matching `isMimeTypeAllowed` semantics.

## Risks / Trade-offs

**[Risk] `contentType` may be `undefined` for some grid rows (e.g., placeholder rows, virtual folder entries)** → Mitigation: treat missing `contentType` as "unknown"; treat unknown type as allowed (fail open). The legacy modal did the same.

**[Risk] `path` field in `FileManagerGridRow` may differ from the DIAL storage path used by `isHiddenPath`** → Mitigation: verify that `row.path` uses the same format as DIAL Core listing paths (the existing `useDialFileManager` already filters `.dial_folder` from listed items; if paths are normalised, the hidden check will work). Add a note to the implementation task to verify against a real DIAL instance.

**[Risk] Folder dedup via string-prefix may be imprecise for paths that share a prefix but are not nested** → Mitigation: always append a trailing `/` to folder paths before prefix-checking (e.g., `folderPath + '/'`) so `files/bucket/foo/` does not match `files/bucket/foobar/`.

**[Risk] `canAttachFolders` is always `false` for now (no deployment model field)** → Mitigation: prop defaults to `false`, rendering no change in current behavior. Folder attach is additive and gated by the prop.

**[Risk] `useDialFileManagerState.handleAttach` shape change breaks ConversationView's inline state** → Mitigation: `ConversationView` uses its own inline state (not `useDialFileManagerState`). Update its `handleAttachDialFiles` callback independently. Both call sites are in scope for this change.

## Migration Plan

This change is purely additive on the API surface. Existing call sites continue to work because all new props are optional. The `onAttach` shape change from `DialFile[]` to `AttachResult` is a **BREAKING** internal change — both call sites must be updated in the same PR as the modal. There is no external consumer of the modal.

Rollback: revert the PR. The BFF change (`max_input_attachments` pass-through) is additive and non-breaking — existing clients receive an extra optional field.

## Open Questions

1. ~~Does DIAL Core expose `maximumAttachmentsAmount` and `maxSelectableFileSize`?~~ **Resolved:** `max_input_attachments` is in `DeploymentData`; `maxSelectableFileSize` is a 512 MB frontend constant.

2. ~~Does the product want folder attach in v1 of this PR?~~ **Resolved:** Yes, folder attach is in scope for v1.

3. **Should hidden files already excluded from the listing by `useDialFileManager` also be excluded from selection?** The file manager currently shows hidden items only when "show hidden files" toggle is on. When visible, can the user select them? Legacy answer: no — hidden paths were not selectable regardless of visibility. This spec mirrors legacy. **Current:** okay.

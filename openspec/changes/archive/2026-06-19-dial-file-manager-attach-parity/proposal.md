## Why

`DialFileManagerModal` — the new DIAL file picker — ships without the attach safety rules that the legacy `FileManagerModal` enforced: no MIME-type filtering, no per-file size cap, no attachment-count limit, no hidden-path guard, and no folder-attach capability. This means users can attach files the model will reject and bypass limits that are enforced at send time, creating a confusing experience. Now that upload, download, and folder-creation (the "transfer actions") are implemented, completing the parity story is unblocked.

## What Changes

- `DialFileManagerModal` gains new optional props for allowed MIME types, max file size, max attachment count, and folder-attach enablement — mirroring the legacy modal's interface.
- The grid's `isRowSelectable` predicate is extended to skip hidden paths (`.dial_folder` marker files and items inside hidden folders), files with disallowed MIME types, and files that exceed the size cap.
- A `getDisabledTooltip` callback is wired into `DialFileManager` so disabled rows show an explanatory tooltip (e.g., "Attaching hidden files is not allowed").
- The Attach click handler validates the final selection: skips hidden and MIME-invalid files (with an info toast), and blocks the operation with an error toast if the count exceeds `maximumAttachmentsAmount`.
- The modal header gains a description line showing supported types, the max file size, and the "up to N files" limit when applicable.
- When `canAttachFolders` is `true`, folder rows become selectable; `onAttach` returns both files and folder paths, with parent-folder dedup (a selected nested item is omitted when its parent folder is also selected).
- Both call sites — `ConversationRoute` and `ConversationView` — are updated to pass attachment constraints sourced from the active deployment's configuration.
- `useDialFileManagerState.handleAttach` is updated to accept mixed file + folder results.
- New i18n keys are added to `en.json` / `translation-keys.ts`.

## Capabilities

### New Capabilities

- `dial-file-manager-attach-validation`: Row-level selectability rules (hidden paths, MIME type, file size) and Attach-time validation (skip invalid, count guard, info/error toasts).
- `dial-file-manager-attach-ui`: Header description block (supported types / max size / max count) and disabled-row tooltips.
- `dial-file-manager-attach-folders`: Folder-row selectability when `canAttachFolders` is enabled; `onAttach` result type extended to include folder paths with parent dedup.

### Modified Capabilities

- `dial-file-system-picker`: `onAttach` callback shape extended from `DialFile[]` to `{ files: DialFile[]; folderPaths: string[] }` when folder attach is enabled (delta spec for the onAttach contract change and the new props added to the modal).

## Impact

**Files touched (expected):**
- `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` — new props, extended grid options, header description, attach handler, tooltip callback
- `apps/chat/src/hooks/files/useDialFileManagerState.ts` — `handleAttach` extended for folder paths
- `apps/chat/src/utils/dial-file-to-attachment.ts` — possibly extended for folder paths
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — pass constraints to modal
- `apps/chat/src/components/ConversationView/ConversationView.tsx` — pass constraints to modal
- `apps/chat/src/i18n/locales/en.json` — new i18n keys (see table below)
- `apps/chat/src/constants/translation-keys.ts` — new `DialFileManagerI18nKeys` entries
- `libs/chat-shared/src/` — hidden-path helper (`isHiddenPath`) if not already present

**No backend changes required.** Hidden-path detection uses `contentType`, `contentLength`, and `path` already present in listing metadata. Attachment constraints (`inputAttachmentTypes`) are already on the deployment model; `maximumAttachmentsAmount` and `maxSelectableFileSize` will be sourced from the same model if the DIAL Core API exposes them, otherwise passed as caller-controlled props (investigation required — see Open Questions).

**i18n impact:**

| Key | Location | Description |
|-----|----------|-------------|
| `DialFileManager.UnsupportedFilesSkipped` | `DialFileManagerI18nKeys` | Toast title: some files skipped due to type |
| `DialFileManager.UnsupportedFilesDescription` | `DialFileManagerI18nKeys` | Toast body: "N file(s) with unsupported type were skipped" |
| `DialFileManager.TooManyFilesSelected` | `DialFileManagerI18nKeys` | Toast title: too many attachments |
| `DialFileManager.TooManyFilesDescription` | `DialFileManagerI18nKeys` | Toast body: "You selected {{count}} files, limit is {{limit}}" |
| `DialFileManager.AttachingHiddenFilesNotAllowed` | `DialFileManagerI18nKeys` | Disabled-row tooltip for hidden paths |
| `DialFileManager.MaxSizeSupportedTypes` | `DialFileManagerI18nKeys` | Header description: "Up to {{maxSize}}, supported: {{types}}" |
| `DialFileManager.UpToFiles` | `DialFileManagerI18nKeys` | Header description suffix: "up to {{count}} files" |

**Dependency:** Builds on `add-file-manager-transfer-actions` (upload, create-folder, download already implemented in `useDialFileManager` + BFF). Do not regress those code paths.

## Why

`DialFileManagerModal.tsx` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, 809 lines) is a monolith: `DialPopup` chrome, the attach footer, and ~600 lines of file-browsing wiring (grid/tree/toolbar option-bag assembly, upload progress modal, error/retry panel) are interleaved in one component. Issue #7502 requires a standalone `/file-manager` page that reuses the same BFF-backed browsing/CRUD behavior (`useDialFileManager`, `apps/chat/src/hooks/files/useDialFileManager.ts`) without the attach footer or attach-only selection constraints. Building the standalone page against the current modal would force copy-pasting the option-bag assembly and overlay JSX, duplicating ~600 lines and creating two places to fix the same bug. Extracting a host-agnostic `DialFileManagerShell` now — before the standalone page exists — means the modal and the future page both consume one implementation of the browsing/CRUD surface.

## What Changes

- Add `variant?: 'attach' | 'standalone' | 'folder-picker'` (default `'attach'`) and `actionProfile?: 'attach' | 'browse' | 'full'` (default derived from `variant`) to `UseDialFileManagerOptions` in `apps/chat/src/hooks/files/useDialFileManager.ts`. `'folder-picker'`/`'full'` are enum members only in this change — no behavior or UI is built for them (reserved for a later change, #7503).
- Add a mount-time load path: when `variant === 'standalone'`, the hook triggers its initial listing fetch on mount the same way it already does for `variant: 'attach'` today (the existing load effect at `useDialFileManager.ts:634-672` already fires on mount because `folderPath` starts at `''` — this change documents and tests that behavior explicitly for the new variant rather than changing the effect's mechanics).
- Extract `DialFileManagerShell` (new: `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`) that owns: the `DialFileManager` (ui-kit) prop assembly (grid/tree/toolbar/bulk option bags, search props, per-tab empty states, `autoSelectUploadedItems`, forbidden-symbols wiring), the `UploadProgressModal`, the download-loading overlay, and the error/retry panel. The shell does not own `DialPopup`, the attach footer, or attach-only props (`allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, `onAttach`) — those stay host-owned per variant.
- Refactor `DialFileManagerModal` into a thin wrapper: `DialPopup` + header/description + `DialFileManagerShell` (`variant="attach"`) + attach footer. Same public `Props` surface, same behavior — **no user-visible regression**.
- **BREAKING (internal only)**: `DialFileManagerModal`'s internal JSX structure changes; no exported API changes, so callers (`ConversationView`, `ConversationRoute`) require no edits.

## Capabilities

### New Capabilities

- `file-manager-shell`: contract for `DialFileManagerShell` — props, the operation overlays it renders, and how `variant`/`actionProfile` on `useDialFileManager` shape its behavior.

### Modified Capabilities

None. This is a behavior-preserving refactor: every requirement in the 14 existing specs that name `DialFileManagerModal` (`dial-file-manager-attach-ui`, `dial-file-manager-attach-folders`, `dial-file-manager-attach-validation`, `file-manager-attach-modal-polish`, `file-manager-delete-ui`, `file-manager-filename-sanitization`, `file-manager-folder-creation`, `file-manager-rename-ui`, `file-manager-search`, `file-manager-tabs`, `file-manager-tree-state`, `file-manager-upload`, `file-manager-upload-conflicts`, `dial-file-system-picker`) continues to hold verbatim after the refactor — only which component file implements them changes. Task list includes a documentation-only pass to update component-name mentions in those spec files so they stay accurate (no requirement text changes).

## Impact

- **Code**: `apps/chat/src/hooks/files/useDialFileManager.ts` (new options, mount-effect test coverage), `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` (shrinks to a thin wrapper), new `apps/chat/src/components/DialFileManagerShell/` (component + `tests/`).
- **Tests**: `DialFileManagerModal.spec.tsx` must keep passing unchanged in behavior; new `DialFileManagerShell.spec.tsx`; new `useDialFileManager` unit tests for `variant` default and standalone mount-fetch.
- **Docs**: 14 existing `openspec/specs/*/spec.md` files get a non-behavioral component-name update (see Modified Capabilities).
- **No** new routes, no new BFF endpoints, no `libs/*` changes (shell stays in `apps/chat`, per library isolation — it needs i18n/notification wiring that is host-owned).
- **Rollback**: revert is a single-commit revert (no schema/API changes, no persisted data format changes); the modal's external prop surface is unchanged so no caller-side rollback is needed.

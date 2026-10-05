# file-manager-duplicate Specification

## Purpose

The Duplicate action on writable files and folders, dispatched through the existing copy handler.

## Requirements

### Requirement: Duplicate action available on my_files with WRITE

`DialFileManagerActions.Duplicate` SHALL appear in the grid, tree, and bulk-actions-toolbar `actionLabels` for the `my_files` tab only, when the current folder has WRITE permission (`uploadEnabled === true`) and the file manager's action profile allows it (`isCopyMoveDuplicateAllowed(resolvedActionProfile)`: true for `DialFileManagerActionProfile.Browse` and `Full`, false for `Attach`). Copy and Move share exactly this gating; Rename requires only `uploadEnabled` and is not profile-gated. The labels are built in `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`.

#### Scenario: my_files with WRITE shows Duplicate

- **WHEN** the active tab is `my_files` and the current folder has WRITE permission
- **THEN** `actionLabels` includes `DialFileManagerActions.Duplicate`

#### Scenario: my_files without WRITE hides Duplicate

- **WHEN** the active tab is `my_files` and the current folder does NOT have WRITE permission
- **THEN** `actionLabels` does NOT include `DialFileManagerActions.Duplicate`

#### Scenario: Attach profile hides Duplicate

- **WHEN** the file manager runs with `DialFileManagerActionProfile.Attach` (the attach picker) on `my_files` with WRITE permission
- **THEN** `actionLabels` does NOT include `DialFileManagerActions.Duplicate`, `Copy`, or `Move`, but still includes `Rename`

#### Scenario: Shared and Organization tabs hide Duplicate

- **WHEN** the active tab is `shared` or `organization`
- **THEN** `actionLabels` does NOT include `DialFileManagerActions.Duplicate`

---

### Requirement: Duplicate is dispatched through the existing onCopyFiles callback

Triggering the Duplicate action SHALL be handled entirely by `@epam/ai-dial-react-file-manager`'s internal `DialFileManager` logic, which computes a same-folder destination and a collision-free name, then calls the app's existing `onCopyFiles(items, destinationFolder)` callback (already wired per [file-manager-copy-move](../../../specs/file-manager-copy-move/spec.md)). This capability SHALL NOT introduce a separate `onDuplicate` callback or a distinct BFF request path — duplicated items flow through the same `POST /api/v1/files/copy` endpoint as an ordinary same-folder copy.

**State ownership**: no new state is introduced in `useDialFileManager` / `useDialFileMutations`; `isCopying` (from `file-manager-copy-move`) covers the in-flight state for a duplicate the same way it covers an ordinary copy.

#### Scenario: Duplicating a file calls onCopyFiles with a same-folder destination

- **WHEN** the user triggers Duplicate on a single file
- **THEN** `onCopyFiles` is called with one item whose destination folder equals its source folder and whose destination name differs from the source name

#### Scenario: Duplicate reuses the copy BFF endpoint

- **WHEN** a duplicate action completes
- **THEN** the request observed by the BFF is indistinguishable in shape from an ordinary `POST /api/v1/files/copy` request — no `duplicate` flag or separate route is involved

---

### Requirement: Naming collision avoidance is ui-kit-owned

The destination name for a duplicated file or folder SHALL be computed by `@epam/ai-dial-react-file-manager` against the destination folder's already-loaded listing, using the pattern `"{base} ({n}){ext}"` for files (extension preserved, `n` starting at 1 and incrementing until unused) and `"{name} ({n})"` for folders. This app SHALL NOT implement or duplicate this naming logic.

#### Scenario: First duplicate of a file gets "(1)" suffix

- **WHEN** `report.pdf` exists and has no `report (1).pdf` sibling, and the user duplicates it
- **THEN** the resulting destination name is `report (1).pdf`

#### Scenario: Repeated duplicate increments the suffix

- **WHEN** both `report.pdf` and `report (1).pdf` already exist, and the user duplicates `report.pdf` again
- **THEN** the resulting destination name is `report (2).pdf`

#### Scenario: Folder duplicate uses the folder naming pattern

- **WHEN** the user duplicates a folder named `drafts`
- **THEN** the resulting destination name is `drafts (1)` (no extension handling applied)

#### Scenario: Multi-select duplicate avoids collisions within the batch

- **WHEN** the user selects two files that would otherwise resolve to the same candidate name and duplicates them together
- **THEN** the two duplicated items receive distinct incremented names (e.g. `report (1).pdf` and `report (2).pdf`), not the same name

---

### Requirement: Folder duplicate is enabled

`isDuplicateFolderAvailable` SHALL be left at its ui-kit default (`true`) — this app's `POST /api/v1/files/copy` endpoint already supports recursive folder copy (`file-manager-copy-move`'s folder-expansion algorithm), so duplicating a folder is a supported, unrestricted operation on `my_files`.

#### Scenario: Folders can be duplicated

- **WHEN** the user has WRITE permission on `my_files` and selects a folder
- **THEN** the Duplicate action is available for that folder

---

### Requirement: onCopyFiles handles a same-folder destination correctly

`onCopyFiles` (implemented in `libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts` and re-exported by `useDialFileManager`) SHALL process a request where `destinationFolder` equals the items' source folder (the duplicate case) through the same request, cache-invalidation, and error/partial-failure path as cross-folder copy in `file-manager-copy-move`. The only special case is the success kind: when every item's destination parent equals its source parent, `onCopyFiles` emits `onOperationSuccess` with `FileOperationKind.FileDuplicated` (one success) or `FileOperationKind.FilesDuplicated` (several) instead of `FileCopied`/`FilesCopied`. The app adapter (`apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`) maps these to dedicated duplicate toasts: `FileDuplicatedSuccessfully` / `FolderDuplicatedSuccessfully` / `ItemsDuplicatedSuccessfully` titles with `DuplicatedToSameFolder` / `ItemsDuplicatedToSameFolder` messages.

#### Scenario: Same-folder copy invalidates the single affected folder once

- **WHEN** `onCopyFiles` is called with items whose source and destination folder are identical
- **THEN** the folder's cache entry is invalidated and `retryCounter` increments, exactly once for that folder key

#### Scenario: Same-folder copy success shows a duplicate notification

- **WHEN** a duplicate (same-folder copy) of a single file succeeds
- **THEN** `onOperationSuccess` receives `kind: FileOperationKind.FileDuplicated` with the duplicated destination name, and the app shows the `FileDuplicatedSuccessfully` toast instead of the copy toast

#### Scenario: Same-folder copy failure surfaces the existing error toast

- **WHEN** a duplicate (same-folder copy) fails
- **THEN** the same error/partial-failure notification behavior specified in `file-manager-copy-move` for `onCopyFiles` applies unchanged

---

### Requirement: i18n key for the Duplicate action label

The Duplicate action label SHALL reuse the shared `ButtonsI18nKeys.Duplicate` (`buttons.duplicate`) key in `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`. This capability SHALL NOT introduce a separate `dialFileManager.duplicateAction` key — the conversation-duplicate and file-manager-duplicate features already use the identical English word "Duplicate" for this action, so a single shared key keeps them consistent instead of drifting into two copies of the same translation.

#### Scenario: Duplicate action label is translated

- **WHEN** the Duplicate action is rendered in the grid, tree, or bulk toolbar
- **THEN** its label is produced via `t(ButtonsI18nKeys.Duplicate)`, never a raw string literal or a dedicated `dialFileManager.duplicateAction` key

---

### Requirement: No feature-flag gating

Duplicate SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with Copy, Move, Rename, and Delete, which ship unconditionally to users with the relevant DIAL Core permissions.

#### Scenario: Duplicate is available without a feature flag

- **WHEN** a user with WRITE permission uses the file manager on `my_files`
- **THEN** the Duplicate action is available without checking any `ENABLED_FEATURES` entry

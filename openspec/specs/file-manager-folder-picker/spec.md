# file-manager-folder-picker Specification

## Purpose

The destination-folder side panel opened from the Copy and Move actions.

## Requirements

### Requirement: Destination-folder panel opens from Copy/Move actions

Clicking a `DialFileManagerActions.Copy` or `.Move` action (grid row menu, tree row menu, or bulk actions toolbar — wherever the action is present per `file-manager-tabs`) SHALL open an end-edge destination panel: `FolderDestinationPanel` from `@epam/ai-dial-react-file-manager`, rendered by `FileManagerDestinationPanel` (`libs/chat-shared/src/file-manager/FileManagerDestinationPanel/FileManagerDestinationPanel.tsx`).

`DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`, `@epam/ai-dial-chat-shared/file-manager`) SHALL pass `onDestinationRequest` to `DialFileManager`, keep the received `DialDestinationRequest` in state, and render the panel while it is set; it SHALL NOT pass `destinationPanelOptions`, which the package ignores once `onDestinationRequest` is set, nor `destinationFolderPopupOptions`. The built-in panel is not used because, with several sections enabled, it shows a virtual "All files" root and disables folder creation everywhere.

The panel SHALL show only the section the items come from: the root in `controller.items` whose first path segment matches the request's `sourceFolder`, or the first root when none matches. Its tree lists that root's folders; the committed destination starts at the source folder. `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` is a thin wrapper that passes the `useDialFileManager` result to the shell as `controller`.

Choosing or expanding a folder SHALL load its contents through `controller.onFolderPopupPathChange`; folders whose contents are not loaded keep `children` undefined so the tree does not show them as empty, and `controller.folderPopupLoadingPaths` marks the folders being fetched. Folder creation SHALL call `controller.onCreateFolder` with the new folder's full virtual path.

The panel SHALL use `FolderDestinationLayout.Inline`: one view with the affected items, the "Copy to folder" / "Move to folder" heading, the folder search and the folder tree, and a Cancel / Copy-or-Move footer. There is no separate destination row with a Change action and no Select step; picking a folder in the tree is the destination. Every affected item is listed in the summary row with its file or folder icon (`FileName` from `@epam/ai-dial-ui-kit`), in a scrollable list when there are many.

Confirming SHALL call `request.confirm(destinationFolder, destinationItems)` with the loaded items of the destination folder, so name conflicts are detected, and close the panel. Closing without confirming SHALL call `request.cancel()`.

#### Scenario: Copy action opens the panel in copy mode

- **WHEN** the user triggers the Copy action on one or more items
- **THEN** the destination panel opens over the file manager, showing the folder tree already loaded for the active tab

#### Scenario: Move action opens the panel in move mode

- **WHEN** the user triggers the Move action on one or more items
- **THEN** the destination panel opens in move mode over the same folder tree

---

### Requirement: Panel confirm dispatches to the already-wired copy/move handlers

Confirming a destination in the panel SHALL run name-conflict resolution and then invoke the same `onCopyFiles(items, destinationFolder)` / `onMoveToFiles(items, sourceFolder, destinationFolder)` callbacks already wired on `DialFileManagerShell` per [file-manager-copy-move](../file-manager-copy-move/spec.md) — no new callback prop is introduced by this capability.

#### Scenario: Confirming copy destination calls onCopyFiles

- **WHEN** the user selects a destination folder in copy mode and confirms
- **THEN** `onCopyFiles` is called with the copied items and the selected destination folder, and the BFF `/copy` flow proceeds exactly as specified in `file-manager-copy-move`

#### Scenario: Confirming move destination calls onMoveToFiles

- **WHEN** the user selects a destination folder in move mode and confirms
- **THEN** `onMoveToFiles` is called with the moved items, the source folder, and the selected destination folder, and (per `file-manager-copy-move`'s folder-equality partition) the cross-folder `/move` flow proceeds since the destination differs from the source

---

### Requirement: Panel text is translated via i18n

`DialFileManagerShell` SHALL give `FileManagerDestinationPanel` a `FileManagerDestinationPanelLabels` object (`libs/chat-shared/src/file-manager/labels.ts`) built from its host-supplied `labels` (`DialFileManagerShellLabels`):

| Panel label | Shell label |
| --- | --- |
| `getCopyTitle` | `getCopyDestinationTitle` |
| `getMoveTitle` | `getMoveDestinationTitle` |
| `copyHeading` | `copyDestinationHeading` |
| `moveHeading` | `moveDestinationHeading` |
| `copyButtonLabel` | `copyDestinationButton` |
| `moveButtonLabel` | `moveDestinationButton` |
| `sourceFolderTooltip` | `moveSourceDisabledTooltip` |
| `movedIntoItselfTooltip` | `movedIntoItselfTooltip` |
| `addFolderLabel` | `addFolderLabel` |

The shell calls no `useTranslation`; the hosts (`DialFileManagerPage`, `DialFileManagerModal`) resolve every label with `t()` and an enum key. Panel text not listed above (search placeholder, folder-name errors, retry) keeps the package's English default until a label is added.

#### Scenario: Panel shows translated button label

- **WHEN** the panel opens in copy mode
- **THEN** its primary button displays `t(ButtonsI18nKeys.Copy)`, and `t(ButtonsI18nKeys.Move)` in move mode

#### Scenario: Panel title follows the mode and the items

- **WHEN** the panel opens to move one file, one folder, or 3 items
- **THEN** its title is `t(DialFileManagerI18nKeys.MoveFileTitle)`, `MoveFolderTitle`, or `MoveItemsTitle` with `{ count: 3 }`

---

### Requirement: Copy and Move disable unusable destinations

For Move, `FileManagerDestinationPanel` SHALL give `getDisabledReason` a reason for the folder the items start from (`moveSourceDisabledTooltip`) and, for a moved folder, that folder and its subfolders (`movedIntoItselfTooltip`); a disabled destination disables the Move button. Copy has no disabled destinations. The BFF rejects an invalid move as a fallback (see `file-manager-copy-move`).

#### Scenario: Move disables the source folder

- **WHEN** the user moves items that all live in `/My files/reports/`
- **THEN** that folder cannot be chosen as the destination, and the translated `moveSourceDisabledTooltip` explains why

#### Scenario: Move disables the moved folder and its subfolders

- **WHEN** the user moves the folder `/My files/reports/` and picks it or a folder inside it
- **THEN** Move is unavailable, with the translated `movedIntoItselfTooltip` shown

---

### Requirement: Panel lists folders and keeps files for conflict detection

The panel's tree lists folders only. The application SHALL keep the browsed listings, files included, in the `DialFileManager.items` tree so the copy/move conflict resolver can detect destination-name collisions. Folders whose contents are not yet loaded are loaded when the user expands or selects them, as described above.

#### Scenario: Loaded destination can trigger conflict resolution

- **WHEN** the listing of `/My files/Folder1/` has loaded and contains `requirements.txt`
- **AND** the user confirms copying or moving an item named `requirements.txt` there
- **THEN** the conflict resolver shows the Replace/Duplicate decision before the copy/move handler runs

---

### Requirement: Add-folder inside the panel

The panel offers folder creation through `controller.onCreateFolder`, the callback already passed to the outer `DialFileManager`; no separate override is introduced. Name checks are the package panel's own. The button label is `addFolderLabel`.

#### Scenario: Add folder creates inside the chosen parent

- **WHEN** the user creates a folder under a node of the panel's tree
- **THEN** the folder is created inside that node, not inside the outer grid's current folder

---

### Requirement: i18n keys for the destination panel

The following keys SHALL exist in `apps/chat/src/i18n/locales/en.json` with matching members in `DialFileManagerI18nKeys` (`apps/chat/src/constants/i18n-keys/dial-file-manager.ts`):

| Key | English value |
| --- | --- |
| `dialFileManager.folderPickerAddFolderLabel` | `Add folder` |
| `dialFileManager.copyFileTitle` | `Copy file` |
| `dialFileManager.copyFolderTitle` | `Copy folder` |
| `dialFileManager.copyItemsTitle` | `Copy {{count}} items` |
| `dialFileManager.moveFileTitle` | `Move file` |
| `dialFileManager.moveFolderTitle` | `Move folder` |
| `dialFileManager.moveItemsTitle` | `Move {{count}} items` |
| `dialFileManager.copyDestinationHeading` | `Copy to folder` |
| `dialFileManager.moveDestinationHeading` | `Move to folder` |
| `dialFileManager.moveSourceDisabledTooltip` | `Unavailable for the original location. Please select another folder` |
| `dialFileManager.movedIntoItselfTooltip` | `A folder can't be moved into itself or its subfolders` |

The panel's buttons reuse `buttons.copy` (`Copy`) and `buttons.move` (`Move`). No raw string literal keys are passed to `t()` anywhere in this capability.

#### Scenario: All panel strings resolve through the enum

- **WHEN** any of the strings above is rendered
- **THEN** it is produced via `t(DialFileManagerI18nKeys.<Member>)`, never a raw string literal

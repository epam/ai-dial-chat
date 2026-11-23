# file-manager-folder-picker Specification

## Purpose

The destination-folder side panel opened from the Copy and Move actions.

## Requirements

### Requirement: Destination-folder panel opens from Copy/Move actions

Clicking a `DialFileManagerActions.Copy` or `.Move` action (grid row menu, tree row menu, or bulk actions toolbar — wherever the action is present per `file-manager-tabs`) SHALL open the end-edge destination panel built into `@epam/ai-dial-react-file-manager` (`FolderDestinationPanel`, mounted internally by `DialFileManager` as `FileManagerDestinationPanel`). The shell does not pass `onDestinationRequest`, so the built-in panel is always used. No component in this repo owns the panel's mount/unmount lifecycle; open state, mode and items are package-internal.

**State ownership**: the shared `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`, `@epam/ai-dial-chat-shared/file-manager`) owns only the _options_ passed to the panel via `destinationPanelOptions`; it owns no panel open/closed state. `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` is a thin wrapper that passes the `useDialFileManager` result to it as `controller`.

The shell SHALL NOT pass `destinationFolderPopupOptions` or `onFolderPopupPathChange`; both belong to the retired modal popup.

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

`DialFileManagerShell` SHALL pass a `destinationPanelOptions` object to `DialFileManager` built from its host-supplied `labels` (`DialFileManagerShellLabels`, `libs/chat-shared/src/file-manager/labels.ts`):

| `destinationPanelOptions` field | Shell label |
| --- | --- |
| `copyTitle` | `copyDestinationTitle` |
| `moveTitle` | `moveDestinationTitle` |
| `copyLabel` | `copyLabel` |
| `moveLabel` | `moveLabel` |
| `getSourceItemsLabel` | `getDestinationItemsLabel` |
| `disabledPathTooltip` | `moveSourceDisabledTooltip` |
| `movedIntoItselfTooltip` | `movedIntoItselfTooltip` |
| `panelLabels.createFolderLabel` | `addFolderLabel` |

The shell calls no `useTranslation`; the hosts (`DialFileManagerPage`, `DialFileManagerModal`) resolve every label with `t()` and an enum key. Panel text not listed above (search placeholder, folder-name errors, retry) keeps the package's English default until a label is added.

#### Scenario: Panel shows translated Copy button label

- **WHEN** the panel opens in copy mode with a locale that translates `dialFileManager.copyAction`
- **THEN** the panel's primary button displays the translated string, not the package default

#### Scenario: Panel title follows the mode

- **WHEN** the panel opens in move mode
- **THEN** its title is `t(DialFileManagerI18nKeys.MoveAction)`

#### Scenario: Several items are named by count

- **WHEN** the user copies or moves 3 selected items
- **THEN** the panel's summary row reads `t(DialFileManagerI18nKeys.DestinationItemsLabel, { count: 3 })`

---

### Requirement: Copy and Move disable unusable destinations

The built-in panel disables the folder a Move starts from, and, for a moved folder, that folder and its subfolders. The shell supplies the tooltip text as `moveSourceDisabledTooltip` and `movedIntoItselfTooltip`; the BFF rejects the same move as a fallback (see `file-manager-copy-move`). The shell does not compute the source folder; the package derives it from the staged items.

#### Scenario: Move disables the source folder

- **WHEN** the user moves items that all live in `/My files/reports/`
- **THEN** that folder cannot be chosen as the destination, and the translated `moveSourceDisabledTooltip` explains why

#### Scenario: Move disables the moved folder and its subfolders

- **WHEN** the user moves the folder `/My files/reports/` and picks it or a folder inside it
- **THEN** Move is unavailable, with the translated `movedIntoItselfTooltip` shown

---

### Requirement: Panel lists folders and keeps files for conflict detection

The panel's tree lists folders only. The application SHALL keep the browsed listings, files included, in the `DialFileManager.items` tree so the copy/move conflict resolver can detect destination-name collisions. Folders whose contents are not yet loaded are loaded through the tree's expanded-path callback (`treeOptions.onExpandedPathsChange`) and shown as loading through `treeOptions.loadingPaths`.

#### Scenario: Loaded destination can trigger conflict resolution

- **WHEN** the listing of `/My files/Folder1/` has loaded and contains `requirements.txt`
- **AND** the user confirms copying or moving an item named `requirements.txt` there
- **THEN** the conflict resolver shows the Replace/Duplicate decision before the copy/move handler runs

---

### Requirement: Add-folder inside the panel

The panel offers folder creation through the `onCreateFolder`/`onCreateFolderValidate` callbacks already passed to the outer `DialFileManager`; no separate override is introduced. The button label is `addFolderLabel`.

#### Scenario: Add folder creates inside the chosen parent

- **WHEN** the user creates a folder under a node of the panel's tree
- **THEN** the folder is created inside that node, not inside the outer grid's current folder

---

### Requirement: i18n keys for the destination panel

The following keys SHALL exist in `apps/chat/src/i18n/locales/en.json` with matching members in `DialFileManagerI18nKeys` (`apps/chat/src/constants/i18n-keys/dial-file-manager.ts`):

| Key | English value |
| --- | --- |
| `dialFileManager.folderPickerAddFolderLabel` | `Add folder` |
| `dialFileManager.destinationItemsLabel` | `{{count}} items` |
| `dialFileManager.moveSourceDisabledTooltip` | `Unavailable for the original location. Please select another folder` |
| `dialFileManager.movedIntoItselfTooltip` | `A folder can't be moved into itself or its subfolders` |

The panel also reuses `dialFileManager.copyAction` (`Copy to`) and `dialFileManager.moveAction` (`Move to`) for its titles and button labels. No raw string literal keys are passed to `t()` anywhere in this capability.

#### Scenario: All panel strings resolve through the enum

- **WHEN** any of the strings above is rendered
- **THEN** it is produced via `t(DialFileManagerI18nKeys.<Member>)`, never a raw string literal

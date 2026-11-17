# file-manager-folder-picker Specification

## Purpose

The destination-folder side panel opened from the Copy and Move actions of the standalone file manager.

## Requirements

### Requirement: Copy and Move open a destination side panel owned by the host

Choosing a `DialFileManagerActions.Copy` or `.Move` action (grid row menu, tree row menu, or bulk actions toolbar) SHALL NOT open a popup inside `@epam/ai-dial-react-file-manager`; the package ships no destination UI. It SHALL call the `onDestinationRequest` prop of `DialFileManager` with a `DialDestinationRequest` (`mode`, `items`, `sourceFolder`, `confirm(destinationFolder)`, `cancel()`).

`DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) forwards its own `onDestinationRequest` prop and owns no destination state. `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` keeps the pending request in state and renders `FileManagerDestinationPanelContainer` (`apps/chat/src/components/FileManagerDestinationPanelContainer/FileManagerDestinationPanelContainer.tsx`) while one is pending. The container renders `FolderDestinationPanel` from `@epam/ai-dial-react-file-manager`, the same side panel the Save flow uses. `DialFileManagerShell` SHALL offer Copy and Move only while `onDestinationRequest` is supplied, so a host without a destination UI shows no dead actions. The attach modal exposes no Copy or Move and passes no handler.

#### Scenario: Copy opens the panel

- **WHEN** the user triggers the Copy action on one or more items
- **THEN** the shell calls `onDestinationRequest` with `mode` `copy` and the page shows the destination side panel

#### Scenario: Move opens the panel

- **WHEN** the user triggers the Move action on one or more items
- **THEN** the shell calls `onDestinationRequest` with `mode` `move` and the page shows the destination side panel

---

### Requirement: The panel shows the item and the folder hierarchy

The panel SHALL use `FolderDestinationLayout.Inline`: the folder search and hierarchy are part of the one view, with no Change or Select step, and a pick is the destination. Its title SHALL be `DialFileManagerI18nKeys.CopyTitleFile` / `CopyTitleFolder` (and the `Move` equivalents) for one item, and `CopyHeaderMultiple` / `MoveHeaderMultiple` for several. Its summary row SHALL show the item's name with a file or folder icon, or `SelectedItemsSummary` for several items. The heading above the search SHALL be `CopyToFolderHeading` or `MoveToFolderHeading`. The footer SHALL be Cancel and the action. Only the folder hierarchy SHALL scroll; the item summary, heading and search SHALL stay visible.

The tree SHALL have one root per top-level folder of `UseDialFileManagerResult.items` (`buildDestinationRoots` in `libs/chat-hooks/src/files/dial-file-manager-destination.util.ts`, used by `useFileManagerDestination`), each listing only its folders. The panel SHALL open on the folder the items are in (`DialDestinationRequest.sourceFolder`) with the hierarchy already expanded along the path to that folder. Only roots the user may write to SHALL offer folder creation. The user SHALL be able to collapse and expand each root (`collapsibleRoots`), and roots SHALL start expanded.

#### Scenario: Panel opens on the source folder

- **WHEN** the user copies `a.pdf` from `/My files/reports`
- **THEN** the hierarchy is open down to `My files / reports`, which is the selected folder

#### Scenario: Several items are titled by their count

- **WHEN** the user moves 3 selected items
- **THEN** the title is produced via `t(DialFileManagerI18nKeys.MoveHeaderMultiple, { count: 3 })` and the summary reads `3 items`

---

### Requirement: The action button reflects whether the destination is valid

The panel SHALL render its own primary button from `action` (`label`, `onClick`, `isDisabled`), labelled `ButtonsI18nKeys.Copy` or `DialFileManagerI18nKeys.MoveButtonLabel`, with a copy or folder-share icon. The button SHALL be disabled, with the reason shown under the destination, when:

- the destination is the folder the items are already in (`DialFileManagerI18nKeys.MoveSourceDisabledTooltip`), in both copy and move mode;
- in move mode, the destination is a moved folder or lies inside one (`DialFileManagerI18nKeys.MovedIntoItselfTooltip`);
- the destination folder is still being preloaded (`DialFileManagerI18nKeys.FolderPickerLoadingTooltip`).

Copying an item into its own folder is therefore not offered; the dedicated duplicate action covers that case. DIAL Core's rejection remains the fallback for any other invalid destination.

#### Scenario: Source folder cannot be the destination

- **WHEN** the user selects items that all live in `/My files/reports` and triggers Move
- **THEN** the destination `/My files/reports` leaves the action disabled with the source-folder reason

#### Scenario: Move into itself is blocked

- **WHEN** the user moves the folder `/My files/reports` and picks `/My files/reports/2024`
- **THEN** the action is disabled with the moved-into-itself reason

---

### Requirement: Destination folders are preloaded before the operation runs

Picking or expanding a folder SHALL call `onFolderPopupPathChange` with its virtual path (the destination that `useFileManagerDestination` derives from a pick or from the items, since the Inline panel reports picks only through `onDestinationChange`; an expansion through the root's `onExpandedPathsChange`), so `useDialFileManager` (`useDialFileListing`, `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`) lists it when it is not cached; folders being listed come back in `folderPopupLoadingPaths`, which the container shows as loading in the tree and uses to disable the action. The listing SHALL stay complete in `DialFileManager.items` so the copy/move conflict resolver can detect name collisions at the destination.

`DialDestinationRequest.confirm` SHALL check conflicts against the items of the latest render, not those present when the request was raised, so a destination loaded after the panel opened is honoured.

#### Scenario: Opening a folder preloads it

- **WHEN** the user expands `archive` under `My files` in the panel's tree
- **THEN** `onFolderPopupPathChange` is called with `/My files/archive`

#### Scenario: Loaded destination can trigger conflict resolution

- **WHEN** the destination folder contains `requirements.txt` and the user confirms copying an item named `requirements.txt` there
- **THEN** the file manager shows the Replace/Duplicate decision before dispatching the copy handler

---

### Requirement: Confirming and cancelling

Activating the action SHALL call `DialDestinationRequest.confirm` with the destination's virtual path and close the panel without calling `cancel`; the operation then proceeds through `onCopyFiles` / `onMoveToFiles` exactly as in [file-manager-copy-move](../file-manager-copy-move/spec.md). Closing the panel by any other route SHALL call `DialDestinationRequest.cancel`.

#### Scenario: Confirming copy calls the copy handler

- **WHEN** the user picks `/My files/archive` and activates Copy to
- **THEN** `confirm('/My files/archive')` runs, the panel closes, and `onCopyFiles` is called once conflicts are resolved

#### Scenario: Dismissing cancels the request

- **WHEN** the user closes the panel without confirming
- **THEN** `cancel()` is called and no copy or move runs

---

### Requirement: Add folder inside the panel creates under the chosen parent

Creating a folder in the panel's tree SHALL call the file manager's `onCreateFolder` with the new folder's virtual path (the root's path, the parent segments and the new name), so it is created inside the parent the user picked, not inside the grid's current folder.

#### Scenario: Add folder creates inside the chosen parent

- **WHEN** the user adds a folder `new` under `reports` in the panel's tree
- **THEN** `onCreateFolder` is called for `/My files/reports/new`

---

### Requirement: i18n keys for the destination panel

The panel SHALL reuse existing keys where it can and add only the file-manager-specific ones to `DialFileManagerI18nKeys` (`CopyTitleFile`, `CopyTitleFolder`, `MoveTitleFile`, `MoveTitleFolder`, `CopyToFolderHeading`, `MoveToFolderHeading`, `MoveButtonLabel`, `SelectedItemsSummary`), next to the existing `DialFileManagerI18nKeys` titles, action labels and reasons above; `ResourceSavePanelI18nKeys` and `CatalogI18nKeys` for the destination heading, Change, search and empty-state copy shared with the Save panel; and `ButtonsI18nKeys` for Cancel, Back, Close, Select and Retry. The Save-panel destination strings that carry publish-flavoured key names (`CatalogI18nKeys.PublishFolderSearchPlaceholder`, `PublishFolderEmptyState`, the `ConversationPublishI18nKeys` folder-name errors and `getPublishPanelCommonLabels`) are the app's one shared set of destination-folder strings; the panel reuses them rather than duplicating the values under file-manager keys. The shell's `DialFileManagerShellLabels` SHALL carry no destination-picker strings.

#### Scenario: No hardcoded English in the panel

- **WHEN** the panel renders under a non-English locale
- **THEN** every label it shows comes from `t()` with those keys

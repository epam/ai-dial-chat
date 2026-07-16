# Spec: file-manager-folder-picker

## ADDED Requirements

### Requirement: Destination-folder popup opens from Copy/Move actions

Clicking a `DialFileManagerActions.Copy` or `.Move` action (grid row menu, tree row menu, or bulk actions toolbar — wherever the action is present per `file-manager-tabs`) SHALL open ui-kit's built-in destination-folder popup (`DialDestinationFolderPopup`, mounted internally by `DialFileManager`'s `FileManagerContext`). No app-level component owns this popup's mount/unmount lifecycle — it is entirely ui-kit-internal state (`openDestinationFolderPopup`, `handleOpenDestinationFolderPopup`, `handleCloseDestinationFolderPopup`).

**State ownership**: `DialFileManagerShell` owns only the *options* passed into the popup via `destinationFolderPopupOptions`; it owns no popup open/closed state itself.

#### Scenario: Copy action opens the popup in copy mode

- **WHEN** the user triggers the Copy action on one or more items
- **THEN** the destination-folder popup opens, browsing the same folder tree already loaded for the active tab, showing both files and folders

#### Scenario: Move action opens the popup in move mode

- **WHEN** the user triggers the Move action on one or more items
- **THEN** the destination-folder popup opens in move mode, browsing the same folder tree, showing both files and folders

---

### Requirement: Popup confirm dispatches to the already-wired copy/move handlers

Confirming a destination in the popup SHALL invoke the same `onCopyFiles(items, destinationFolder)` / `onMoveToFiles(items, sourceFolder, destinationFolder)` callbacks already wired on `DialFileManagerShell` per [file-manager-copy-move](../../../specs/file-manager-copy-move/spec.md) — no new callback prop is introduced by this capability.

#### Scenario: Confirming copy destination calls onCopyFiles

- **WHEN** the user selects a destination folder in copy mode and confirms
- **THEN** `onCopyFiles` is called with the copied items and the selected destination folder, and the BFF `/copy` flow proceeds exactly as specified in `file-manager-copy-move`

#### Scenario: Confirming move destination calls onMoveToFiles

- **WHEN** the user selects a destination folder in move mode and confirms
- **THEN** `onMoveToFiles` is called with the moved items, the source folder, and the selected destination folder, and (per `file-manager-copy-move`'s folder-equality partition) the cross-folder `/move` flow proceeds since the destination differs from the source

---

### Requirement: Popup labels are translated via i18n

`DialFileManagerShell` SHALL pass a `destinationFolderPopupOptions` object to `DialFileManager` containing i18n-resolved `copyLabel`, `moveLabel`, `addFolderLabel`, and `hiddenFilesSwitcherLabel`. No hardcoded English string SHALL be visible in the popup regardless of active locale.

`copyLabel`/`moveLabel` SHALL reuse the same translation keys already used for the Copy/Move action labels (`DialFileManagerI18nKeys.CopyAction`/`.MoveAction`).

#### Scenario: Popup shows translated Copy button label

- **WHEN** the popup opens in copy mode with `i18n.language` set to a non-English locale that has a translation for `dialFileManager.copyAction`
- **THEN** the popup's confirm button displays the translated string, not the ui-kit default `"Copy"`

#### Scenario: Popup shows translated Add folder button

- **WHEN** the popup is open
- **THEN** the "Add folder" button displays `t(DialFileManagerI18nKeys.FolderPickerAddFolderLabel)`, not the ui-kit default `"Add folder"`

#### Scenario: Popup shows translated hidden-files toggle

- **WHEN** the popup is open
- **THEN** the hidden-files toggle label displays `t(DialFileManagerI18nKeys.FolderPickerHiddenFilesLabel)`, not the ui-kit default `"Show hidden files"`

---

### Requirement: Popup title reflects item count and name

`destinationFolderPopupOptions` SHALL include `getCopyHeader(itemsCount, itemName)` and `getMoveHeader(itemsCount, itemName)` render functions. For a single item, the title SHALL include the item's name. For multiple items, the title SHALL include the count.

#### Scenario: Single-item copy shows the item name in the title

- **WHEN** the user copies a single file named `report.pdf`
- **THEN** the popup title is produced via `t(DialFileManagerI18nKeys.CopyHeaderSingle, { name: 'report.pdf' })`

#### Scenario: Multi-item move shows the count in the title

- **WHEN** the user moves 3 selected items
- **THEN** the popup title is produced via `t(DialFileManagerI18nKeys.MoveHeaderMultiple, { count: 3 })`

---

### Requirement: Move mode disables the common source folder as a destination

When the popup opens in move mode and every selected item shares the same parent folder, `destinationFolderPopupOptions.sourceFolder` SHALL be set to that common parent folder, and `disabledPathTooltip` SHALL be an i18n-resolved string explaining why that path is disabled. When the selected items do not share a single common parent folder, `sourceFolder` SHALL be `undefined` and no path is proactively disabled by the frontend (DIAL Core's `moveResource` 409 response remains the fallback for a no-op move attempt).

Copy mode SHALL NOT set `sourceFolder` — copying an item into its own current folder is an allowed, intentional action in this capability (distinct from the dedicated duplicate feature planned separately) and is not blocked.

#### Scenario: Move disables the single common source folder

- **WHEN** the user selects items that all live in `/My files/reports/` and triggers Move
- **THEN** `/My files/reports/` is disabled as a destination in the popup, with the translated `disabledPathTooltip` shown on hover/focus

#### Scenario: Move with mixed source folders disables nothing proactively

- **WHEN** the user selects items from two different parent folders and triggers Move
- **THEN** no path is disabled in the popup; a move attempt into an invalid destination surfaces via the existing `file-manager-copy-move` partial-failure toast if DIAL Core rejects it

#### Scenario: Copy does not disable the current folder

- **WHEN** the user selects items in `/My files/reports/` and triggers Copy
- **THEN** `/My files/reports/` remains selectable as a destination in the popup

---

### Requirement: Action-free browsing inside the popup

The popup SHALL display both files and folders and SHALL NOT render row-level context actions (no Rename/Delete/etc. on rows shown inside the popup). The action-free behavior is the current behavior of the installed `@epam/ai-dial-ui-kit` version and is not configurable by the host application — `DialFileManagerDestinationFolderPopupOptions` exposes no `actionLabels` override for the popup's internal tree.

#### Scenario: Files and folders are both shown in the popup

- **WHEN** the popup is open and the current folder contains both files and subfolders
- **THEN** both files and subfolders are listed

#### Scenario: No context menu on popup rows

- **WHEN** the user right-clicks or opens the row menu on a folder inside the popup
- **THEN** no Rename/Delete/other action menu appears (known ui-kit limitation — see design.md D6/Open Questions)

---

### Requirement: Add-folder inside the popup targets the popup's own path

Clicking "Add folder" inside the popup SHALL create the new folder inside the folder currently browsed *within the popup*, not the outer grid's currently browsed folder. This SHALL work via the same `onCreateFolder`/`onCreateFolderValidate` callbacks already passed to the outer `DialFileManager` (no separate override is introduced) because the popup invokes them with its own current path as the call-time argument.

#### Scenario: Add folder creates inside the popup's browsed folder

- **WHEN** the user opens the popup, navigates to a different folder than the one they started from in the outer grid, and clicks "Add folder"
- **THEN** the new folder is created inside the folder currently browsed in the popup, not the outer grid's folder

---

### Requirement: Folder-picker empty state

`destinationFolderPopupOptions` SHALL include i18n-resolved `emptyStateTitle` and `emptyStateDescription` for when the currently-browsed popup folder has no subfolders.

#### Scenario: Empty folder shows translated empty state

- **WHEN** the popup browses into a folder with no subfolders
- **THEN** the empty state displays `t(DialFileManagerI18nKeys.FolderPickerEmptyStateTitle)` and `t(DialFileManagerI18nKeys.FolderPickerEmptyStateDescription)`, not a blank or ui-kit-default empty state

---

### Requirement: i18n keys for the folder picker

The following keys SHALL be added to `apps/chat/src/i18n/locales/en.json` with matching members added to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`:

| Key | English value (example) |
|-----|--------------------------|
| `dialFileManager.folderPickerAddFolderLabel` | `Add folder` |
| `dialFileManager.folderPickerHiddenFilesLabel` | `Show hidden files` |
| `dialFileManager.copyHeaderSingle` | `Copy "{{name}}"` |
| `dialFileManager.copyHeaderMultiple` | `Copy {{count}} items` |
| `dialFileManager.moveHeaderSingle` | `Move "{{name}}"` |
| `dialFileManager.moveHeaderMultiple` | `Move {{count}} items` |
| `dialFileManager.moveSourceDisabledTooltip` | `Unavailable for the original location. Please select another folder` |
| `dialFileManager.folderPickerEmptyStateTitle` | `This folder is empty` |
| `dialFileManager.folderPickerEmptyStateDescription` | `Create a folder or choose another location` |

No raw string literal keys are passed to `t()` anywhere in this change.

#### Scenario: All popup strings resolve through the enum

- **WHEN** any of the strings above is rendered
- **THEN** it is produced via `t(DialFileManagerI18nKeys.<Member>)`, never a raw string literal

---

### Requirement: No feature-flag gating

The folder picker SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — it is a direct, unconditional consequence of the Copy/Move actions already shipped in `file-manager-copy-move`, which are themselves ungated.

#### Scenario: Folder picker is available whenever Copy/Move actions are available

- **WHEN** a user has WRITE permission and the Copy/Move actions are visible per `file-manager-tabs`
- **THEN** the destination-folder popup is available without checking any `ENABLED_FEATURES` entry

---

### Requirement: RTL and accessibility

The popup SHALL be rendered entirely by `@epam/ai-dial-ui-kit` using logical CSS properties and the inherited `dir` attribute from `<html>`. This change SHALL NOT introduce any physical-direction Tailwind classes or app-level RTL handling. Keyboard navigation and ARIA roles within the popup SHALL remain ui-kit-owned; the app-level change here is limited to supplying translated strings, which SHALL NOT alter focus order or semantics.

#### Scenario: Popup inherits RTL layout

- **WHEN** the active language is Arabic (`dir="rtl"` on `<html>`)
- **THEN** the popup's layout mirrors correctly without any app-level RTL-specific code, since no app-level layout is introduced by this change

## Purpose

Define the DIAL file manager attach modal UI contract, including tab chrome, attachment constraints copy, and disabled-row feedback.

## Requirements

### Requirement: Tab navigation UI in DialFileManagerModal

`DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) SHALL render configured All, My files, Shared with me, and Organization tabs through `useFileAttachmentPicker` from `@epam/ai-dial-chat-hooks`, which calls `useDialFileManagerTabs` from `@epam/ai-dial-react-file-manager` with the modal's i18n-translated label map and `DialFileManagerTabs.All` as the initial tab, and filters the list to `useAppConfig().config.fileManagerTabs` through `useDialFileManagerTabConfig` (All is kept only while at least two source tabs are enabled; an excluded active tab falls back to the highest-priority enabled tab). The resulting `tabs`, `activeTab`, and `onTabChange` are passed to `FileManagerAttachModal` (`@epam/ai-dial-chat-shared/file-manager`), whose `DialFileManagerShell` wires them to `treeOptions.tabs`, `treeOptions.activeTab`, and `treeOptions.onTabChange` respectively (they were passed under `toolbarOptions` up to `@epam/ai-dial-react-file-manager` 0.3.0-dev.2). No custom tab UI is built — the kit renders the strip as a chip row in the folders panel, above the tree it filters; its role structure is specified by the `file-manager-tabs` spec, requirement "Tab strip accessibility".

RTL: tab bar direction is handled by the ui-kit; no physical direction classes on the modal wrapper.

#### Scenario: Tab strip renders in the modal folders panel

- **WHEN** `DialFileManagerModal` opens
- **THEN** the default configuration shows four tabs in the folders panel: All, My files, Shared with me, Organization
- **AND** the active tab is All

#### Scenario: Tab labels use i18n

- **WHEN** the app language is changed
- **THEN** tab labels update to match the active locale's `dialFileManager.tab.all`, `dialFileManager.tab.myFiles` and `dialFileManager.tab.shared` keys, and the Organization tab uses `basic.organization`

---

### Requirement: Per-tab gridOptions in DialFileManagerShell

The shared `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) SHALL build `gridOptions` from per-tab fields of its controller. `useDialFileManager` (`@epam/ai-dial-chat-hooks`) computes them for each source section, and `useDialFileManagerSections` exposes the browsed section's values (its `sectionTab`; the shell falls back to `activeTab` for controllers without section composition):

- `visibleColumns` is `COLUMNS_WITH_AUTHOR` on the Shared section and `COLUMNS_WITHOUT_AUTHOR` otherwise (see `file-manager-tabs` spec).
- `actionLabels` includes `Delete` only on the `DialFileManagerTabs.MyFiles` section; the shell maps each present action onto its translated label and adds `Info` to the grid labels when the controller supplies it.
- `dateLocale` is the host's `locale` option, which `useDialFileManagerHostOptions` sets to `i18n.language`.
- `dateOptions` is `DATE_OPTIONS`: `{ year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }`.
- `selectionMode` is `GridSelectionMode.MULTIPLE`, and `additionalGridOptions.rowSelection` carries the host's `isRowSelectable` (all rows selectable when absent).

`gridOptions` SHALL be recomputed (via `useMemo`) whenever `visibleColumns`, `dateLocale`, `dateOptions`, the grid action labels, or `isRowSelectable` changes.

#### Scenario: gridOptions recomputed on tab switch

- **WHEN** the active tab switches from `my_files` to `shared`
- **THEN** `gridOptions.visibleColumns` gains `Author` and `gridOptions.actionLabels` loses `Delete`

#### Scenario: gridOptions unchanged selectability logic

- **WHEN** `allowedTypes` or `maxSelectableFileSize` are provided
- **THEN** `isRowSelectable` still applies type/size filters regardless of active tab

---

### Requirement: Per-tab treeOptions and bulkActionsToolbarOptions

`DialFileManagerShell` SHALL derive `treeOptions.actionLabels` and `bulkActionsToolbarOptions.actionLabels` from the same controller `actionLabels` as `gridOptions.actionLabels`, so Delete is present only on the `my_files` section. The bulk toolbar additionally drops `RemoveAccess` unless every selected path is shared by the user.

#### Scenario: Bulk actions hide Delete on Shared tab

- **WHEN** the user selects multiple files on the Shared tab
- **THEN** the bulk actions toolbar does NOT show a Delete action

---

### Requirement: Per-tab uploadEnabled and toolbar new-button state

`useDialFileManager` SHALL compute `uploadEnabled` from the section tab and current folder permissions (`false` on Organization and at the Shared root, otherwise the folder's write permission; see `file-manager-tabs` spec for the full rules table) and `isNewButtonDisabled` as `!uploadEnabled`. `DialFileManagerShell` wires `toolbarOptions.isNewButtonDisabled` and `toolbarOptions.disabledNewButtonTooltip` from the controller.

#### Scenario: Organization tab disables new button

- **WHEN** the active tab is `organization`
- **THEN** `toolbarOptions.isNewButtonDisabled` is `true` regardless of folder

---

### Requirement: sharedWithMeIds passed to DialFileManager

`DialFileManagerShell` SHALL pass the controller's `sharedWithMeIds` to `DialFileManager`. `useDialFileListing` populates it for the Shared section from the root-level item paths in the shared listing (`undefined` for other sections), and `useDialFileManagerSections` flattens the lists of every enabled section, so the array is defined on any tab while the Shared section is configured and is `undefined` only when no section supplies one.

#### Scenario: sharedWithMeIds present on Shared tab

- **WHEN** the active tab is `shared` (or `all` with the Shared section enabled) and shared items have been loaded
- **THEN** `DialFileManager` receives a non-empty `sharedWithMeIds` array

---

### Requirement: Selection cleared on tab change

`DialFileManagerModal` SHALL reset `selectedPaths` to an empty `Set` when its tab-change handler changes `activeTab`; the handler and the selection state are owned by `useFileAttachmentPicker`, whose `onTabChange` clears the selection before switching tabs and which also clears it when the browsed source section (`controller.sectionTab`) changes inside All. This prevents stale selections from one tab's file tree being carried over to another tab's tree.

> **Implementation note:** from `@epam/ai-dial-react-file-manager` 0.3.0-dev.3 the tab strip sits in the folders panel and stays visible while a selection is active (the bulk-actions toolbar floats over the grid), so clicking a tab with files selected is a reachable flow. Up to 0.3.0-dev.2 the bulk-actions toolbar took the place of the tab strip, which is why this requirement is stated at the handler level.

#### Scenario: selectedPaths empty after tab-change handler runs

- **GIVEN** `selectedPaths` contains files from My files
- **WHEN** the modal's tab-change handler is invoked with Shared
- **THEN** `selectedPaths` is reset to `new Set()` before the Shared tab listing is used

---

### Requirement: Modal header shows attachment constraints description

When the modal is in attach mode (i.e., the `onAttach` callback is present), `DialFileManagerModal` SHALL render a description paragraph below the modal title that summarises the active constraints:

- **Supported types + max size**: always shown when at least one of `allowedTypes` or `maxSelectableFileSize` is provided. Uses i18n key `DialFileManagerI18nKeys.MaxSizeSupportedTypes` (`dialFileManager.maxSizeSupportedTypes`) with params `{{maxSize}}` (human-readable, e.g., "512 MB") and `{{allowedExtensions}}` (comma-separated type labels from `mimeTypesToExtensionLabels`).
- **Max count suffix**: appended when `maximumAttachmentsAmount` is provided and is a finite positive number. Uses i18n key `DialFileManagerI18nKeys.UpToFiles` (`dialFileManager.upToFiles`, plural `_one`/`_other`) with param `{{count}}`.

The description string SHALL be computed by `DialFileManagerModal` and passed as `labels.headerDescription` to `FileManagerAttachModal`, which renders it as a paragraph inside the `Popup` header, below an `<h3>` title, before the file grid. When only a size constraint applies it uses `DialFileManagerI18nKeys.MaxSizeOnly`; a `*`/`*/*` type list uses `DialFileManagerI18nKeys.AllTypes`; an `allowedTypesLabel` prop overrides the computed type label; parts are joined with `. ` and end with `.`. The description SHALL use `text-secondary` styling. The description is unaffected by the active tab.

i18n keys: `dialFileManager.maxSizeSupportedTypes` (params: `maxSize`, `allowedExtensions`), `dialFileManager.maxSizeOnly` (param: `maxSize`), `dialFileManager.allTypes`, `dialFileManager.upToFiles` (param: `count`)
RTL: paragraph uses `text-start` — no physical `text-left`/`pl-*`.
Feature flag: none
Accessibility: the `Popup` receives `ariaLabel={title}`; the description has no `aria-describedby` link and relies on prose placement under the title.
Memoisation: description string computed in `useMemo` from props.

#### Scenario: Description shows type + size when both provided

- **WHEN** `allowedTypes` is `['image/*']` and `maxSelectableFileSize` is `5_242_880` (5 MB)
- **THEN** the header description contains "Image files" and "5 MB"

#### Scenario: Description shows max count suffix

- **WHEN** `maximumAttachmentsAmount` is `10`
- **THEN** the header description includes "up to 10 files" (or the translated equivalent)

#### Scenario: Description hidden when no constraints are provided

- **WHEN** `allowedTypes` is `[]`, `maxSelectableFileSize` is `undefined`, and `maximumAttachmentsAmount` is `undefined`
- **THEN** no description paragraph is rendered

#### Scenario: Description RTL direction

- **WHEN** the page direction is `rtl`
- **THEN** the description paragraph text aligns to the start edge (`text-start`)

---

### Requirement: Disabled-row tooltip for hidden paths

`DialFileManagerModal` SHALL pass a `getDisabledTooltip` callback through `FileManagerAttachModal` and `DialFileManagerShell` to `DialFileManager`. The callback SHALL:
- Return the string `t(DialFileManagerI18nKeys.AttachingHiddenFilesNotAllowed)` when `isHiddenPath(row.path)` is `true`.
- Return `undefined` for all other rows.

`isHiddenPath` (`@epam/ai-dial-chat-shared`) SHALL treat any path segment starting with `.` as hidden, including `.env`, `.hidden`, and the file-manager placeholder `.dial_folder`.

The callback behavior is unchanged by `activeTab`.

i18n key: `dialFileManager.attachingHiddenFilesNotAllowed`
RTL: none (tooltip text positioning is handled by the UI kit)
Feature flag: none
Memoisation: `getDisabledTooltip` in `useCallback`.

#### Scenario: Hidden path row shows tooltip

- **WHEN** a grid row has `path` containing a dot-prefixed segment such as `/My files/.hidden/report.pdf` and the user hovers or focuses the row
- **THEN** the tooltip "Attaching hidden files is not allowed" (or its translation) is displayed

#### Scenario: Normal path row shows no tooltip

- **WHEN** a grid row has a path with no dot-prefixed segment
- **THEN** no tooltip is shown from `getDisabledTooltip`

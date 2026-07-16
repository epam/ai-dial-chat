## Purpose

Define the DIAL file manager attach modal UI contract, including tab chrome, attachment constraints copy, and disabled-row feedback.

## Requirements

### Requirement: Tab navigation UI in DialFileManagerModal

`DialFileManagerModal` SHALL render My files, Shared with me, and Organization tabs using `useDialFileManagerTabs` from `@epam/ai-dial-ui-kit`. The hook is called with an i18n-translated label map and `DialFileManagerTabs.MyFiles` as the initial tab. The resulting `tabs`, `activeTab`, and `handleTabChange` are wired to `toolbarOptions.tabs`, `toolbarOptions.activeTab`, and `toolbarOptions.onTabChange` respectively. No custom tab UI is built — the ui-kit toolbar handles tab rendering.

RTL: tab bar direction is handled by the ui-kit; no physical direction classes on the modal wrapper.

#### Scenario: Tab bar renders in modal toolbar

- **WHEN** `DialFileManagerModal` opens
- **THEN** three tabs are visible in the toolbar: My files, Shared with me, Organization
- **AND** the active tab is My files

#### Scenario: Tab labels use i18n

- **WHEN** the app language is changed
- **THEN** tab labels update to match the active locale's `dialFileManager.tab.*` keys

---

### Requirement: Per-tab gridOptions in DialFileManagerShell

`DialFileManagerShell` SHALL derive `gridOptions` from `activeTab`:

- `visibleColumns` changes per tab (see `file-manager-tabs` spec).
- `actionLabels` includes `Delete` only when `activeTab === DialFileManagerTabs.MyFiles`.
- `dateLocale` is `i18n.language`.
- `dateOptions` is `{ year: 'numeric', month: 'short', day: '2-digit' }`.
- `selectionMode`, `additionalGridOptions`, and row-selectability logic are unchanged from current implementation.

`gridOptions` SHALL be recomputed (via `useMemo`) whenever `activeTab`, `downloadLabel`, or `deleteLabel` changes.

#### Scenario: gridOptions recomputed on tab switch

- **WHEN** the active tab switches from `my_files` to `shared`
- **THEN** `gridOptions.visibleColumns` gains `Author` and `gridOptions.actionLabels` loses `Delete`

#### Scenario: gridOptions unchanged selectability logic

- **WHEN** `allowedTypes` or `maxSelectableFileSize` are provided
- **THEN** `isRowSelectable` still applies type/size filters regardless of active tab

---

### Requirement: Per-tab treeOptions and bulkActionsToolbarOptions

`DialFileManagerShell` SHALL derive `treeOptions.actionLabels` and `bulkActionsToolbarOptions.actionLabels` from `activeTab` with the same Delete visibility rule as `gridOptions.actionLabels`: Delete present only on `my_files` tab.

#### Scenario: Bulk actions hide Delete on Shared tab

- **WHEN** the user selects multiple files on the Shared tab
- **THEN** the bulk actions toolbar does NOT show a Delete action

---

### Requirement: Per-tab uploadEnabled and toolbar new-button state

`DialFileManagerModal` SHALL compute `uploadEnabled` and `isNewButtonDisabled` from `activeTab` and current folder permissions (see `file-manager-tabs` spec for the full rules table). `toolbarOptions.isNewButtonDisabled` and `toolbarOptions.disabledNewButtonTooltip` are wired from the same source.

#### Scenario: Organization tab disables new button

- **WHEN** the active tab is `organization`
- **THEN** `toolbarOptions.isNewButtonDisabled` is `true` regardless of folder

---

### Requirement: sharedWithMeIds passed to DialFileManager

`DialFileManagerShell` SHALL pass `sharedWithMeIds` to `DialFileManager` when `activeTab === DialFileManagerTabs.Shared`, populated from the root-level item paths in the shared listing. On all other tabs `sharedWithMeIds` SHALL be `undefined`.

#### Scenario: sharedWithMeIds present on Shared tab

- **WHEN** the active tab is `shared` and shared items have been loaded
- **THEN** `DialFileManager` receives a non-empty `sharedWithMeIds` array

---

### Requirement: Selection cleared on tab change

`DialFileManagerModal` SHALL reset `selectedPaths` to an empty `Set` whenever `activeTab` changes. This prevents stale selections from one tab's file tree being carried over to another tab's tree.

#### Scenario: selectedPaths empty after tab switch

- **WHEN** files are selected on My files and the user switches to Shared
- **THEN** `selectedPaths` is `new Set()` on the Shared tab

---

### Requirement: Modal header shows attachment constraints description

When the modal is in attach mode (i.e., the `onAttach` callback is present), `DialFileManagerModal` SHALL render a description paragraph below the modal title that summarises the active constraints:

- **Supported types + max size**: always shown when at least one of `allowedTypes` or `maxSelectableFileSize` is provided. Uses i18n key `DialFileManager.MaxSizeSupportedTypes` with params `{{maxSize}}` (human-readable, e.g., "512 MB") and `{{allowedExtensions}}` (comma-separated type labels from `mimeTypesToExtensionLabels`).
- **Max count suffix**: appended when `maximumAttachmentsAmount` is provided and is a finite positive number. Uses i18n key `DialFileManager.UpToFiles` with param `{{count}}`.

The description paragraph SHALL use `text-secondary` styling and be positioned inside the modal header area, below the title, before the file grid. The description is unaffected by the active tab.

i18n keys: `DialFileManager.MaxSizeSupportedTypes` (params: `maxSize`, `allowedExtensions`), `DialFileManager.UpToFiles` (param: `count`)
RTL: paragraph uses `text-start` and logical padding — no physical `text-left`/`pl-*`.
Feature flag: none
Accessibility: `id` on description paragraph matched to `aria-describedby` on the popup (if the `DialPopup` component supports `aria-describedby` via a prop; otherwise omit and use prose placement).
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
- **THEN** the description paragraph text aligns to the start edge and padding uses logical properties

---

### Requirement: Disabled-row tooltip for hidden paths

`DialFileManagerModal` SHALL pass a `getDisabledTooltip` callback to `DialFileManager`. The callback SHALL:
- Return the string `t(DialFileManagerI18nKeys.AttachingHiddenFilesNotAllowed)` when `isHiddenPath(row.path)` is `true`.
- Return `undefined` for all other rows.

`isHiddenPath` SHALL treat any path segment starting with `.` as hidden, including `.env`, `.hidden`, and the file-manager placeholder `.dial_folder`.

The callback behavior is unchanged by `activeTab`.

i18n key: `DialFileManager.AttachingHiddenFilesNotAllowed`
RTL: none (tooltip text positioning is handled by the UI kit)
Feature flag: none
Memoisation: `getDisabledTooltip` in `useCallback`.

#### Scenario: Hidden path row shows tooltip

- **WHEN** a grid row has `path` containing a dot-prefixed segment such as `/My files/.hidden/report.pdf` and the user hovers or focuses the row
- **THEN** the tooltip "Attaching hidden files is not allowed." (or its translation) is displayed

#### Scenario: Normal path row shows no tooltip

- **WHEN** a grid row has a path with no dot-prefixed segment
- **THEN** no tooltip is shown from `getDisabledTooltip`

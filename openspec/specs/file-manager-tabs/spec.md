## ADDED Requirements

### Requirement: Tab navigation in DialFileManagerModal

`DialFileManagerModal` SHALL display three tabs — My files, Shared with me, and Organization — using `useDialFileManagerTabs` from `@epam/ai-dial-ui-kit`. The active tab SHALL be tracked via `handleTabChange` and wired to `DialFileManager` through `toolbarOptions.tabs`, `toolbarOptions.activeTab`, and `toolbarOptions.onTabChange`. The initial tab SHALL be `DialFileManagerTabs.MyFiles`.

Tab label i18n keys:
- `my_files` → `dialFileManager.tab.myFiles`
- `shared` → `dialFileManager.tab.shared`
- `organization` → `dialFileManager.tab.organization`

RTL: tab rendering and label alignment are handled by the ui-kit; no physical direction classes in the modal wrapper.

#### Scenario: Modal opens on My files tab

- **WHEN** `DialFileManagerModal` mounts with `isOpen=true`
- **THEN** the active tab is `DialFileManagerTabs.MyFiles` and the file listing shows the user's personal bucket

#### Scenario: Switching to Shared tab loads shared listing

- **WHEN** the user clicks the Shared with me tab
- **THEN** `activeTab` becomes `DialFileManagerTabs.Shared`, the listing reloads from the shared-files endpoint, and the path resets to the shared root

#### Scenario: Switching to Organization tab loads public listing

- **WHEN** the user clicks the Organization tab
- **THEN** `activeTab` becomes `DialFileManagerTabs.Organization` and the listing reloads from the public-files endpoint

#### Scenario: Tab switch resets folder navigation

- **WHEN** the user has navigated into a subfolder on My files and switches to Shared
- **THEN** the path resets to the root of the Shared tab and the cache for the previous tab is cleared

---

### Requirement: Per-tab visible columns

`DialFileManagerShell` SHALL pass `gridOptions.visibleColumns` to `DialFileManager` based on `activeTab`:

| Tab | `visibleColumns` |
|-----|-----------------|
| `my_files` | `[Name, UpdatedAt, Size, Actions]` |
| `shared` | `[Name, UpdatedAt, Size, Author, Actions]` |
| `organization` | `[Name, UpdatedAt, Size, Actions]` |

`Author` column SHALL appear only on the Shared tab. All tabs SHALL include `UpdatedAt`. Column keys are from `FileManagerColumnKey` enum.

#### Scenario: My files tab shows no Author column

- **WHEN** the active tab is `my_files`
- **THEN** `gridOptions.visibleColumns` does not include `FileManagerColumnKey.Author`

#### Scenario: Shared tab shows Author column

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.visibleColumns` includes `FileManagerColumnKey.Author` between `Size` and `Actions`

#### Scenario: Organization tab shows no Author column

- **WHEN** the active tab is `organization`
- **THEN** `gridOptions.visibleColumns` does not include `FileManagerColumnKey.Author`

---

### Requirement: Locale-aware UpdatedAt column

`DialFileManagerShell` SHALL pass `gridOptions.dateLocale` and `gridOptions.dateOptions` to format the UpdatedAt column. `dateLocale` SHALL be sourced from `i18n.language` (via `useTranslation`). `dateOptions` SHALL be fixed as `{ year: 'numeric', month: 'short', day: '2-digit' }`. These options SHALL be applied regardless of the active tab.

Items with a missing `updatedAt` SHALL display an empty cell; no error or fallback string is rendered.

#### Scenario: UpdatedAt formatted in en-US locale

- **WHEN** `i18n.language` is `'en'` or `'en-US'` and a file has `updatedAt` set
- **THEN** the UpdatedAt cell displays a date in the form "Jun 19, 2026"

#### Scenario: UpdatedAt formatted in Arabic locale

- **WHEN** `i18n.language` is `'ar'` and a file has `updatedAt` set
- **THEN** the UpdatedAt cell displays the date using the Arabic locale with the same format options (year numeric, month short, day 2-digit); layout follows RTL direction inherited from `<html dir="rtl">`

#### Scenario: Missing updatedAt renders empty cell

- **WHEN** a file item has no `updatedAt` value
- **THEN** the UpdatedAt cell is empty (no error text, no placeholder string)

---

### Requirement: Per-tab action labels

`DialFileManagerShell` SHALL compute `actionLabels` for `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` based on `activeTab`:

| Tab | Grid/bulk/tree actions |
|-----|------------------------|
| `my_files` | Download, Delete, Rename, Copy, Move |
| `shared` | Download only |
| `organization` | Download only |

Delete SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs even when the current folder has WRITE permission.

Rename SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs. On `my_files`, Rename SHALL be included only when `uploadEnabled` is `true` (WRITE permission on the current folder). `isRenameFileAvailable` SHALL mirror `uploadEnabled`.

Copy and Move SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs. On `my_files`, Copy and Move SHALL each be included only when `uploadEnabled` is `true`, using the same WRITE-permission gate as Rename and Delete.

#### Scenario: My files shows Delete action

- **WHEN** the active tab is `my_files`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Delete`

#### Scenario: Shared tab hides Delete action

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Delete`

#### Scenario: Organization tab hides Delete action

- **WHEN** the active tab is `organization`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Delete`

#### Scenario: My files with WRITE shows Rename action

- **WHEN** the active tab is `my_files` and the current folder has WRITE permission
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Rename`

#### Scenario: My files without WRITE hides Rename action

- **WHEN** the active tab is `my_files` and the current folder does NOT have WRITE permission
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Rename`

#### Scenario: Shared tab hides Rename action

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Rename`

#### Scenario: Organization tab hides Rename action

- **WHEN** the active tab is `organization`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Rename`

#### Scenario: My files with WRITE shows Copy and Move actions

- **WHEN** the active tab is `my_files` and the current folder has WRITE permission
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Copy` and `DialFileManagerActions.Move`

#### Scenario: My files without WRITE hides Copy and Move actions

- **WHEN** the active tab is `my_files` and the current folder does NOT have WRITE permission
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy` or `DialFileManagerActions.Move`

#### Scenario: Shared tab hides Copy and Move actions

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy` or `DialFileManagerActions.Move`

#### Scenario: Organization tab hides Copy and Move actions

- **WHEN** the active tab is `organization`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy` or `DialFileManagerActions.Move`

---

### Requirement: Per-tab upload and new folder rules

`DialFileManagerShell` SHALL pass `uploadEnabled` to `DialFileManager` based on `activeTab` and the current folder:

| Tab | `uploadEnabled` |
|-----|----------------|
| `my_files` | `true` when current folder has WRITE permission |
| `shared` | `false` at the shared root; `canWriteCurrentFolder` in nested shared folders |
| `organization` | Always `false` |

`isNewButtonDisabled` and `disabledNewButtonTooltip` in `toolbarOptions` SHALL reflect the same logic.

#### Scenario: Organization tab disables upload

- **WHEN** the active tab is `organization`
- **THEN** `uploadEnabled` is `false` regardless of folder permissions

#### Scenario: Shared root disables upload

- **WHEN** the active tab is `shared` and the current path is the shared root (`folderPath === ''`)
- **THEN** `uploadEnabled` is `false`

#### Scenario: Nested shared folder with WRITE enables upload

- **WHEN** the active tab is `shared`, the user has navigated into a subfolder, and that folder has WRITE permission
- **THEN** `uploadEnabled` is `true`

#### Scenario: My files WRITE-gated upload

- **WHEN** the active tab is `my_files` and the current folder has WRITE permission
- **THEN** `uploadEnabled` is `true`

#### Scenario: My files folder without WRITE disables upload

- **WHEN** the active tab is `my_files` and the current folder does NOT have WRITE permission
- **THEN** `uploadEnabled` is `false`

---

### Requirement: sharedWithMeIds wired on Shared tab

When the active tab is `shared`, `DialFileManagerShell` SHALL pass the `sharedWithMeIds` prop to `DialFileManager` containing the API paths of root-level shared items returned by `GET /api/v1/files/shared`. On all other tabs, `sharedWithMeIds` SHALL be `undefined`.

#### Scenario: sharedWithMeIds populated on Shared tab

- **WHEN** the active tab is `shared` and the listing returns items
- **THEN** `sharedWithMeIds` is an array of the root shared item paths

#### Scenario: sharedWithMeIds absent on My files tab

- **WHEN** the active tab is `my_files`
- **THEN** `sharedWithMeIds` is `undefined`

---

### Requirement: Selection cleared on tab switch

When `activeTab` changes, the set of `selectedPaths` SHALL be cleared (reset to an empty `Set`).

#### Scenario: Selection cleared after tab switch

- **WHEN** the user selects files on My files tab and switches to Shared
- **THEN** `selectedPaths` is empty on the Shared tab

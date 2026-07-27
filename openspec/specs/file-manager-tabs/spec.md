## ADDED Requirements

### Requirement: Tab navigation in DialFileManagerModal

`DialFileManagerModal` SHALL display the tabs present in the deployment-configured `fileManagerTabs` list (per `file-manager-tab-config`, read via `useAppConfig().config.fileManagerTabs`) — by default `My files`, `Shared with me`, and `Organization` (all three, when `FILE_MANAGER_AVAILABLE_TABS` is unset) — using `useDialFileManagerTabs` from `@epam/ai-dial-ui-kit`, filtered against `fileManagerTabs`. The active tab SHALL be tracked via `handleTabChange` and wired to `DialFileManager` through `toolbarOptions.tabs`, `toolbarOptions.activeTab`, and `toolbarOptions.onTabChange`. The initial tab SHALL be the first tab present in `fileManagerTabs` following the fixed priority `my_files` → `shared` → `organization` (defaulting to `DialFileManagerTabs.MyFiles` when `fileManagerTabs` includes `my_files`, which is the default case).

Tab label i18n keys:
- `my_files` → `dialFileManager.tab.myFiles`
- `shared` → `dialFileManager.tab.shared`
- `organization` → `dialFileManager.tab.organization`

RTL: tab rendering and label alignment are handled by the ui-kit; no physical direction classes in the modal wrapper.

#### Scenario: Modal opens on My files tab

- **WHEN** `DialFileManagerModal` mounts with `isOpen=true` and `fileManagerTabs` includes `my_files` (the default)
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

#### Scenario: Deployment-narrowed tab set hides an unconfigured tab

- **WHEN** `fileManagerTabs` is `['my_files', 'organization']` (Shared excluded by deployment configuration)
- **THEN** `DialFileManagerModal` does not render a Shared tab, and `toolbarOptions.tabs` contains only My files and Organization

#### Scenario: Initial tab falls back when my_files is excluded

- **WHEN** `fileManagerTabs` is `['shared', 'organization']` (My files excluded)
- **THEN** the initial active tab is `DialFileManagerTabs.Shared`, not `DialFileManagerTabs.MyFiles`

#### Scenario: Active tab resets when it becomes unavailable

- **WHEN** the modal is currently active on a tab that is subsequently no longer present in `fileManagerTabs` (e.g. the config resolves after mount to a narrower set that excludes the currently-active tab)
- **THEN** the active tab automatically changes to the first tab present in `fileManagerTabs` following the fixed priority `my_files` → `shared` → `organization`, per `useDialFileManagerTabConfig` (see `file-manager-tab-config`)

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

`DialFileManagerShell` SHALL compute `actionLabels` for `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` based on `activeTab` and, for Copy/Move/Duplicate/Share/Unshare/RemoveAccess/Info, `actionProfile`:

| Tab | Action | Gate |
|-----|--------|-------------------|
| `my_files` | Download | always |
| `my_files` | Delete | always |
| `my_files` | Rename | `uploadEnabled` (WRITE permission); available regardless of `actionProfile` |
| `my_files` | Copy | `uploadEnabled` AND `actionProfile !== Attach` |
| `my_files` | Move | `uploadEnabled` AND `actionProfile !== Attach` |
| `my_files` | Duplicate | `uploadEnabled` AND `actionProfile !== Attach` |
| `my_files` | Share (`ManagePermissions`) | item has `SHARE` permission AND `actionProfile === Full`; grid/tree only, no bulk toolbar entry |
| `my_files` | Remove access (`RemoveAccess`) | item path is in `sharedByMePaths` AND `actionProfile === Full`; available in grid, tree, and bulk toolbar |
| `my_files` | Info | row is a file (not folder) AND `actionProfile === Full`; grid only, no tree or bulk entry |
| `shared` | Download | always |
| `shared` | Unshare | item path is in `sharedWithMeIds` (root-level shared item) AND `actionProfile === Full`; available in grid, tree, and bulk toolbar |
| `shared` | Info | row is a file (not folder) AND `actionProfile === Full`; grid only |
| `organization` | Download | always |
| `organization` | Info | row is a file (not folder) AND `actionProfile === Full`; grid only |

Delete SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs even when the current folder has WRITE permission. Rename, Copy, Move, Duplicate, Share, and Remove access SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs. Unshare SHALL NOT appear in `actionLabels` for `my_files` or `organization` tabs. Info is the only action in this table available on all three tabs, since it is read-only.

Copy, Move, and Duplicate SHALL NOT appear in `actionLabels` when `actionProfile === DialFileManagerActionProfile.Attach`, regardless of tab or WRITE permission. Share, Unshare, Remove access, and Info SHALL NOT appear in `actionLabels` unless `actionProfile === DialFileManagerActionProfile.Full` — they are absent for both `Browse` and `Attach`. Rename and Delete remain profile-independent.

`isRenameFileAvailable` SHALL mirror `uploadEnabled` (unchanged; profile-independent).

Bulk toolbar `Remove access` visibility additionally requires every path in the current `selectedPaths` to be present in `sharedByMePaths` (see `file-manager-sharing` spec). `Info` never appears in `bulkActionsToolbarOptions.actionLabels` regardless of selection — the installed ui-kit exposes no bulk surface for it (see `file-manager-metadata` spec).

#### Scenario: My files shows Delete action

- **WHEN** the active tab is `my_files`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Delete`

#### Scenario: Shared tab hides Delete action

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Delete`

#### Scenario: Organization tab hides Delete action

- **WHEN** the active tab is `organization`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Delete`

#### Scenario: My files with WRITE shows Rename action regardless of profile

- **WHEN** the active tab is `my_files`, the current folder has WRITE permission, and `actionProfile` is `Attach`
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

#### Scenario: My files with WRITE and Browse profile shows Copy, Move, and Duplicate

- **WHEN** the active tab is `my_files`, the current folder has WRITE permission, and `actionProfile` is `Browse`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Copy`, `DialFileManagerActions.Move`, and `DialFileManagerActions.Duplicate`

#### Scenario: My files with WRITE and Attach profile hides Copy, Move, and Duplicate

- **WHEN** the active tab is `my_files`, the current folder has WRITE permission, and `actionProfile` is `Attach`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy`, `DialFileManagerActions.Move`, or `DialFileManagerActions.Duplicate`

#### Scenario: My files without WRITE hides Copy, Move, and Duplicate regardless of profile

- **WHEN** the active tab is `my_files` and the current folder does NOT have WRITE permission
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy`, `DialFileManagerActions.Move`, or `DialFileManagerActions.Duplicate`, even if `actionProfile` is `Browse`

#### Scenario: Shared tab hides Copy, Move, and Duplicate actions

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy`, `DialFileManagerActions.Move`, or `DialFileManagerActions.Duplicate`

#### Scenario: Organization tab hides Copy, Move, and Duplicate actions

- **WHEN** the active tab is `organization`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Copy`, `DialFileManagerActions.Move`, or `DialFileManagerActions.Duplicate`

#### Scenario: My files item with SHARE permission and Full profile shows Share action

- **WHEN** the active tab is `my_files`, the item has `SHARE` permission, and `actionProfile` is `Full`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.ManagePermissions`

#### Scenario: My files item with SHARE permission but Browse profile hides Share action

- **WHEN** the active tab is `my_files`, the item has `SHARE` permission, and `actionProfile` is `Browse`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.ManagePermissions`

#### Scenario: My files item in sharedByMePaths and Full profile shows Remove access

- **WHEN** the active tab is `my_files`, the item's path is in `sharedByMePaths`, and `actionProfile` is `Full`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.RemoveAccess`

#### Scenario: My files item not in sharedByMePaths hides Remove access regardless of profile

- **WHEN** the active tab is `my_files` and the item's path is NOT in `sharedByMePaths`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.RemoveAccess`, even if `actionProfile` is `Full`

#### Scenario: Shared tab root item and Full profile shows Unshare

- **WHEN** the active tab is `shared`, the item's path is in `sharedWithMeIds`, and `actionProfile` is `Full`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Unshare`

#### Scenario: Shared tab and Browse profile hides Unshare

- **WHEN** the active tab is `shared` and `actionProfile` is `Browse`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Unshare`

#### Scenario: my_files and organization tabs never show Unshare

- **WHEN** the active tab is `my_files` or `organization`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Unshare`, regardless of `actionProfile`

#### Scenario: Info shown for a file row on any tab with Full profile

- **WHEN** the row is a file (not folder) and `actionProfile` is `Full`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Info`, on `my_files`, `shared`, and `organization` alike

#### Scenario: Info hidden for folder rows regardless of profile

- **WHEN** the row's `nodeType` is `folder`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Info`, even if `actionProfile` is `Full`

#### Scenario: Info hidden when actionProfile is Browse or Attach

- **WHEN** `actionProfile` is `Browse` or `Attach`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Info`, regardless of tab or row type

---

### Requirement: Standalone page uses the Full action profile

`DialFileManagerPage` SHALL pass `actionProfile: DialFileManagerActionProfile.Full` to `useDialFileManager`. This is the final step of the #7504 roadmap: `Full` was introduced as a reserved, unused profile, then progressively defined by `add-file-manager-sharing` (Share/Unshare/Remove access), `add-file-manager-metadata-ui` (Info), and this change (upload-archive) — each of those three changes' actions now has a working handler, so the standalone page adopts `Full` in full, superseding its prior `Browse` assignment. `Full` is a strict superset of `Browse`: every action `Browse` exposed (Download, Delete, Rename, Copy, Move, Duplicate) remains available, with Share, Unshare, Remove access, Info, and upload-archive added on top.

#### Scenario: Standalone page shows the complete my_files matrix

- **WHEN** `DialFileManagerPage` renders `my_files` with WRITE permission and the item has `SHARE` permission
- **THEN** `actionLabels` includes Download, Delete, Rename, Copy, Move, Duplicate, Share, Remove access (if the item is in `sharedByMePaths`), and Info, and `toolbarOptions.newActions.uploadArchive` is present

#### Scenario: Attach modal remains unaffected

- **WHEN** `DialFileManagerModal` renders `my_files` with WRITE permission
- **THEN** `actionLabels` includes Download, Delete, and Rename, and does NOT include Copy, Move, Duplicate, Share, Remove access, Info, or the upload-archive toolbar entry — the attach modal's `actionProfile` remains `Attach`, unaffected by the standalone page's switch to `Full`

---

### Requirement: Per-tab upload and new folder rules

`DialFileManagerShell` SHALL pass `uploadEnabled` to `DialFileManager` based on `activeTab` and the current folder:

| Tab | `uploadEnabled` |
|-----|----------------|
| `my_files` | `true` when current folder has WRITE permission |
| `shared` | `false` at the shared root; `canWriteCurrentFolder` in nested shared folders |
| `organization` | Always `false` |

`isNewButtonDisabled` and `disabledNewButtonTooltip` in `toolbarOptions` SHALL reflect the same logic.

`toolbarOptions.newActions.uploadArchive` (label + icon) SHALL be populated only when `variant === DialFileManagerVariant.Standalone`, the active tab is `my_files`, the current folder has WRITE permission, and `actionProfile === DialFileManagerActionProfile.Full`. It SHALL be absent for the `shared`/`organization` tabs, for the attach modal (`variant === Attach`), and whenever `uploadEnabled` is `false`.

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

#### Scenario: Standalone my_files with WRITE and Full profile shows the upload-archive toolbar entry

- **WHEN** `variant` is `Standalone`, the active tab is `my_files`, the current folder has WRITE permission, and `actionProfile` is `Full`
- **THEN** `toolbarOptions.newActions.uploadArchive` is present

#### Scenario: Upload-archive toolbar entry hidden on shared and organization tabs

- **WHEN** the active tab is `shared` or `organization`
- **THEN** `toolbarOptions.newActions.uploadArchive` is `undefined`, regardless of `actionProfile`

#### Scenario: Upload-archive toolbar entry hidden in the attach modal

- **WHEN** `variant` is `Attach`
- **THEN** `toolbarOptions.newActions.uploadArchive` is `undefined`, regardless of `actionProfile`

#### Scenario: Upload-archive toolbar entry hidden without WRITE permission

- **WHEN** the active tab is `my_files` and the current folder does NOT have WRITE permission
- **THEN** `toolbarOptions.newActions.uploadArchive` is `undefined`, even if `actionProfile` is `Full`

---

### Requirement: sharedWithMeIds wired on Shared tab

When the active tab is `shared`, `DialFileManagerShell` SHALL pass the `sharedWithMeIds` prop to `DialFileManager` containing the root-level shared items returned by `GET /api/v1/files/shared`, converted to ui-kit's virtual `DialFile.path` format (e.g. `/Shared with me/reports/q1.pdf`) via `buildSharedItemVirtualPath` — not the DIAL Core resource path the BFF returns (see `file-manager-sharing` design D9). On all other tabs, `sharedWithMeIds` SHALL be `undefined`.

#### Scenario: sharedWithMeIds populated on Shared tab

- **WHEN** the active tab is `shared` and the listing returns items
- **THEN** `sharedWithMeIds` is an array of the root shared items' virtual UI paths

#### Scenario: sharedWithMeIds absent on My files tab

- **WHEN** the active tab is `my_files`
- **THEN** `sharedWithMeIds` is `undefined`

---

### Requirement: Selection cleared on tab switch

When `activeTab` changes, the set of `selectedPaths` SHALL be cleared (reset to an empty `Set`).

> **Implementation note:** on the standalone page the tab strip is replaced by the bulk-actions toolbar as soon as any item is selected, so `activeTab` cannot change while a non-empty selection is held. The requirement is trivially satisfied in that path; its primary purpose is to guard against programmatic tab changes (e.g. the active tab becomes unavailable and resets automatically) that could otherwise leave stale paths from the previous tab in `selectedPaths`.

#### Scenario: Selection cleared after programmatic tab reset

- **WHEN** the active tab is reset programmatically (e.g. the previously active tab is removed from `fileManagerTabs`) while files from the old tab were selected
- **THEN** `selectedPaths` is empty on the new active tab

#### Scenario: Selection empty when tab strip becomes reachable

- **WHEN** the user had a non-empty selection, clears it (deselecting all items), and then switches to the Shared tab
- **THEN** `selectedPaths` is empty on the Shared tab

---

### Requirement: Tab button accessibility

Each rendered tab button SHALL carry `role="tab"` and `aria-selected` (per ARIA spec). `aria-selected` SHALL be `true` for the currently active tab and `false` for all others. This requirement mirrors the pattern established in the `file-manager-toolbar` spec (#7932).

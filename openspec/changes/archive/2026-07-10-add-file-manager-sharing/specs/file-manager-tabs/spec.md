# Spec: file-manager-tabs (delta for add-file-manager-sharing)

## MODIFIED Requirements

### Requirement: Per-tab action labels

`DialFileManagerShell` SHALL compute `actionLabels` for `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` based on `activeTab` and, for Copy/Move/Duplicate/Share/Unshare/RemoveAccess, `actionProfile`:

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
| `shared` | Download | always |
| `shared` | Unshare | item path is in `sharedWithMeIds` (root-level shared item) AND `actionProfile === Full`; available in grid, tree, and bulk toolbar |
| `organization` | Download | always |

Delete SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs even when the current folder has WRITE permission. Rename, Copy, Move, Duplicate, Share, and Remove access SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs. Unshare SHALL NOT appear in `actionLabels` for `my_files` or `organization` tabs.

Copy, Move, and Duplicate SHALL NOT appear in `actionLabels` when `actionProfile === DialFileManagerActionProfile.Attach`, regardless of tab or WRITE permission. Share, Unshare, and Remove access SHALL NOT appear in `actionLabels` unless `actionProfile === DialFileManagerActionProfile.Full` — they are absent for both `Browse` and `Attach`. This is the only action-visibility rule in this table that depends on `actionProfile` besides the existing Copy/Move/Duplicate-vs-`Attach` rule; Rename and Delete remain profile-independent.

`isRenameFileAvailable` SHALL mirror `uploadEnabled` (unchanged; profile-independent).

Bulk toolbar `Remove access` visibility additionally requires every path in the current `selectedPaths` to be present in `sharedByMePaths` — a single selected item lacking share-by-me status hides the bulk action entirely (see `file-manager-sharing` spec, "Bulk Remove access visible only when every selected item is shared by me").

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

---

### Requirement: Standalone page uses the Browse action profile

`DialFileManagerPage` SHALL pass `actionProfile: DialFileManagerActionProfile.Browse` to `useDialFileManager`. `DialFileManagerActionProfile.Full` is now defined (by `file-manager-sharing`) as the profile that additionally exposes Share (`ManagePermissions`), Unshare, and Remove access on top of everything `Browse` already exposes; a later change (metadata popup / `Info`, and upload-archive) extends `Full`'s action set further. `DialFileManagerPage` SHALL NOT switch to `Full` as part of this change — the switch is deferred until every `Full`-gated action (Share/Unshare/Remove access from this change, Info and upload-archive from their respective follow-up changes) has a working handler, so the standalone page never exposes a `Full`-gated action with no implementation behind it.

#### Scenario: Standalone page shows the full my_files matrix

- **WHEN** `DialFileManagerPage` renders `my_files` with WRITE permission
- **THEN** `actionLabels` includes Download, Delete, Rename, Copy, Move, and Duplicate, and does NOT include Share or Remove access (still on `Browse`)

#### Scenario: Attach modal shows only Rename and Delete of the WRITE-gated actions

- **WHEN** `DialFileManagerModal` renders `my_files` with WRITE permission
- **THEN** `actionLabels` includes Download, Delete, and Rename, and does NOT include Copy, Move, Duplicate, Share, or Remove access

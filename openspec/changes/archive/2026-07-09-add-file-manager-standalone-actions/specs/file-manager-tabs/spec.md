## MODIFIED Requirements

### Requirement: Per-tab action labels

`DialFileManagerShell` SHALL compute `actionLabels` for `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` based on `activeTab` and, for Copy/Move/Duplicate only, `actionProfile`:

| Tab | Action | `my_files` gate |
|-----|--------|-------------------|
| `my_files` | Download | always |
| `my_files` | Delete | always |
| `my_files` | Rename | `uploadEnabled` (WRITE permission); available regardless of `actionProfile` |
| `my_files` | Copy | `uploadEnabled` AND `actionProfile !== Attach` |
| `my_files` | Move | `uploadEnabled` AND `actionProfile !== Attach` |
| `my_files` | Duplicate | `uploadEnabled` AND `actionProfile !== Attach` |
| `shared` | Download | always |
| `organization` | Download | always |

Delete SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs even when the current folder has WRITE permission. Rename, Copy, Move, and Duplicate SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs.

Copy, Move, and Duplicate SHALL NOT appear in `actionLabels` when `actionProfile === DialFileManagerActionProfile.Attach`, regardless of tab or WRITE permission. This is the only action-visibility rule in this table that depends on `actionProfile`; Rename and Delete are profile-independent.

`isRenameFileAvailable` SHALL mirror `uploadEnabled` (unchanged; profile-independent).

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

---

### Requirement: Standalone page uses the Browse action profile

`DialFileManagerPage` SHALL pass `actionProfile: DialFileManagerActionProfile.Browse` to `useDialFileManager`. `DialFileManagerActionProfile.Full` SHALL remain unused by any current host — it is reserved for a future change that extends the action set beyond this requirement's table (e.g. `#7504`'s Share/Unshare/Remove access/Info).

#### Scenario: Standalone page shows the full my_files matrix

- **WHEN** `DialFileManagerPage` renders `my_files` with WRITE permission
- **THEN** `actionLabels` includes Download, Delete, Rename, Copy, Move, and Duplicate

#### Scenario: Attach modal shows only Rename and Delete of the WRITE-gated actions

- **WHEN** `DialFileManagerModal` renders `my_files` with WRITE permission
- **THEN** `actionLabels` includes Download, Delete, and Rename, and does NOT include Copy, Move, or Duplicate

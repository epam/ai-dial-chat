## MODIFIED Requirements

### Requirement: Per-tab action labels

`DialFileManagerModal` SHALL compute `actionLabels` for `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` based on `activeTab`:

| Tab | Grid/bulk/tree actions |
|-----|------------------------|
| `my_files` | Download, Delete, Rename |
| `shared` | Download only |
| `organization` | Download only |

Delete SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs even when the current folder has WRITE permission.

Rename SHALL NOT appear in `actionLabels` for `shared` or `organization` tabs. On `my_files`, Rename SHALL be included only when `uploadEnabled` is `true` (WRITE permission on the current folder). `isRenameFileAvailable` SHALL mirror `uploadEnabled`.

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

# Spec: file-manager-tabs (delta for add-file-manager-upload-archive)

This delta builds on top of the `add-file-manager-sharing` and `add-file-manager-metadata-ui` deltas. Apply after both are archived; the requirement blocks below include the full cumulative state and are the final state of these requirements for the #7504 roadmap.

## MODIFIED Requirements

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

### Requirement: Standalone page uses the Full action profile

`DialFileManagerPage` SHALL pass `actionProfile: DialFileManagerActionProfile.Full` to `useDialFileManager`. This is the final step of the #7504 roadmap: `Full` was introduced as a reserved, unused profile, then progressively defined by `add-file-manager-sharing` (Share/Unshare/Remove access), `add-file-manager-metadata-ui` (Info), and this change (upload-archive) — each of those three changes' actions now has a working handler, so the standalone page adopts `Full` in full, superseding its prior `Browse` assignment. `Full` is a strict superset of `Browse`: every action `Browse` exposed (Download, Delete, Rename, Copy, Move, Duplicate) remains available, with Share, Unshare, Remove access, Info, and upload-archive added on top.

#### Scenario: Standalone page shows the complete my_files matrix

- **WHEN** `DialFileManagerPage` renders `my_files` with WRITE permission and the item has `SHARE` permission
- **THEN** `actionLabels` includes Download, Delete, Rename, Copy, Move, Duplicate, Share, Remove access (if the item is in `sharedByMePaths`), and Info, and `toolbarOptions.newActions.uploadArchive` is present

#### Scenario: Attach modal remains unaffected

- **WHEN** `DialFileManagerModal` renders `my_files` with WRITE permission
- **THEN** `actionLabels` includes Download, Delete, and Rename, and does NOT include Copy, Move, Duplicate, Share, Remove access, Info, or the upload-archive toolbar entry — the attach modal's `actionProfile` remains `Attach`, unaffected by the standalone page's switch to `Full`

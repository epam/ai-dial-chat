## MODIFIED Requirements

### Requirement: Upload dialog opens from "Upload from device" and supports drag-and-drop plus click-to-browse

`libs/skill-editor` SHALL open a dialog (a responsive centered modal at every breakpoint — a bottom-sheet deviation for `mobile` was considered but rejected because the ui kit's `Popup` has no sheet variant, documented in design.md) when an Add entry that stages files is activated: **Upload files from device** opens it in files mode, **Upload archive from device** opens it in archive mode (`SkillFileUploadMode.Archive`), and a resolved **Open DIAL file system** pick opens it in files mode pre-staged with the picked entries. The dialog SHALL contain a drop zone that accepts a file-bearing drag from anywhere over the zone and, on drop, stages every dropped file (in archive mode: every entry of every dropped `.zip`, as resolved by `fileActions.extractArchive`); clicking the drop zone SHALL open the native OS file picker configured for multiple selection (in archive mode: restricted to `.zip`). The dialog SHALL remain open and accept additional drags/drops or additional picker selections until the user confirms or cancels.

#### Scenario: Activating "Upload files from device" opens the dialog
- **WHEN** a user activates Add → Upload files from device
- **THEN** the upload dialog opens in files mode, showing an empty drop zone and no staged files

#### Scenario: Activating "Upload archive from device" opens the archive dialog
- **WHEN** a user activates Add → Upload archive from device
- **THEN** the upload dialog opens in archive mode with the archive title and drop-zone copy, and its picker accepts `.zip`

#### Scenario: Dropping files stages them
- **WHEN** a user drags one or more files over the drop zone and drops them
- **THEN** every dropped file appears as a staged row in the dialog, and the browser does not navigate to any dropped file

#### Scenario: Clicking the drop zone opens the native picker with multi-select enabled
- **WHEN** a user clicks the drop zone
- **THEN** the native file picker opens allowing more than one file to be selected at once

#### Scenario: Dropping files anywhere on the editor surface opens the dialog and stages them
- **WHEN** a user drags files from their device and drops them anywhere on the Skill Editor surface without first activating an Add entry
- **THEN** the upload dialog opens in files mode, targeting the root, and every dropped file is immediately staged, with no separate click required first

#### Scenario: A page-wide drop while the dialog is already open does not reopen it
- **WHEN** the upload dialog is already open and a user drops files inside its own drop zone
- **THEN** the files are staged into the same open dialog exactly once, not staged twice or via a second dialog instance

### Requirement: Candidate paths are resolved from File objects and normalized

For each selected or dropped `File`, the dialog SHALL resolve a candidate path using `webkitRelativePath` when the browser populates it (non-empty), falling back to `File.name` otherwise; for a host-supplied `SkillFileSourceEntry` (archive entry or DIAL file-system pick) it SHALL use the entry's `path`. It SHALL normalize any backslash separators in the resolved path to forward slashes, and, when the dialog was opened with a non-root `targetFolderPath`, prefix the result with `<targetFolderPath>/`, before it is ever passed to host validation.

#### Scenario: A plain file drop resolves to its file name
- **WHEN** a single file with no `webkitRelativePath` is dropped at the root
- **THEN** its resolved candidate path equals `File.name`

#### Scenario: A relative-path-bearing file normalizes separators
- **WHEN** a `File` object's `webkitRelativePath` (or, on a platform that reports backslashes, its `name`) contains a backslash
- **THEN** the resolved candidate path uses only forward slashes

#### Scenario: A target folder prefixes the path
- **WHEN** the dialog was opened with `targetFolderPath="docs"` and `a.md` is dropped
- **THEN** its resolved candidate path is `docs/a.md`

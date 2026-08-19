## MODIFIED Requirements

### Requirement: Adding and removing supporting files and folders
`SkillEditor` SHALL expose a single "Upload from device" control that opens the upload dialog (specified by the `skill-file-drag-drop` capability) as the only way to add a supporting file — a user may stage one or more files in that dialog via drag-and-drop or the native file picker, review them, and commit the whole valid batch at once, rather than a single file being added directly on selection. Validation SHALL be performed through a host-supplied `fileActions.validateBatch` callback (returning per-candidate and batch-level results) and commit SHALL be performed through a host-supplied `fileActions.commitBatch` callback, so the app boundary's path-safety, size, count, and duplicate-detection rules apply without the library encoding any DIAL-specific policy itself. The library SHALL NOT offer any control for creating a new empty file or an empty folder — folder nodes are inferred only from the paths of existing files (own or previously loaded), never created directly. Removing an already-committed supporting file or folder from the editor's tree (as opposed to removing a not-yet-committed staged candidate inside the upload dialog) SHALL happen immediately on the Remove action, with no confirmation step — the entry SHALL be removed from local state and the host-supplied removal callback invoked synchronously when Remove is activated.

#### Scenario: Uploading files from the device adds them as supporting files
- **WHEN** a user activates "Upload from device", stages one or more local files in the resulting dialog, and confirms
- **THEN** `fileActions.commitBatch` is called with the staged batch and, on success, a corresponding node appears in the tree for each committed file

#### Scenario: A rejected batch shows inline errors and commits nothing
- **WHEN** every candidate in the staged batch fails `fileActions.validateBatch`
- **THEN** the library shows each candidate's error inline in the dialog and does not call `fileActions.commitBatch`

#### Scenario: No control exists to create an empty file or folder
- **WHEN** a host renders `SkillEditor`
- **THEN** no "New file" or "New folder" action is present anywhere in the Add control, the upload dialog, or elsewhere in the files pane

#### Scenario: Removing a committed supporting entry happens immediately, with no confirmation
- **WHEN** a user triggers the Remove action on a non-`SKILL.md` node already present in the editor's file tree
- **THEN** the entry is removed from the tree immediately, the host's removal callback is invoked with that entry's path, and no confirmation prompt is shown

#### Scenario: Removing a staged (not yet committed) candidate needs no such confirmation
- **WHEN** a user removes a row from the still-open upload dialog's staged list before confirming the batch
- **THEN** the candidate is removed immediately, with no separate confirmation step, since nothing has been added to the editor's tree yet

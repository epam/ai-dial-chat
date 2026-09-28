## ADDED Requirements

### Requirement: Add dropdown in the Files pane header

`SkillEditor` SHALL render an **Add** control in the Files pane header as a ui-kit `ButtonDropdown`, whose menu lists, in this order, **Create folder**, **Upload files from device**, **Upload archive from device** and **Open DIAL file system**. An entry SHALL be rendered only when its host capability is supplied: Create folder requires `fileActions.onCreateFolder`, Upload archive requires `fileActions.extractArchive`, Open DIAL file system requires `fileActions.pickFromFileSystem`; Upload files from device is always present. The trigger SHALL expose `aria-haspopup="menu"` and `aria-expanded`, and the menu SHALL be operable by keyboard (the ui-kit `Dropdown` supplies the `menu`/`menuitem` roles and arrow-key handling). The library SHALL own the state (which dialog is open, draft folder, target folder) inside `SkillEditor`; no new context is introduced.

Labels (each with an English default): `addLabel` ("Add"), `createFolderLabel` ("Create folder"), `uploadFilesLabel` ("Upload files from device"), `uploadArchiveLabel` ("Upload archive from device"), `openFileSystemLabel` ("Open DIAL file system"). App i18n keys: "Add" reuses `ButtonsI18nKeys.Add`, "Upload files from device" reuses `skillEditor.uploadDialogTitle`; new `skillEditor.createFolder`, `skillEditor.uploadArchive`, `skillEditor.openFileSystem`. The superseded `skillEditor.addUploadLabel` / `skillEditor.removeLabel` keys are removed.

#### Scenario: Full menu when the host supplies every capability
- **WHEN** a host passes `onCreateFolder`, `extractArchive` and `pickFromFileSystem` and the user opens the Add dropdown
- **THEN** the menu lists Create folder, Upload files from device, Upload archive from device and Open DIAL file system, and the trigger reports `aria-expanded="true"`

#### Scenario: Entries without a host capability are hidden
- **WHEN** a host passes only `validateBatch`, `commitBatch` and `onRemoveNode`
- **THEN** the Add menu lists only Upload files from device

#### Scenario: Upload files from device opens the existing dialog
- **WHEN** the user activates Upload files from device
- **THEN** the upload dialog opens in files mode with nothing staged

### Requirement: Target folder of an add action

Every add action SHALL resolve a **target folder** path (`''` for the skill root). From the header Add dropdown the target SHALL be the selected node when it is a folder, and the root otherwise (including when `SKILL.md` or a supporting file is selected). From a node's **Add child** submenu the target SHALL be that folder; from **Add sibling** it SHALL be the node's parent folder (root for a top-level node). Files staged by any add action SHALL have their resolved relative path prefixed with `<target>/` when the target is not the root; a folder created by Create folder SHALL be created at `<target>/<name>`.

#### Scenario: Header upload with a folder selected
- **WHEN** the folder `docs` is selected and the user uploads `a.md` from the header Add dropdown
- **THEN** the staged candidate path is `docs/a.md`

#### Scenario: Header upload with a file selected
- **WHEN** the supporting file `docs/a.md` is selected and the user uploads `b.md` from the header Add dropdown
- **THEN** the staged candidate path is `b.md`

#### Scenario: Add sibling of a nested file
- **WHEN** the user chooses Add sibling → Upload files from device on `docs/a.md` and stages `c.md`
- **THEN** the staged candidate path is `docs/c.md`

### Requirement: Per-node context menu

For every node other than `SKILL.md`, `getContextMenuItems` SHALL return, in this order: **Add child** (folders only), **Add sibling**, and **Delete**. Add child and Add sibling SHALL each be a submenu (`DropdownItem.children`) containing the same entries the header Add dropdown would show, targeting the folder defined by the target-folder rule. Delete SHALL behave as today's Remove: the node (and, for a folder, everything under it) is removed immediately with no confirmation and `fileActions.onRemoveNode(path)` is called; a removed selection falls back to `SKILL.md`. `SKILL.md` SHALL keep returning an empty menu. Labels: `addChildLabel` ("Add child"), `addSiblingLabel` ("Add sibling"), `deleteLabel` ("Delete", falling back to the deprecated `removeLabel` when only that is supplied). App keys: `skillEditor.addChild`, `skillEditor.addSibling`; Delete reuses `ButtonsI18nKeys.Delete`.

#### Scenario: Folder menu
- **WHEN** the user opens the context menu of a folder node
- **THEN** it lists Add child, Add sibling and Delete

#### Scenario: File menu
- **WHEN** the user opens the context menu of a supporting-file node
- **THEN** it lists Add sibling and Delete, and no Add child

#### Scenario: SKILL.md stays protected
- **WHEN** the user opens the context menu of `SKILL.md`
- **THEN** no menu is offered

#### Scenario: Delete removes a folder subtree
- **WHEN** the user activates Delete on folder `docs` containing `docs/a.md`
- **THEN** `fileActions.onRemoveNode('docs')` is called once and no confirmation is shown

### Requirement: Inline folder creation

Activating Create folder SHALL insert a draft folder node under the target folder, expand the target folder, and render the draft in `DialFoldersTree`'s inline rename state (via `renamedPath`) prefilled with `newFolderDefaultName` ("New folder"). Confirming SHALL call `fileActions.onCreateFolder(<target>/<name>)` with the trimmed name, remove the draft and select the new folder. Cancelling (Escape) SHALL remove the draft with no host call. Before confirming, the name SHALL be validated in this order, with the first failing message shown inline: empty after trim → `folderNameRequiredError` ("Enter a folder name"); contains `/` or `\`, or equals `.` or `..` → `folderNameInvalidError` ("Folder name can't contain / or \\, or be . or .."); equals the name of an existing sibling file or folder, or `SKILL.md` at the root → `folderNameDuplicateError` ("An item with this name already exists here"); otherwise the message returned by the optional `fileActions.validateFolderPath(<target>/<name>)`. Only one draft SHALL exist at a time; starting another Create folder replaces it. The draft SHALL NOT affect the dirty state until committed.

App keys: `skillEditor.newFolderDefaultName`, `skillEditor.folderNameRequired`, `skillEditor.folderNameInvalid`, `skillEditor.folderNameDuplicate`; the host's `validateFolderPath` reuses `skillEditor.error.pathInvalid`.

#### Scenario: Creating a root folder
- **WHEN** nothing but `SKILL.md` is selected, the user chooses Create folder, types `scripts` and confirms
- **THEN** `fileActions.onCreateFolder('scripts')` is called and, once the host adds the node, `scripts` is selected

#### Scenario: Creating a nested folder
- **WHEN** the user chooses Add child → Create folder on `docs`, types `img` and confirms
- **THEN** `docs` is expanded and `fileActions.onCreateFolder('docs/img')` is called

#### Scenario: Duplicate name is rejected
- **WHEN** a sibling named `docs` exists and the user confirms the name `docs`
- **THEN** `folderNameDuplicateError` is shown inline and `onCreateFolder` is not called

#### Scenario: Cancelling leaves the tree unchanged
- **WHEN** the user presses Escape on the draft folder
- **THEN** the draft disappears and no host callback is invoked

### Requirement: Uploading an archive

Activating Upload archive from device SHALL open the upload dialog in archive mode (`SkillFileUploadMode.Archive`): the drop zone and native picker accept `.zip` files, the title is `uploadArchiveDialogTitle` ("Upload archive from device") and the drop-zone copy is `uploadArchiveDropZoneLabel` / `uploadArchiveDropZoneMobileLabel`. Each selected archive SHALL be passed to `fileActions.extractArchive(file)`, which resolves with `SkillFileSourceEntry[]` (`{ path, file }`, `path` relative to the archive root); each entry SHALL be staged as a candidate at `<target>/<path>` and then validated and committed through the unchanged `validateBatch` / `commitBatch` contract, so invalid entries show the same per-row errors as a device upload. While extraction runs the dialog SHALL show a busy state and disable Confirm. If `extractArchive` rejects, the dialog SHALL announce `uploadArchiveErrorMessage` ("Couldn't read this archive") in its `role="alert"` error region and stage nothing from that archive; if it resolves with no entries the dialog SHALL show `uploadArchiveEmptyMessage` ("This archive has no files").

App keys: the title reuses `skillEditor.uploadArchive`; `skillEditor.uploadArchiveDropZone`, `skillEditor.uploadArchiveDropZoneMobile`, `skillEditor.uploadArchiveError`, `skillEditor.uploadArchiveEmpty`, `skillEditor.uploadArchiveExtractingAriaLabel`.

#### Scenario: Archive structure is preserved
- **WHEN** the user uploads an archive containing `refs/a.md` and `b.py` while `docs` is the target
- **THEN** candidates `docs/refs/a.md` and `docs/b.py` are staged and validated via `validateBatch`

#### Scenario: A root SKILL.md inside the archive
- **WHEN** an archive uploaded at the root contains `SKILL.md`
- **THEN** it is staged as a manifest-kind candidate exactly as a dropped `SKILL.md` would be

#### Scenario: A corrupt archive
- **WHEN** `extractArchive` rejects
- **THEN** the dialog shows `uploadArchiveErrorMessage` and stages nothing

### Requirement: Host archive expansion

`useSkillFileActions` SHALL return `fileActions.extractArchive`, which reads the `.zip` with `fflate` and resolves one entry per file, with `/`-normalized paths as stored in the archive. Directory entries, `__MACOSX/` entries and `.DS_Store` files SHALL be skipped. Each entry's `File` SHALL carry the entry's base name and a MIME type inferred from its extension where known. A non-zip or corrupt input SHALL reject. Path safety, size and count limits SHALL NOT be re-implemented here — they apply through `validateBatch`.

#### Scenario: Junk entries are skipped
- **WHEN** an archive contains `a.md`, `dir/`, `__MACOSX/._a.md` and `.DS_Store`
- **THEN** `extractArchive` resolves with exactly one entry, `a.md`

#### Scenario: Unsafe paths reach validation
- **WHEN** an archive contains `../evil.sh`
- **THEN** the entry is returned and the dialog marks its staged row with the `pathInvalid` error from `validateBatch`

### Requirement: Picking files from the DIAL file system

Activating Open DIAL file system SHALL call `fileActions.pickFromFileSystem()`. When it resolves with a non-empty `SkillFileSourceEntry[]`, the library SHALL open the upload dialog in files mode with those entries staged at `<target>/<path>`; when it resolves `undefined` or `[]` (cancelled) nothing SHALL change. The library SHALL NOT know buckets, DIAL paths or routes. The app page SHALL implement the callback by opening the lazy-loaded `DialFileManagerModal` for the user's bucket, and on Attach download each selected file with `downloadFile(bucket, path)` (parsing `files/{bucket}/{path}` from the `DialFile`'s `url`/`id`) into a `File` named after the DIAL file and resolving with `{ path: name, file }`. Picked folders SHALL be ignored (`canAttachFolders` is off). The modal closes on Attach (`DialFileManagerModal` has no busy state to hold it open) and the upload dialog opens once every download has finished; a failed download SHALL raise an error notification (`skillEditor.fileSystemDownloadError`, "Couldn't copy files from the DIAL file system") and resolve `undefined`.

#### Scenario: Picked files are staged
- **WHEN** the host resolves `pickFromFileSystem` with `[{ path: 'notes.md', file }]` while the root is the target
- **THEN** the upload dialog opens with `notes.md` staged and validated

#### Scenario: Cancelling the picker
- **WHEN** the user closes the file-manager modal without attaching
- **THEN** `pickFromFileSystem` resolves `undefined` and the dialog does not open

### Requirement: Empty folders are editor-only

A folder node created through Create folder SHALL render, be selectable, receive uploads and be deletable, and SHALL make the form dirty. It SHALL NOT be persisted on its own: saving sends only files (`buildSkillFilesPayload`), so a folder still empty at Save is absent after reload. `useSkillFileActions.onCreateFolder` SHALL add a `SkillFileNodeKind.Folder` node and SHALL ignore a path that already exists.

#### Scenario: A created folder is dirtying
- **WHEN** a clean form creates folder `docs`
- **THEN** `onDirtyChange(true)` fires

#### Scenario: Duplicate host call is a no-op
- **WHEN** `onCreateFolder('docs')` is called while `docs` already exists
- **THEN** `files` is unchanged

### Requirement: Responsive, RTL and accessibility

The Add dropdown and node menus SHALL render inside the Files pane on desktop and inside the mobile Files accordion, using only logical Tailwind properties. No directional icon is introduced (plus, folder-plus, upload, archive and database icons are symmetric and SHALL NOT be mirrored; submenu chevrons are the ui-kit's own). Every Tabler icon SHALL pass `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`. The inline folder-name error SHALL be exposed by `DialFoldersTree`'s rename field. The feature is not gated behind `ENABLED_FEATURES`; it ships with the Skill Editor route. No telemetry is added.

#### Scenario: Keyboard-only Create folder
- **WHEN** a keyboard user focuses Add, presses Enter, arrows to Create folder, presses Enter, types a name and presses Enter
- **THEN** the folder is created without using a pointer

## ADDED Requirements

### Requirement: Empty folders persist through a folder marker

A folder node created through Create folder SHALL render, be selectable, receive uploads and be deletable, and SHALL make the form dirty. `useSkillFileActions.onCreateFolder` SHALL add a `SkillFileNodeKind.Folder` node and SHALL ignore a path that already exists. The editor state (`files`, owned by the app page through `useSkillEditorLoad`/`useSkillFileActions`) SHALL hold only the folder node — never a marker file node — and `filesContentRef` SHALL hold no entry for it.

At save time, `buildSkillFilesPayload` (`libs/chat-hooks/src/skill/skill.ts`) SHALL append exactly one zero-byte supporting entry at `<folderPath>/.dial_folder` (the marker name is `HIDDEN_FILE` from `@epam/ai-dial-chat-shared`) for every `SkillFileNodeKind.Folder` node that has no other node — file or folder — whose path starts with `<folderPath>/`. A folder with any descendant SHALL NOT get a marker. Marker entries SHALL follow every real file entry in `filePaths`/`files`, keeping the positional pairing. `libs/skill-editor` SHALL NOT know the marker name.

Because every save replaces the whole skill, a folder that gained a file or was deleted SHALL leave no marker behind after its next save.

#### Scenario: A created folder is dirtying
- **WHEN** a clean form creates folder `docs`
- **THEN** `onDirtyChange(true)` fires

#### Scenario: Duplicate host call is a no-op
- **WHEN** `onCreateFolder('docs')` is called while `docs` already exists
- **THEN** `files` is unchanged

#### Scenario: An empty folder is saved as a marker
- **WHEN** `buildSkillFilesPayload` receives a file node `a.md` and a folder node `docs` with no descendants
- **THEN** `filePaths` is `['a.md', 'docs/.dial_folder']` and the second blob has size `0`

#### Scenario: Only the deepest empty folder gets a marker
- **WHEN** the tree has folder nodes `a` and `a/b` and no files under `a`
- **THEN** `filePaths` contains `a/b/.dial_folder` and does not contain `a/.dial_folder`

#### Scenario: A folder with a file gets no marker
- **WHEN** the tree has folder node `docs` and file node `docs/readme.md`
- **THEN** `filePaths` is `['docs/readme.md']`

#### Scenario: An empty folder survives Save and reload
- **WHEN** the user creates folder `docs`, leaves it empty, saves, and re-opens the skill
- **THEN** the editor tree shows an empty `docs` folder and no `.dial_folder` row

### Requirement: The folder marker name is reserved for user input

The client mirror `isValidSkillRelativePath` (`libs/chat-hooks/src/skill/skill.ts`) SHALL reject any path with a `.dial_folder` segment, in addition to `.dial-resource`/`.dial-folder`. It therefore rejects a staged upload or a typed folder name equal to `.dial_folder` through the existing `validateBatch` `pathInvalid` message and `validateFolderPath`. Generated markers SHALL NOT pass through this validator.

#### Scenario: Uploading a file named `.dial_folder` is rejected
- **WHEN** the user stages a file at `docs/.dial_folder`
- **THEN** `validateBatch` marks the row with the `pathInvalid` error and it is not committed

#### Scenario: Naming a folder `.dial_folder` is rejected
- **WHEN** the user types `.dial_folder` as a new folder name
- **THEN** `validateFolderPath` rejects it and no folder node is added

## MODIFIED Requirements

### Requirement: Host archive expansion

`useSkillFileActions` SHALL return `fileActions.extractArchive`, which reads the `.zip` with `fflate` and resolves one entry per file, with `/`-normalized paths as stored in the archive. Directory entries, `__MACOSX/` entries, `.DS_Store` files and `.dial_folder` folder markers SHALL be skipped. Each entry's `File` SHALL carry the entry's base name and a MIME type inferred from its extension where known. A non-zip or corrupt input SHALL reject. Path safety, size and count limits SHALL NOT be re-implemented here — they apply through `validateBatch`.

#### Scenario: Junk entries are skipped
- **WHEN** an archive contains `a.md`, `dir/`, `__MACOSX/._a.md`, `.DS_Store` and `docs/.dial_folder`
- **THEN** `extractArchive` resolves with exactly one entry, `a.md`

#### Scenario: Unsafe paths reach validation
- **WHEN** an archive contains `../evil.sh`
- **THEN** the entry is returned and the dialog marks its staged row with the `pathInvalid` error from `validateBatch`

## REMOVED Requirements

### Requirement: Empty folders are editor-only
**Reason**: Empty folders are now kept through a `.dial_folder` marker written at save time.
**Migration**: See "Empty folders persist through a folder marker". Skills saved before this change have no markers and load unchanged.

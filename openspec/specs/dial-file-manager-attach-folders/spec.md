## ADDED Requirements

### Requirement: Folder rows are selectable when canAttachFolders is enabled

When `canAttachFolders` is `true`, `DialFileManagerModal` SHALL allow selection of `DialFileNodeType.FOLDER` rows in the grid. The `isRowSelectable` predicate SHALL return `true` for folder rows, except for hidden-path folders (which remain non-selectable regardless of `canAttachFolders`).

When `canAttachFolders` is `false` (the default), folder rows SHALL remain non-selectable — this preserves current behavior.

The `filesByPath` map inside the modal SHALL be extended to also index `DialFileNodeType.FOLDER` nodes so folder selections can be resolved to `DialFile` items.

RTL: none
Feature flag: none — controlled by the `canAttachFolders` prop
Memoisation: `isRowSelectable` inside `useMemo` grid options; `filesByPath` in `useMemo`.

#### Scenario: Folder row selectable when canAttachFolders is true

- **WHEN** `canAttachFolders` is `true` and a non-hidden folder row is rendered
- **THEN** `isRowSelectable` returns `true` for that folder row

#### Scenario: Folder row not selectable when canAttachFolders is false

- **WHEN** `canAttachFolders` is `false` (default) and a folder row is rendered
- **THEN** `isRowSelectable` returns `false` for that folder row

#### Scenario: Hidden folder is never selectable even with canAttachFolders

- **WHEN** `canAttachFolders` is `true` and a folder row has a hidden path (contains `.dial_folder`)
- **THEN** `isRowSelectable` returns `false`

---

### Requirement: onAttach returns both files and folder paths

`DialFileManagerModal` SHALL change the `onAttach` callback signature from `(files: DialFile[]) => void` to `(result: AttachResult) => void` where:

```ts
interface AttachResult {
  files: DialFile[];
  folderPaths: string[];
}
```

When `canAttachFolders` is `false`, `folderPaths` SHALL always be an empty array (`[]`).

`useDialFileManagerState.handleAttach` SHALL be updated to accept `AttachResult` and forward `folderPaths` to call sites. Conversion of folder paths to `Attachment` objects is deferred to a follow-up (folder attachments are not yet part of the conversation model).

`ConversationRoute.handleAttachDialFiles` and `ConversationView.handleAttachDialFiles` SHALL both be updated to accept `AttachResult` and pass `result.files` to `dialFilesToAttachments`.

RTL: none
Feature flag: none
Memoisation: `handleAttach` in `useCallback` inside `DialFileManagerModal`.

#### Scenario: files-only attach when canAttachFolders is false

- **WHEN** `canAttachFolders` is `false` and user selects 2 files and clicks Attach
- **THEN** `onAttach` is called with `{ files: [file1, file2], folderPaths: [] }`

#### Scenario: mixed attach when canAttachFolders is true

- **WHEN** `canAttachFolders` is `true`, user selects 1 folder and 1 file, and clicks Attach
- **THEN** `onAttach` is called with `{ files: [file1], folderPaths: ['path/to/folder'] }`

---

### Requirement: Parent-folder dedup removes nested selections

When `canAttachFolders` is `true` and the user selects both a folder and a file (or nested folder) that is inside that folder, `DialFileManagerModal` SHALL remove the nested item from the result. Only the highest-level (outermost) selected folder in any given ancestry chain is kept.

Dedup logic: a selected item (file or folder) is excluded from the result if any other selected folder path is a proper prefix of its path. A "proper prefix" check uses a trailing `/` separator to avoid false matches (e.g., `files/bucket/foo/` must not match `files/bucket/foobar/file.txt`).

This dedup runs inside `handleAttach` in `DialFileManagerModal` before calling `onAttach`.

RTL: none
Feature flag: none
Memoisation: dedup runs inside `handleAttach` (in `useCallback`), not on every render.

#### Scenario: Nested file removed when parent folder selected

- **WHEN** user selects folder `files/bucket/images/` and file `files/bucket/images/photo.jpg`
- **THEN** `onAttach` receives `folderPaths: ['files/bucket/images/']` and `files: []`

#### Scenario: Nested folder removed when parent folder selected

- **WHEN** user selects folder `files/bucket/docs/` and nested folder `files/bucket/docs/2024/`
- **THEN** `onAttach` receives `folderPaths: ['files/bucket/docs/']` only

#### Scenario: Sibling folders are both kept

- **WHEN** user selects `files/bucket/images/` and `files/bucket/docs/`
- **THEN** `onAttach` receives both folder paths with no dedup

#### Scenario: Path prefix false-match does not occur

- **WHEN** user selects folder `files/bucket/foo/` and file `files/bucket/foobar/file.txt`
- **THEN** `files/bucket/foobar/file.txt` is NOT excluded (different path branch)

---

### Requirement: canAttachFolders derived from selected deployment at call sites

`ConversationRoute` and `ConversationView` SHALL read `selectedDeployment?.features?.folderAttachments` and pass it as `canAttachFolders` to `DialFileManagerModal`. When `folderAttachments` is absent or `false` on the selected deployment, `canAttachFolders` SHALL default to `false`.

State ownership: `DeploymentsContext` selected deployment state (existing); no new state introduced at the call sites.
Feature flag: `features.folderAttachments` from the selected deployment object, mapped from DIAL Core `features.folder_attachments`.
RTL: none.
Memoisation: none required — value is read from the selected deployment object.

#### Scenario: canAttachFolders true when selected deployment enables it

- **WHEN** `selectedDeployment?.features?.folderAttachments` is `true`
- **THEN** `DialFileManagerModal` receives `canAttachFolders={true}`

#### Scenario: canAttachFolders false when selected deployment omits the flag

- **WHEN** `selectedDeployment` is absent or does not include `features.folderAttachments`
- **THEN** `DialFileManagerModal` receives `canAttachFolders={false}` (default)

---

### Requirement: handleAttachDialFiles forwards folderPaths as folder Attachments

Both `ConversationRoute.handleAttachDialFiles` and `ConversationView.handleAttachDialFiles` SHALL accept `AttachResult` and map `result.folderPaths` to `Attachment` objects with `type: AttachmentType.File` (equivalent to how `dialFilesToAttachments` maps files to attachments). DIAL Core resolves folder contents server-side regardless of client-side attachment type value. The resulting folder attachments SHALL be merged with file attachments before being added to the conversation.

RTL: none.
Feature flag: none — behavior is conditional on `folderPaths.length > 0`.
Memoisation: both handlers are `useCallback`; add `folderPaths` mapping inside the existing callback.

#### Scenario: File-only attach result — folderPaths empty

- **WHEN** `handleAttachDialFiles` receives `{ files: [file1], folderPaths: [] }`
- **THEN** only `file1` is added as an attachment; no folder attachments are created

#### Scenario: Mixed attach result — files and folders

- **WHEN** `handleAttachDialFiles` receives `{ files: [file1], folderPaths: ['bucket/docs/'] }`
- **THEN** both `file1` and a folder attachment for `'bucket/docs/'` are added to the conversation

#### Scenario: Folder-only attach result

- **WHEN** `handleAttachDialFiles` receives `{ files: [], folderPaths: ['bucket/images/'] }`
- **THEN** a folder attachment for `'bucket/images/'` is added and no file attachments are created

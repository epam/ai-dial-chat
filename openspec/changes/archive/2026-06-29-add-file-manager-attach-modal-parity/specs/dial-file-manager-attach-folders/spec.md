## ADDED Requirements

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

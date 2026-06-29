## ADDED Requirements

### Requirement: canAttachFolders derived from client config at call sites

`ConversationRoute` and `ConversationView` SHALL read `attachFolders` from the `useClientConfig()` context hook and pass it as `canAttachFolders` to `DialFileManagerModal`. When `attachFolders` is absent or `false` in the client config, `canAttachFolders` SHALL default to `false`.

State ownership: `useClientConfig` context (existing); no new state introduced at the call sites.
Feature flag: `features.attachFolders` from `/api/v1/client-config` response.
RTL: none.
Memoisation: none required — value is a stable boolean from context.

#### Scenario: canAttachFolders true when client config enables it

- **WHEN** `useClientConfig()` returns `{ features: { attachFolders: true } }`
- **THEN** `DialFileManagerModal` receives `canAttachFolders={true}`

#### Scenario: canAttachFolders false when client config omits the flag

- **WHEN** `useClientConfig()` returns a config object without `features.attachFolders`
- **THEN** `DialFileManagerModal` receives `canAttachFolders={false}` (default)

---

### Requirement: handleAttachDialFiles forwards folderPaths as folder Attachments

Both `ConversationRoute.handleAttachDialFiles` and `ConversationView.handleAttachDialFiles` SHALL accept `AttachResult` and map `result.folderPaths` to `Attachment` objects with `type: 'folder'` (equivalent to how `dialFilesToAttachments` maps files to attachments). The resulting folder attachments SHALL be merged with file attachments before being added to the conversation.

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

## MODIFIED Requirements

### Requirement: onAttach returns both files and folder paths

`DialFileManagerModal` SHALL expose an `onAttach` callback of signature `(result: AttachResult) => void`, where `AttachResult` is exported from `@epam/ai-dial-chat-shared` (`libs/chat-shared/src/file-manager/attach-result.ts`; the app imports it from there and keeps no local copy):

```ts
interface AttachResult {
  files: DialFile[];
  folderPaths: string[];
}
```

When `canAttachFolders` is `false`, `folderPaths` SHALL always be an empty array (`[]`).

`useDialFileManagerState.handleAttach` (`apps/chat/src/hooks/files/useDialFileManagerState.ts`) SHALL accept `AttachResult` and pass `result.files` to `dialFilesToAttachments`. It is the single attach handler: `NewConversationComposer` and `ConversationView` both destructure it as `handleAttachDialFiles`, and neither defines its own.

RTL: none
Feature flag: none
Memoisation: `handleAttach` in `useCallback` inside `FileManagerAttachModal`.

#### Scenario: files-only attach when canAttachFolders is false

- **WHEN** `canAttachFolders` is `false` and user selects 2 files and clicks Attach
- **THEN** `onAttach` is called with `{ files: [file1, file2], folderPaths: [] }`

#### Scenario: mixed attach when canAttachFolders is true

- **WHEN** `canAttachFolders` is `true`, user selects 1 folder and 1 file, and clicks Attach
- **THEN** `onAttach` is called with `{ files: [file1], folderPaths: ['path/to/folder'] }`

### Requirement: handleAttachDialFiles forwards folderPaths as folder Attachments

`useDialFileManagerState.handleAttach` — the `handleAttachDialFiles` used by both `NewConversationComposer` and `ConversationView` — SHALL accept `AttachResult` and map `result.folderPaths` through `dialFolderPathToAttachment` (`@epam/ai-dial-chat-hooks`) to `Attachment` objects with `type: AttachmentType.File`, `id`/`url` set to the folder path, and `name` set to its decoded last segment. DIAL Core resolves folder contents server-side regardless of client-side attachment type value. The resulting folder attachments SHALL be merged with file attachments before being added to the conversation.

RTL: none.
Feature flag: none — behavior is conditional on `folderPaths.length > 0`.
Memoisation: the handler is a `useCallback` inside the hook; the `folderPaths` mapping lives inside it.

#### Scenario: File-only attach result — folderPaths empty

- **WHEN** `handleAttachDialFiles` receives `{ files: [file1], folderPaths: [] }`
- **THEN** only `file1` is added as an attachment; no folder attachments are created

#### Scenario: Mixed attach result — files and folders

- **WHEN** `handleAttachDialFiles` receives `{ files: [file1], folderPaths: ['bucket/docs/'] }`
- **THEN** both `file1` and a folder attachment for `'bucket/docs/'` are added to the conversation

#### Scenario: Folder-only attach result

- **WHEN** `handleAttachDialFiles` receives `{ files: [], folderPaths: ['bucket/images/'] }`
- **THEN** a folder attachment for `'bucket/images/'` is added and no file attachments are created

#### Scenario: Same handler in an existing conversation

- **WHEN** `ConversationView` receives `{ files: [file1], folderPaths: ['bucket/docs/'] }` from `DialFileManagerModal`
- **THEN** the result is handled by `useDialFileManagerState.handleAttach`, producing the same pending attachments a new chat would

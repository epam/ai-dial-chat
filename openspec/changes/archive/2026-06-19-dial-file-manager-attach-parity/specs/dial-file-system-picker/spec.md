## MODIFIED Requirements

### Requirement: DialFileManagerModal attach callback

The `onAttach` callback of `DialFileManagerModal` SHALL accept an `AttachResult` object instead of a plain `DialFile[]` array:

```ts
interface AttachResult {
  files: DialFile[];     // selected files (MIME/hidden/size validated)
  folderPaths: string[]; // selected folder paths (empty when canAttachFolders is false)
}

interface Props {
  // ... existing props ...
  onAttach: (result: AttachResult) => void;

  // New optional props added in this change:
  allowedTypes?: string[];          // MIME types (e.g. ['image/*', 'application/pdf']); empty = allow all
  maxSelectableFileSize?: number;   // bytes; undefined = no limit
  maximumAttachmentsAmount?: number; // count; undefined or 0 = no limit
  canAttachFolders?: boolean;        // default false
  allowedTypesLabel?: string;        // optional override for the type label in header description
}
```

**BREAKING change (internal only):** All callers of `DialFileManagerModal` within the same repo (`ConversationRoute`, `ConversationView`, `useDialFileManagerState`) MUST be updated to accept `AttachResult` in the same commit as the modal change.

#### Scenario: Callers receive AttachResult on attach

- **WHEN** user selects files and clicks Attach in `DialFileManagerModal`
- **THEN** the `onAttach` callback is called with `{ files: DialFile[], folderPaths: string[] }`

#### Scenario: Backwards compatibility — folderPaths is always present

- **WHEN** `canAttachFolders` is `false` (default)
- **THEN** `onAttach` is called with `folderPaths: []` so callers do not need to null-check

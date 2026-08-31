## MODIFIED Requirements

### Requirement: Path, mapping, and copy/move utilities preserve their exact algorithms

`@epam/ai-dial-chat-hooks` SHALL export
`hasForbiddenNameSymbols`, `normalizeVirtualPath`, `getVirtualPathName`,
`formatOperationFolderName`, `findFolderByVirtualPath`,
`hasDialFileWritePermission`, `findDialFileByPath`,
`isCopyMoveDuplicateAllowed`, `isShareActionsAllowed`,
`parseNewFolderVirtualPath`, `dialCorePathToRelative`,
`buildSharedItemVirtualPath`, `resolveOwnerCoords`, `mapCorePermissions`,
`findFirstSuccessfulCopyMoveItem`, `buildFromCache`,
`mergeCreatedFolderIntoCache`, `updateEntry`, `mapSearchItem`,
`mapFileMetadataToDialFile`, `prepareCopyItems`, `prepareMoveRenameItems`,
`virtualPathToApiPath`, `getParentFolderPath`, `resolveDialFileApiPath`, and
`sanitizeFileName`, each preserving its exact current algorithm (case-
insensitive sibling-name comparisons, path-separator normalization, owner-
bucket resolution for Shared-tab items, rename-vs-move disambiguation from
`DialCopiedItem` selection payloads) with no behavior change from its
current `apps/chat` implementation.

`getParentFolderPath` SHALL be exported from `@epam/ai-dial-chat-shared` as
the canonical source. `@epam/ai-dial-chat-hooks` SHALL re-export
`getParentFolderPath` from `@epam/ai-dial-chat-shared` for backward
compatibility, so that any consumer already importing it from
`@epam/ai-dial-chat-hooks` continues to work without migration.

`virtualPathToApiPath` and `resolveDialFileApiPath` SHALL continue to be
re-exported directly from `@epam/ai-dial-chat-hooks`'s top-level
`src/index.ts` barrel, not merely reachable transitively.

The `DialFileManagerShell` component (now residing in
`@epam/ai-dial-chat-shared`) SHALL import `getParentFolderPath` from its
own package (`@epam/ai-dial-chat-shared`), not from
`@epam/ai-dial-chat-hooks`. `apps/chat/src/utils/resolve-dial-file-api-path.ts`
(along with its test) SHALL be removed once the migration is verified.

#### Scenario: Rename-vs-move disambiguation preserves current selection semantics

- **WHEN** `prepareMoveRenameItems` receives a `DialCopiedItem[]` batch where
  some items' `sourceUrl` parent equals their `destinationUrl` parent and
  others differ
- **THEN** same-parent items are classified for `renameFiles` and
  different-parent items for `moveFiles`, matching the current
  `apps/chat` behavior exactly

#### Scenario: Owner-bucket resolution for Shared-tab items is preserved

- **WHEN** `resolveOwnerCoords` is called for an item on the Shared tab whose
  virtual path resolves through `sharedRootMetaRef`
- **THEN** it returns the resolved owner bucket and path, not the current
  user's own bucket

#### Scenario: `getParentFolderPath` is importable directly from the package root

- **WHEN** external code runs `import { getParentFolderPath } from '@epam/ai-dial-chat-hooks'`
- **THEN** the import resolves successfully without depending on any other
  file-manager hook or utility being imported first

#### Scenario: `DialFileManagerShell` imports `getParentFolderPath` from `chat-shared`

- **WHEN** `DialFileManagerShell.tsx` (in `libs/chat-shared`) is inspected after this change
- **THEN** its `getParentFolderPath` call resolves from `@epam/ai-dial-chat-shared`,
  and `apps/chat/src/utils/resolve-dial-file-api-path.ts` no longer exists

---

### Requirement: File-manager domain models and constants are host-agnostic

`@epam/ai-dial-chat-hooks` SHALL export the file-manager domain model
constants and types (`UPLOAD_CONCURRENCY`, `RESERVED_MARKER_NAME`,
`DATE_OPTIONS`, `COLUMNS_WITH_AUTHOR`/`COLUMNS_WITHOUT_AUTHOR`,
`CORE_PERMISSION_MAP`, `SharedRootMeta`, `PreparedCopyMoveItem`,
`CopyMoveResult`, `UseDialFileManagerOptions`, `UseDialFileManagerResult`,
`FileUploadValidationResult`, `FileManagerNotification`) unchanged in
shape, depending only on `@epam/ai-dial-chat-shared` and
`@epam/ai-dial-react-file-manager` types.

The following types and enums SHALL have `@epam/ai-dial-chat-shared` as
their canonical source: `FileUploadStatus`, `FileUploadEntry`,
`FileUploadBatchState`, `FileUploadValidationResult`,
`DialFileManagerActionProfile`, and `DialFileManagerVariant`.
`@epam/ai-dial-chat-hooks` SHALL re-export all six from
`@epam/ai-dial-chat-shared` for backward compatibility, so that
any consumer already importing them from `@epam/ai-dial-chat-hooks`
continues to work without migration.

`UseDialFileManagerResult` and `UseDialFileManagerOptions` SHALL remain
defined in `@epam/ai-dial-chat-hooks` as before; they are not moved to
`@epam/ai-dial-chat-shared`.

#### Scenario: Constants and types are importable without any app dependency

- **WHEN** a consumer imports `UPLOAD_CONCURRENCY`, `CORE_PERMISSION_MAP`, or
  `UseDialFileManagerResult` from `@epam/ai-dial-chat-hooks`
- **THEN** no transitive import chain reaches `apps/chat`

#### Scenario: View-layer types re-exported from `chat-hooks` remain accessible

- **WHEN** a consumer imports `FileUploadStatus`, `FileUploadEntry`,
  `FileUploadBatchState`, `FileUploadValidationResult`,
  `DialFileManagerActionProfile`, or
  `DialFileManagerVariant` from `@epam/ai-dial-chat-hooks`
- **THEN** the import resolves successfully (via the re-export from
  `@epam/ai-dial-chat-shared`), and no migration of existing import sites
  is required

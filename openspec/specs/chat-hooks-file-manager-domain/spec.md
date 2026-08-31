# chat-hooks-file-manager-domain Specification

## Purpose

Specifies the host-agnostic domain layer of `@epam/ai-dial-chat-hooks`'s
file-manager hook subsystem: the `DialFilesApi` operation port that replaces
direct `apps/chat/src/server-api/files.api` access, the host-agnostic
domain models/constants/types, and the path/mapping/copy-move utilities
that the listing, mutation, sharing, and upload sub-hooks all depend on,
each preserving its exact pre-move algorithm.

## Requirements

### Requirement: `DialFilesApi` operation port replaces direct `server-api` access

`@epam/ai-dial-chat-hooks` SHALL define and export a `DialFilesApi`
interface covering exactly the operations `apps/chat/src/server-api/files.api.ts`
provides today (`listFiles`, `listPublicFiles`, `listSharedFiles`,
`listSharedByMe`, `getFileMetadata`, `uploadFile`, `uploadArchive`,
`createFolder`, `deleteFiles`, `renameFiles`, `copyFiles`, `moveFiles`,
`downloadFile`, `downloadArchive`, `revokeAccess`, `discardShared`), typed
against `@epam/ai-dial-chat-api-client` DTOs. Every file-manager hook that
performs network I/O SHALL accept a `DialFilesApi` instance as a parameter
and SHALL NOT import, construct, or configure a generated client, a base
URL, auth headers, or a CSRF token itself.

#### Scenario: A hook never imports a generated-client instance directly

- **WHEN** any file-manager hook in `@epam/ai-dial-chat-hooks` needs to list,
  fetch, or mutate files
- **THEN** it calls the `DialFilesApi` instance supplied as a parameter, and
  the package contains no import of `@epam/ai-dial-chat-api-client`'s client
  construction/configuration code

#### Scenario: Upload operations carry progress and cancellation through the port

- **WHEN** a hook calls `DialFilesApi.uploadFile`
- **THEN** it passes `{ signal: AbortSignal; uploadMode: 'overwrite' |
  'create-only'; onProgress: (percent: number) => void }` and the port
  contract does not require the hook to know the underlying transport
  (XHR, fetch, or otherwise)

### Requirement: File-manager domain models and constants are host-agnostic

`@epam/ai-dial-chat-hooks` SHALL export the file-manager domain model
constants and types currently in `apps/chat/src/hooks/files/dial-file-manager.model.ts`
and `dial-file-manager.types.ts` (`UPLOAD_CONCURRENCY`,
`RESERVED_MARKER_NAME`, `DATE_OPTIONS`, `COLUMNS_WITH_AUTHOR`/
`COLUMNS_WITHOUT_AUTHOR`, `CORE_PERMISSION_MAP`, `SharedRootMeta`,
`PreparedCopyMoveItem`, `CopyMoveResult`, `UseDialFileManagerOptions`,
`UseDialFileManagerResult`, `FileUploadValidationResult`,
`FileManagerNotification`) unchanged in shape, depending only on
`@epam/ai-dial-chat-shared` and `@epam/ai-dial-react-file-manager` types.

#### Scenario: Constants and types are importable without any app dependency

- **WHEN** a consumer imports `UPLOAD_CONCURRENCY`, `CORE_PERMISSION_MAP`, or
  `UseDialFileManagerResult` from `@epam/ai-dial-chat-hooks`
- **THEN** no transitive import chain reaches `apps/chat`

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

`virtualPathToApiPath`, `getParentFolderPath`, and `resolveDialFileApiPath`
SHALL be re-exported directly from `@epam/ai-dial-chat-hooks`'s top-level
`src/index.ts` barrel (`export * from './files/resolve-dial-file-api-path'`),
not merely reachable transitively through another module's internal import
of `./files/resolve-dial-file-api-path`. `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`
SHALL import `getParentFolderPath` from `@epam/ai-dial-chat-hooks` instead of
from `apps/chat/src/utils/resolve-dial-file-api-path.ts`, and that app file
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

#### Scenario: `apps/chat`'s file-manager shell consumes the published export

- **WHEN** `DialFileManagerShell.tsx` is inspected after this change
- **THEN** its `getParentFolderPath` call resolves from `@epam/ai-dial-chat-hooks`,
  and `apps/chat/src/utils/resolve-dial-file-api-path.ts` no longer exists

### Requirement: `dial-file-manager-mapping.util`'s tab-dispatch functions use the injected port

`fetchByTab` and `fetchForSearch` SHALL dispatch to `DialFilesApi.listFiles`,
`listPublicFiles`, `listSharedFiles`, or the owner-bucket-resolved
`listFiles` call (for nested Shared-tab folders) based on the active tab,
using the injected `DialFilesApi` instance rather than importing
`server-api/files.api` directly.

#### Scenario: Organization tab dispatches to listPublicFiles via the port

- **WHEN** `fetchByTab` is called with `activeTab = Organization`
- **THEN** it calls the injected `DialFilesApi.listPublicFiles`, not any
  directly imported `server-api` function

---

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

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

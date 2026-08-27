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

# chat-hooks-file-manager-composition Specification

## Purpose

Specifies how `@epam/ai-dial-chat-hooks`'s `useDialFileManager` composes the
five file-manager sub-hooks (`useDialFileListing`, `useDialFileMetadata`,
`useDialFileMutations`, `useDialFileSharing`, `useDialFileUploadBatch`) into
the flat `UseDialFileManagerResult` shape behind injected ports and
configuration, including action-label gating and the
`isAnyOperationInProgress` aggregate. The standalone `useGridEditingScroll`
grid-scrolling hook is owned by `@epam/ai-dial-chat-shared` and re-exported by
`@epam/ai-dial-chat-hooks`.

## Requirements

### Requirement: Action-label gating is computed by the library; label text is supplied by the host

The composer SHALL compute which `DialFileManagerActions` are visible/enabled
per tab, `variant`, and `actionProfile` (Download: always; Delete:
`MyFiles` only; Rename: `MyFiles` with `uploadEnabled`; Copy/Move/Duplicate:
additionally gated by `isCopyMoveDuplicateAllowed`; RemoveAccess: `MyFiles`
only and Unshare: `Shared` only, both gated by `isShareActionsAllowed`, i.e.
the `Full` profile; Info: `Full` profile only, on every tab), and SHALL intersect
that gating with the host-supplied `labels` map rather than resolving label
text itself via `react-i18next`.

#### Scenario: Attach profile excludes copy/move/duplicate/sharing actions

- **WHEN** `useDialFileManager` is called with `variant: Attach`
  (`actionProfile: Attach`)
- **THEN** `actionLabels` contains no entry for Copy, Move, Duplicate, or
  RemoveAccess, regardless of what the host's `labels` map contains for
  those keys

#### Scenario: uploadEnabled matrix is preserved across tabs and permissions

- **WHEN** `useDialFileManager` evaluates `uploadEnabled` for Organization,
  Shared root, Shared nested without write permission, Shared nested with
  write permission, and `MyFiles` with write permission
- **THEN** the result is `false, false, false, true, true` respectively,
  matching the current `apps/chat` behavior exactly

### Requirement: `isAnyOperationInProgress` preserves its exact inclusion list

`isAnyOperationInProgress` SHALL be the logical OR of exactly
`isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`,
`isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`, and
`isUploadInProgress(uploadBatchState)` (some file still `Queued` or
`Uploading`), deliberately excluding `isLoading`,
`isSearching`, and `isFileMetadataLoading`.

#### Scenario: A pending listing fetch does not count as an operation in progress

- **WHEN** `useDialFileListing`'s `isLoading` is `true` and every other
  flag is `false`
- **THEN** `isAnyOperationInProgress` is `false`

### Requirement: `useDialFileManager` composes the sub-hooks behind injected ports

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileManager`, composing
`useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`,
`useDialFileSharing`, and `useDialFileUploadBatch` into the flat
`UseDialFileManagerResult` shape, accepting an injected `filesApi: DialFilesApi`,
`labels: Partial<Record<DialFileManagerActions, string>>`, `locale: string`,
`activeTab`, `disabledNewButtonTooltip`, `downloadDestination` and
`buildValidationErrorMessage`, and importing neither
`react-i18next` nor an application context.

The result SHALL retain its current complete field set, names, types and
semantics and SHALL be structurally assignable without a cast to the exact
shell-consumed `FileManagerController` exported by
`@epam/ai-dial-chat-shared`. Tabs, active tab, selection and host integration
callbacks SHALL NOT be added to the result merely to satisfy the view contract.

#### Scenario: The composed result shape is unchanged

- **WHEN** a host calls `useDialFileManager` with the injected parameters
- **THEN** every result field keeps the semantics consumed by the current page,
  modal and shell

#### Scenario: Structural assignment succeeds without fabricating fields

- **WHEN** a `UseDialFileManagerResult` value is assigned to
  `FileManagerController`
- **THEN** TypeScript accepts it without a cast and neither type gains
  controller-owned tabs or invented mutation names

#### Scenario: Every result field has one owner

- **WHEN** a result field is inspected
- **THEN** it originates from exactly one composed sub-hook or the composer's
  own derivations (`uploadEnabled`, `isNewButtonDisabled`,
  `visibleColumns`, `dateLocale`, `dateOptions`, `actionLabels`,
  `onCreateFolderValidate`, `onRenameValidate`,
  `isAnyOperationInProgress`, plus the pass-through
  `disabledNewButtonTooltip`), never two sub-hooks

### Requirement: `useGridEditingScroll` scrolls to an inline-edited or newly-inserted row

`@epam/ai-dial-chat-shared` SHALL be the canonical owner of
`useGridEditingScroll`, returning `{ handleGridApiChange, reset }` and binding
to the peer file-manager's leaked raw `GridApi` events. Its current public
signature, including the raw `GridApi<FileManagerGridRow>` callback type, SHALL
be preserved. `@epam/ai-dial-chat-hooks` re-exports the hook and its
`UseGridEditingScrollOptions`/`UseGridEditingScrollResult` types from
`chat-shared` (root and `./file-manager` entry) for backward compatibility;
`DialFileManagerShell` in `chat-shared` imports it directly.

The implementation SHALL preserve inline-edit scrolling, new-id detection,
temporary-row preference, first-update/reset seeding, clean re-subscription,
destroyed-grid guards, deferred DOM fallback and stable callback identity.
AG Grid use in `chat-shared` SHALL be limited to this event binding under the
documented library-isolation exception.

#### Scenario: Starting an inline rename scrolls that row into view

- **WHEN** `cellEditingStarted` fires with a row index on a live grid
- **THEN** `ensureIndexVisible` receives that index

#### Scenario: A new row differs from a reorder

- **WHEN** `rowDataUpdated` contains a previously unknown row id
- **THEN** the resolved node is scrolled into view, while an update containing
  only known ids does not scroll

#### Scenario: Switching APIs re-subscribes cleanly

- **WHEN** the handler receives a different grid API
- **THEN** old listeners are removed before new listeners are attached and a
  repeated identical API does not duplicate them

#### Scenario: Reset only re-seeds

- **WHEN** `reset` is followed by `rowDataUpdated`
- **THEN** that first update seeds ids without scrolling

#### Scenario: The grid hook has one implementation

- **WHEN** a consumer imports `useGridEditingScroll` from either
  `@epam/ai-dial-chat-shared` or `@epam/ai-dial-chat-hooks`
- **THEN** both resolve to the single implementation in
  `libs/chat-shared/src/file-manager/useGridEditingScroll/useGridEditingScroll.ts`

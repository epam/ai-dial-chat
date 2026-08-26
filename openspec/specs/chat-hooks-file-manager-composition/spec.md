# chat-hooks-file-manager-composition Specification

## Purpose

Specifies how `@epam/ai-dial-chat-hooks`'s `useDialFileManager` composes the
five file-manager sub-hooks (`useDialFileListing`, `useDialFileMetadata`,
`useDialFileMutations`, `useDialFileSharing`, `useDialFileUploadBatch`) into
the flat `UseDialFileManagerResult` shape behind injected ports and
configuration, including action-label gating, the `isAnyOperationInProgress`
aggregate, and the standalone `useGridEditingScroll` grid-scrolling hook.

## Requirements

### Requirement: `useDialFileManager` composes the sub-hooks behind injected ports

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileManager`, composing
`useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`,
`useDialFileSharing`, and `useDialFileUploadBatch` into the flat
`UseDialFileManagerResult` shape, accepting an injected `DialFilesApi`
instance, `labels: Partial<Record<DialFileManagerActions, string>>`,
`locale: string`, and `fileManagerTabs: string[] | undefined`, and
importing neither `react-i18next` nor any application context.

#### Scenario: The composed result shape is unchanged for consumers

- **WHEN** a host calls `useDialFileManager(options)` with the new injected
  parameters
- **THEN** the returned object satisfies the same `UseDialFileManagerResult`
  field set, types, and semantics `apps/chat`'s `DialFileManagerModal`,
  `DialFileManagerPage`, and `DialFileManagerShell` consumed before this
  change

#### Scenario: Every result field originates from exactly one sub-hook or composer-owned derivation

- **WHEN** any field of `UseDialFileManagerResult` is inspected
- **THEN** it originates from exactly one of the five composed sub-hooks or
  from the composer's own tab/action-profile-derived fields
  (`visibleColumns`, `dateOptions`, `sharedWithMeIds`, `uploadEnabled`,
  `isNewButtonDisabled`, `disabledNewButtonTooltip`,
  `isAnyOperationInProgress`), never from two different sub-hooks

### Requirement: Action-label gating is computed by the library; label text is supplied by the host

The composer SHALL compute which `DialFileManagerActions` are visible/enabled
per tab, `variant`, and `actionProfile` (Delete: `MyFiles` only; Rename/
Copy/Move/Duplicate: gated by write permission and
`isCopyMoveDuplicateAllowed`; RemoveAccess/Unshare: gated by
`isShareActionsAllowed`; Info: `Full` profile only), and SHALL intersect
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
`uploadBatchState != null`, deliberately excluding `isLoading`,
`isSearching`, and `isFileMetadataLoading`.

#### Scenario: A pending listing fetch does not count as an operation in progress

- **WHEN** `useDialFileListing`'s `isLoading` is `true` and every other
  flag is `false`
- **THEN** `isAnyOperationInProgress` is `false`

### Requirement: `useGridEditingScroll` scrolls to an inline-edited or newly-inserted row

`@epam/ai-dial-chat-hooks` SHALL export `useGridEditingScroll`, returning
`{ handleGridApiChange, reset }`, whose public contract never exposes an
`ag-grid-community` type. Internally it SHALL bind to the raw `GridApi`'s
`cellEditingStarted` and `rowDataUpdated` events (not forwarded by
`@epam/ai-dial-react-file-manager`'s own prop surface) to scroll a newly
inline-edited or newly-inserted row into view.

#### Scenario: Starting an inline rename scrolls that row into view

- **WHEN** a `cellEditingStarted` event fires for a row not currently
  visible
- **THEN** the hook calls `ensureIndexVisible` for that row's index,
  guarded by the grid API not being destroyed

#### Scenario: A newly-inserted row is distinguished from a reordered existing row

- **WHEN** `rowDataUpdated` fires with a row id not present in the
  previously-known set
- **THEN** the hook scrolls the resolved target node into view; when
  `rowDataUpdated` fires with only previously-known ids, it does not scroll

#### Scenario: Switching grid API instances re-subscribes cleanly

- **WHEN** `handleGridApiChange` is called with a different `GridApi`
  instance than the one currently subscribed
- **THEN** the hook removes its listeners from the previous instance before
  attaching to the new one, and calling it twice with the same instance
  does not attach duplicate listeners

#### Scenario: `reset` re-seeds known row ids without scrolling

- **WHEN** `reset()` is called (e.g. on a data-source change such as a tab
  switch) and `rowDataUpdated` fires next
- **THEN** that first post-reset `rowDataUpdated` seeds the known-id set
  without triggering a scroll, exactly as the first `rowDataUpdated` after
  mount does

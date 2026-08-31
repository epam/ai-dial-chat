## MODIFIED Requirements

### Requirement: `useDialFileManager` composes the sub-hooks behind injected ports

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileManager`, composing
`useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`,
`useDialFileSharing`, and `useDialFileUploadBatch` into the flat
`UseDialFileManagerResult` shape, accepting an injected `DialFilesApi`, labels,
locale and file-manager tab configuration, and importing neither
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
  current derivations, never two sub-hooks

### Requirement: `useGridEditingScroll` scrolls to an inline-edited or newly-inserted row

`@epam/ai-dial-chat-shared` SHALL be the canonical owner of
`useGridEditingScroll`, returning `{ handleGridApiChange, reset }` and binding
to the peer file-manager's leaked raw `GridApi` events. Its current public
signature, including the raw `GridApi<FileManagerGridRow>` callback type, SHALL
be preserved. `@epam/ai-dial-chat-hooks` SHALL compatibility-re-export the hook
and its public types so existing imports continue to resolve.

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

#### Scenario: Existing chat-hooks import remains valid

- **WHEN** a consumer imports `useGridEditingScroll` from
  `@epam/ai-dial-chat-hooks`
- **THEN** it resolves to the canonical shared implementation with unchanged
  types and behavior

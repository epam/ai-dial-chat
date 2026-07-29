## ADDED Requirements

### Requirement: Details panel renders a Delete action for owned applications and toolsets

The Catalog details panel (`Header.tsx`, via a new `DeleteButton` component in
`libs/catalog/src/components/Details/Header/DeleteButton/`) SHALL accept an optional
`onDelete?: (item: CatalogItem) => Promise<void> | void` prop (threaded through
`DetailsPanelProps` and `CatalogProps`), plus an optional `deleteActionLabel` text override
on `ItemDetailsTexts` (default `'Delete'`). When `onDelete` is supplied AND the currently
displayed item's `isMyApp` is `true` AND its `type` is `CatalogEntityType.Agent` or
`CatalogEntityType.Toolset`, a `NeutralButton` labelled with `deleteActionLabel` and a
leading trash icon SHALL render in the same action row as "Use in chat", "Edit", and
"Share", immediately after the Share button. No new `CatalogItem` field is introduced for
this gating — it reuses the existing `isMyApp` and `type` fields.

#### Scenario: Delete hidden when onDelete is not supplied
- **WHEN** the details panel is rendered without an `onDelete` prop, even for an item with
  `isMyApp: true` and `type: Application` or `type: Toolset`
- **THEN** no "Delete" button is present in the DOM

#### Scenario: Delete hidden for an item the user does not own
- **WHEN** `onDelete` is supplied but the displayed item's `isMyApp` is `false` or `undefined`
- **THEN** no "Delete" button is present in the DOM

#### Scenario: Delete hidden for entity types other than Application and Toolset
- **WHEN** `onDelete` is supplied and the displayed item has `isMyApp: true` but its `type` is
  `Model`, `Guardrail`, `Mcp`, or `Agent`
- **THEN** no "Delete" button is present in the DOM

#### Scenario: Delete shown for an owned application
- **WHEN** `onDelete` is supplied and the displayed item has `isMyApp: true` and
  `type: CatalogEntityType.Agent`
- **THEN** a "Delete" button (default label, trailing trash icon) renders in the action row,
  positioned immediately after the "Share" button

#### Scenario: Delete shown for an owned toolset
- **WHEN** `onDelete` is supplied and the displayed item has `isMyApp: true` and
  `type: CatalogEntityType.Toolset`
- **THEN** a "Delete" button renders in the action row, positioned immediately after the
  "Share" button

#### Scenario: Delete action label override
- **WHEN** `deleteActionLabel` is supplied in `texts`
- **THEN** the Delete button uses that label instead of the default `'Delete'`

### Requirement: Clicking Delete calls onDelete immediately, with no confirmation step

Clicking the Delete button SHALL call `onDelete` with the currently displayed item
immediately — there is no confirmation popup or intermediate dialog. While the promise
returned by `onDelete` is pending, the Delete button SHALL be disabled. On resolution
(success or rejection) the button SHALL re-enable. The `DeleteButton` component itself does
not render any error UI; if `onDelete` rejects, surfacing that failure to the user (e.g. via
a notification) is the responsibility of the app supplying `onDelete`, not the lib.

#### Scenario: Delete button calls onDelete with no confirmation
- **WHEN** the user clicks the Delete button
- **THEN** `onDelete` is called immediately with the currently displayed item
- **AND** no confirmation popup or dialog is shown at any point

#### Scenario: Button disabled while the delete request is in flight
- **WHEN** the user clicks Delete and the `onDelete` promise has not yet settled
- **THEN** the Delete button is disabled

#### Scenario: Delete succeeds
- **WHEN** the `onDelete` promise resolves
- **THEN** the Delete button re-enables, and the `onDeleted` callback (if supplied) is invoked

#### Scenario: Delete fails
- **WHEN** the `onDelete` promise rejects
- **THEN** the Delete button re-enables, `onDeleted` is NOT invoked, and no error is rendered
  by `DeleteButton` itself — the user may click Delete again to retry

### Requirement: apps/chat wires Delete to the toolset and application delete APIs

`CatalogView`'s single `onDelete` handler SHALL branch on the clicked `CatalogItem`'s
`type`. For `CatalogEntityType.Toolset` items it SHALL call the existing
`deleteToolset(toolsetName)` server-api function
(`apps/chat/src/server-api/toolsets.ts`), passing the item's `id` directly (the backend
already resolves either a full `toolsets/{bucket}/{path}` id or a bare name via the
caller's own bucket). For `CatalogEntityType.Agent` items it SHALL call a new
`deleteApplication(applicationName)` server-api function
(`apps/chat/src/server-api/applications.ts`), passing the item's `id` directly using the
same convention — this permanently deletes the application from DIAL Core, the same as
Delete does for toolsets. On success, `CatalogView` SHALL close the details panel (via the
`DeleteButton`'s `onDeleted` callback), refresh the affected list (`refetchToolsets` /
`refetchDeployments`), and show a success notification via the existing
`useNotification()`/`NotificationVariant.Success` pattern. On failure, `CatalogView` SHALL
show an error notification (`NotificationVariant.Error`, `CatalogI18nKeys.DetailsDeleteError`)
and re-throw so the `DeleteButton` knows not to invoke `onDeleted`; the item remains in the
catalog list and the details panel stays open.

#### Scenario: Deleting an owned toolset
- **WHEN** the user clicks Delete for a toolset they own
- **THEN** `CatalogView` calls `deleteToolset` with the toolset's `id`
- **AND** on success, the details panel closes, the toolset disappears from the catalog
  list, and a success notification is shown

#### Scenario: Deleting an owned application
- **WHEN** the user clicks Delete for an application (QuickApp) they own
- **THEN** `CatalogView` calls `deleteApplication` with the application's `id`, permanently
  deleting it from DIAL Core
- **AND** on success, the details panel closes, the application disappears from the
  catalog list, and a success notification is shown

#### Scenario: Delete request fails
- **WHEN** either `deleteToolset` or `deleteApplication` rejects
- **THEN** `CatalogView` shows an error notification, the details panel stays open, and
  the item remains in the catalog list

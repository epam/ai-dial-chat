## MODIFIED Requirements

### Requirement: Publish submission and history use real backend data
`CatalogView` SHALL call the real `onPublish`, `getPublishHistory`, and `hasPublishWriteAccess` implementations backed by `apps/chat/src/server-api` wrappers instead of mock data (`MOCK_PUBLISH_FOLDERS`, `MOCK_PUBLISH_HISTORY`, and the mock `handlePublish`), which SHALL be deleted once parity is confirmed.

`getPublishHistory` (defined in `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts` and supplied by `CatalogView`) SHALL call `getCatalogPublishHistory` and map the response through `mapPublishHistoryEntryDto`. For an item whose id addresses the `public` bucket (`isPublicCatalogEntityId`) it SHALL NOT call `getCatalogPublishHistory`; instead it SHALL synthesise a single entry from the id (`getPublicCatalogEntityFolderPath`) **only when the caller may unpublish that copy** — immediately when `isAdmin` is `true`, otherwise when `getCatalogUnpublishAccess(entityType, item.id)` resolves `{ canUnpublish: true }` — and SHALL resolve `[]` when it resolves `{ canUnpublish: false }`. A rejected access lookup rejects `getPublishHistory`. A non-publishable type resolves to `[]` without any request. The synthesised entry exists only to give the Unpublish action its folder (see `catalog-unpublish-flow`); the publish panel never opens for a public item. The earlier stub that always resolved to `[]` (GitHub issue [#7897](https://github.com/epam/ai-dial-chat/issues/7897)) has been removed, and no temporary exception remains; the `503` it worked around was our own `getPublications` response-shape defect — since fixed in `publish/publication.util.ts`, along with the list scope and the metadata-only list response (see `catalog-publish-api`) — not a missing endpoint and not Core being unavailable.

The fetch is load-bearing beyond the publish panel: it is the only source of the folder list the Unpublish action needs, and it is what makes that action visible at all (see `catalog-unpublish-flow`). While it returned a frozen `[]`, `Unpublish` could never appear for any catalog entity.

The publish sub-view SHALL NOT render a versions-history list: `PublishPanel` has no history section and takes no history props, so the fetched history is consumed by `usePublishFlow` (existing-publication detection) and by the Unpublish action. `PublishHistoryList` remains exported from `@epam/ai-dial-publish-panel` for custom layouts and is not rendered by the app.

Submit success: `CatalogView`'s `onPublishSuccess` SHALL raise its notification through `useOperationNotification` (see `entity-operation-notifications`) with the item's resolved `NotifiableEntity` and `EntityOperation.PublishRequested`, passing the entity name and the selected destination folder. The copy SHALL state that a publish request was submitted and appears once an admin approves it — the endpoint creates an admin-pending DIAL Core publication, exactly as the conversation publish flow already reports. The previous `CatalogI18nKeys.PublishSuccess*` pair (`"Published"` / `"\"{{name}}\" published to {{folder}}"`) SHALL be deleted, since it claimed an outcome the backend does not deliver.

Submit failure: `CatalogView` SHALL supply an `onPublishError` handler, threaded down as `CatalogProps.onPublishError` → `DetailsPanelProps.onPublishError` → `usePublishFlow` the same way `onPublishSuccess` already is, so a rejected publish produces an error notification in addition to the inline submit-error callout ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)). It SHALL reuse the same shared `usePublishErrorNotification` hook and shared `publish.*` i18n namespace as the conversation publish flow (see `conversation-publish-flow`), including the offline branch that swaps in `publish.networkErrorMessage` and omits `requestId`. `CatalogView` SHALL also pass the translated `publishLabels.submitError` (`publish.submitErrorCallout`), so the callout no longer renders the publish-panel library's hardcoded English default.

Accessibility: the submit-error callout SHALL use `role="alert"`.

#### Scenario: Publish succeeds
- **WHEN** the user submits a publish request and the backend returns success
- **THEN** `onPublishSuccess` fires, a success notification titled `"<Entity> publish requested"` is shown through `useOperationNotification`, and its body names the entity and destination folder and states an admin must approve it

#### Scenario: Publish notification names the entity kind
- **WHEN** a toolset is published and, separately, a prompt is published
- **THEN** the first notification reads `"Toolset publish requested"` and the second `"Prompt publish requested"`, resolved from the item's `CatalogEntityType`

#### Scenario: Publish fails due to no write access
- **WHEN** the user submits a publish request and the backend returns a 403
- **THEN** `derivePublishState` surfaces the no-access callout and the submit action remains available for a different folder selection

#### Scenario: Publish fails and the panel reports it outside the panel too
- **WHEN** the user submits a publish request and it rejects (backend error or lost connection)
- **THEN** the publish sub-view stays open with the submit-error callout, `onPublishError` receives the rejection reason, and an error notification is shown

#### Scenario: History is fetched from the endpoint, not stubbed
- **WHEN** the publish sub-view or the Manage menu triggers a history lookup for an entity
- **THEN** `getCatalogPublishHistory` is called for that entity and its mapped entries are returned to the catalog, with no code path resolving to a hardcoded empty array

#### Scenario: The publish sub-view shows no versions history
- **WHEN** the user opens the publish sub-view and selects a destination folder
- **THEN** no versions-history list is rendered, whatever `history` contains

#### Scenario: Publish history fails to load
- **WHEN** `getPublishHistory` rejects
- **THEN** the `Unpublish` menu entry stays hidden (see `catalog-unpublish-flow`)

#### Scenario: A public copy's history for its publisher
- **GIVEN** `isAdmin` is `false` and `getCatalogUnpublishAccess` resolves `{ canUnpublish: true }`
- **WHEN** `getPublishHistory` runs for `applications/public/Org/my-app__1.0.0`
- **THEN** it resolves one entry with `folderPath: ['Org']` and `getCatalogPublishHistory` is not called

#### Scenario: A public copy's history for an unrelated user
- **GIVEN** `isAdmin` is `false` and `getCatalogUnpublishAccess` resolves `{ canUnpublish: false }`
- **WHEN** `getPublishHistory` runs for a public copy
- **THEN** it resolves `[]`

#### Scenario: A public copy's history for an administrator
- **GIVEN** `isAdmin` is `true`
- **WHEN** `getPublishHistory` runs for a public copy
- **THEN** it resolves the synthesised entry and neither `getCatalogUnpublishAccess` nor `getCatalogPublishHistory` is called

#### Scenario: The access lookup fails
- **GIVEN** `isAdmin` is `false` and `getCatalogUnpublishAccess` rejects
- **WHEN** `getPublishHistory` runs for a public copy
- **THEN** it rejects, so the `Unpublish` entry stays hidden and is retried on the next menu open

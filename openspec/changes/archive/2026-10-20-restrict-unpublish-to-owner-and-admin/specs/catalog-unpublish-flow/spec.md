## MODIFIED Requirements

### Requirement: The app wires Unpublish to the BFF endpoint and its notification

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL pass `onUnpublish` (and `isUnpublishVisible`) to `DetailsPanel`, using `handleUnpublish` from `useCatalogPublishing` (`apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts`). `handleUnpublish` maps the item type with `toPublishEntityType` (throwing for a non-publishable type) and calls the `unpublishCatalogEntity` wrapper in `apps/chat/src/server-api/publish.api.ts` (bound from `createPublishApiClient` in `@epam/ai-dial-chat-hooks`) with the entity type, id, `{ folderPath: <selected folder joined with `/`>, version }` (version only when the item has one).

**Who is offered Unpublish.** `useCatalogPublishing` owns the decision; `libs/catalog` receives only its result through the existing callbacks and learns nothing about ownership, admin status, or the access endpoint.

- `isUnpublishVisible(item)` SHALL return `true` exactly when the item is a public copy (`isPublicCatalogEntityId(item.id)`) of a publishable type (`toPublishEntityType(item.type) != null`). It SHALL NOT consult `hasPublishWriteAccess`: folder write access says nothing about who published the copy, and every non-restricted folder passed it, which is what offered Unpublish to every user on every copy ([#9180](https://github.com/epam/ai-dial-chat/issues/9180)).
- Who may actually request it is resolved asynchronously through `getPublishHistory` (see `catalog-publish-flow`): for an administrator (`isAdmin`, from the session's `/auth/me` profile) the public copy's single folder entry is synthesised without a request; for anyone else it is synthesised only when `getCatalogUnpublishAccess(entityType, item.id)` answers `canUnpublish: true`, and history resolves to `[]` otherwise. An empty history hides the entry, so a non-owner never sees `Unpublish`. A failed access lookup rejects `getPublishHistory`, which the panel already treats as "hidden, retry next open".
- Because `isUnpublishVisible` answers `true` for every public copy, the panel's existing prefetch rule runs the lookup when the details panel opens. For a non-owner the Manage trigger can show for the duration of that lookup and then disappear if nothing else is in the menu; this is the existing "lookup outstanding" behaviour, not a new state.

The backend rejects a non-owner, non-admin request with 403 regardless (see `catalog-unpublish-api`); the UI gate only keeps an action the caller cannot complete off the menu.

On success it SHALL raise exactly one notification through `useOperationNotification`'s `notifyOperationSuccess` with `EntityOperation.UnpublishRequested`, the entity resolved by `resolveCatalogItemEntity(item.type, deployment, schemas)`, and `{ name, folder, type }` where `folder` is `getPublishFolderLabel(folderPath, t)` (the leaf segment, or the translated Organization label for the root) and `type` is the schema display name — the same interpolation shape the publish success notification uses.

On failure it SHALL reuse `usePublishErrorNotification` (passed in as `showPublishError`, called with `EntityOperation.UnpublishRequested`), which already maps status, message, trace id, and the offline case, and SHALL rethrow so the panel's rejection path runs; no new error copy is introduced, including for the new ownership 403.

All strings SHALL come from `t()` with keys declared in `apps/chat/src/constants/translation-keys.ts`; no raw key literal and no English string may appear in the wiring. `libs/catalog` SHALL learn nothing about the endpoint, the entity-type enum, the generated client, or how ownership is decided — it receives only the callbacks and the labels.

`isUnpublishVisible` and `getPublishHistory` SHALL stay `useCallback`-memoised, so the panel's per-item guard is not defeated by a new function identity on every render. `getPublishHistory` lists `isAdmin` as its one dependency, so a change in admin status re-derives it; `isUnpublishVisible` reads no state and has none.

#### Scenario: Confirming issues the request
- **WHEN** the user confirms unpublish for a toolset published to `Organization/Data Science`
- **THEN** `unpublishCatalogEntity` is called with the toolset's entity type and id, `folderPath: 'Organization/Data Science'`, and the item's version

#### Scenario: Success raises the request-pending notification
- **WHEN** the request resolves
- **THEN** one success notification is raised via `notifyOperationSuccess(..., EntityOperation.UnpublishRequested, { name, folder, type })`

#### Scenario: Failure reuses the shared publish error notification
- **WHEN** the request rejects with a 403
- **THEN** `usePublishErrorNotification` raises the error notification with the response's own message and trace id, and no success notification is raised

#### Scenario: Owner sees Unpublish on their public copy
- **GIVEN** a non-admin user and `getCatalogUnpublishAccess` answers `canUnpublish: true` for a public copy
- **WHEN** they open its details panel and the Manage menu
- **THEN** `Unpublish` is offered for the copy's folder

#### Scenario: Non-owner does not see Unpublish
- **GIVEN** a non-admin user and `getCatalogUnpublishAccess` answers `canUnpublish: false`
- **WHEN** they open the public copy's details panel and the Manage menu
- **THEN** `Unpublish` is not rendered

#### Scenario: Administrator sees Unpublish without a lookup
- **GIVEN** `isAdmin` is `true`
- **WHEN** they open any public copy's details panel
- **THEN** `Unpublish` is offered and `getCatalogUnpublishAccess` is not called

#### Scenario: Folder write access no longer grants Unpublish
- **GIVEN** a non-admin user, `hasPublishWriteAccess` would return `true` for the copy's folder, and `canUnpublish` is `false`
- **THEN** `Unpublish` is not rendered

#### Scenario: A personal item never offers Unpublish
- **WHEN** `isUnpublishVisible` is evaluated for an item whose id is in the caller's own bucket
- **THEN** it returns `false`

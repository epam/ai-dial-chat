## MODIFIED Requirements

### Requirement: Catalog publish panel offers an editable author pre-filled with the publisher's name

The catalog publish sub-view SHALL show the shared publish panel's author field, pre-filled with the signed-in user's display name, and SHALL send the submitted value with the publish request so it becomes the published entity's **Hosted by** value.

State ownership: `DetailsPanel`'s existing `usePublishFlow` instance owns `author`/`setAuthor` (see `publish-panel-library`) and supplies them to its inline `PublishPanel` render via the new required `author`/`onAuthorChange` props, threaded the same way `hidePublishAuthor` is.

A host that collects the author elsewhere MAY opt out of the field with `CatalogProps.hidePublishAuthor?: boolean` (default `false`, threaded `Catalog` → `DetailsPanel` → `DetailsPublishContent`, the same way `hideCreateButton` is). When it is set, `DetailsPublishContent` SHALL NOT pass `author`/`onAuthorChange` to `PublishPanel`, so the field is not rendered, and `onPublish` receives `publishDefaultAuthor` (or an empty string) as its author argument. `pg-chat` sets `hidePublishAuthor` and does not pass `publishDefaultAuthor`, so its publish requests carry no `author` and the backend's session-derived fallback applies.

Prefill is host-resolved, not lib-resolved. `CatalogProps` and `DetailsPanelProps` (`libs/catalog/src/models/item-details-props.ts`) SHALL gain `publishDefaultAuthor?: string`, threaded `CatalogView` → `Catalog` → `DetailsPanel` → `usePublishFlow`'s `defaultAuthor` option, exactly as `publishFolderItems`/`publishLabels` already are. `CatalogView` SHALL resolve the value from `useUserProfile()`'s `displayName`. Neither `libs/catalog` nor `libs/publish-panel` reads `UserContext`, OIDC claims, or i18n for it, per AGENTS.md §Library isolation; `publishDefaultAuthor` is the app-level adapter contract that carries the host's session knowledge across the boundary.

Submission: `CatalogProps.onPublish` and `DetailsPanelProps.onPublish` SHALL take the author as a fourth argument, matching `usePublishFlow`'s extended `onPublish` signature. `CatalogView.handlePublish` (delegating to `useCatalogPublishing`'s `handlePublish`) SHALL accept that argument and forward it to `publishCatalogEntity`, which SHALL include it in the request body's `author` field sent to `POST /api/v1/catalog/{entityType}/{entityId}/publish` (see `catalog-publish-api`). When the value is empty after trimming, `handlePublish` SHALL omit `author` from the request body entirely rather than sending an empty string, so the backend's session-derived fallback applies.

Unpublish is unaffected: `unpublishCatalogEntity` SHALL NOT gain an author field, since a removal request's `displayAuthor` identifies the requester of that removal rather than the published entity's author.

i18n: the new user-visible strings SHALL be registered on `PublishI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and added to `apps/chat/src/i18n/locales/en.json` — `publish.authorLabel` (`"Author"`), `publish.authorPlaceholder` (`"Author name"`), and `publish.authorHint` (explaining the value is shown as the publication's author in the catalog). `CatalogView` SHALL pass them through `publishLabels` as `authorLabel`, `authorPlaceholder`, and `authorHint`, alongside the labels it already supplies. The library's English defaults SHALL NOT be relied upon by the app.

RTL/direction impact: none beyond the surrounding panel. The field is a ui-kit `Input` positioned with CSS logical properties; no directional icon is introduced, so no `rtl:` mirroring applies.

Feature gating: none. The field is not behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` — it is part of the publish panel, whose visibility is already governed by the existing `Publish visibility is scoped to editable entities` requirement.

#### Scenario: Author is pre-filled with the signed-in user's display name

- **GIVEN** the signed-in user's profile resolves `displayName` to `"Daniil Pavlov"`
- **WHEN** the user opens the publish sub-view for a toolset
- **THEN** the author field shows `"Daniil Pavlov"` without the user typing anything

#### Scenario: Hidden author renders no field and omits author from the request
- **GIVEN** the host sets `hidePublishAuthor` and supplies no `publishDefaultAuthor`
- **WHEN** the Publish sub-view opens in `DetailsPanel` and the user selects a folder and clicks Publish
- **THEN** no author field is rendered, `onPublish` receives `''` as its author argument, and `publishCatalogEntity` is called with no `author` key

#### Scenario: Edited author reaches the publish call

- **GIVEN** the user replaces the pre-filled author with `"DIAL Team"` and selects a destination folder
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `author` is `"DIAL Team"`

#### Scenario: Untouched pre-filled author is sent as-is

- **GIVEN** the user leaves the pre-filled author unchanged
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with `author` equal to the signed-in user's display name, producing the same **Hosted by** value as before this change

#### Scenario: Cleared author omits the field from the request

- **GIVEN** the user clears the author field
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with no `author` key in the request body, and the backend falls back to the session-derived display name

#### Scenario: Author resets when a different item is opened

- **GIVEN** the user edited the author for one catalog item without submitting
- **WHEN** the details panel switches to a different item and `publishFlow.reset()` runs
- **THEN** the author field returns to the signed-in user's display name

#### Scenario: Prefill arrives after the panel opens

- **GIVEN** the user profile has not yet resolved when the publish sub-view first renders, so the author field is empty
- **WHEN** `publishDefaultAuthor` resolves to the user's display name and the user has not typed in the field
- **THEN** the field fills with that name

#### Scenario: Labels come from the app's i18n, not the library defaults

- **WHEN** the publish sub-view renders in the catalog
- **THEN** the author field's label, placeholder, and hint are the translated `publish.authorLabel`/`publish.authorPlaceholder`/`publish.authorHint` values passed through `publishLabels`

#### Scenario: Unpublish request carries no author

- **WHEN** the user submits an unpublish request for a published catalog entity
- **THEN** `unpublishCatalogEntity` is called with the same request body shape as before this change, with no `author` field

### Requirement: The Save panel shows the private dependencies of an unsaved schema app

`POST /api/v1/catalog/application-values/publish-dependencies` (`PublishDependenciesController`) SHALL accept `{ schemaId, properties }` (`ApplicationValuesDependenciesRequestDto`, `properties` a non-empty object of at most 64 KiB serialized) and return a `ResourceDependenciesResultDto` built by `ApplicationDependencyResolver.resolveFromValues` from the application type schema and the given values, without reading any application from DIAL Core. Like the entity route it SHALL answer an empty list when the schema cannot be read. The list SHALL hold the dependencies that travel with the application when it is written into an org unit: those in the caller's own bucket, and files; a resource in another user's bucket SHALL be left out, as the copy leaves it. While the caller's bucket is not resolved the list SHALL NOT be filtered. `schemaId` SHALL be accepted only when it holds URL characters (no whitespace or control character), because it reaches a DIAL Core request, a cache key and a log line; anything else SHALL answer `400`.

`useResourceSavePanel` (`libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`) SHALL accept an optional `loadDependencies` and return `panelProps.dependencies`: the loaded list while the committed destination is under the Organization root, otherwise an empty list. The list SHALL be empty while loading and after a failed read, SHALL ignore a read that finishes after the destination left the Organization root or the panel closed, and SHALL never disable Save. It SHALL apply to a public-folder save that sends a publication request and to a direct write into an org unit alike.

`apps/chat` SHALL pass `dependencyValues` to `ResourceSavePanelContainer` only for a schema-form app, from `ApplicationSavePanelConfig.getDependencyValues` of `schemaAppDefinition` (the schema id and `setup.properties`); the Quick App and custom app definitions SHALL provide none. For an application with an embedded editor (the Quick App definition sets `ApplicationSavePanelConfig.isFormStateEmbedded`) the container SHALL instead pass the neutral dependencies sentence of `resource-save-panel`, because its form state is inside the embedded editor; a custom app has no schema and so nothing to list or say. The container SHALL fill the section's copy with the `Published` variant of `getPublishDependenciesLabels` and the `publish.dependenciesPublished*` keys, since the dependencies of an application are published or copied together with it on both Save paths (a publication request and a direct write into an org unit).

#### Scenario: Schema app saved to an Organization folder through a publication request
- **WHEN** the committed destination is a public folder outside every org unit and the app has form values
- **THEN** the panel lists the private dependencies of those values

#### Scenario: Schema app saved by a direct write into an org unit
- **WHEN** the committed destination is a unit folder the user may write to, and the app has form values
- **THEN** the panel lists the private dependencies of those values and no access-rules editor renders

#### Scenario: Personal destination
- **WHEN** the committed destination is under the Personal root
- **THEN** no dependencies are listed and no request is made

#### Scenario: Kind without a form
- **WHEN** the Save panel opens for an application with an embedded editor (a Quick App) or a custom app
- **THEN** no dependencies are requested or listed under any root, an application with an embedded editor shows the neutral sentence for an Organization destination, and a custom app shows nothing

#### Scenario: Failed read
- **WHEN** the dependencies request rejects
- **THEN** the list is empty and Save stays enabled

#### Scenario: Resource of another user
- **GIVEN** a schema app whose values refer to a skill in another user's bucket and to a prompt in the caller's own bucket
- **WHEN** the dependencies of the values are requested
- **THEN** only the prompt is listed

#### Scenario: Schema id with a line break
- **WHEN** the request carries a `schemaId` containing a line break or a space
- **THEN** the response is `400` and nothing is resolved

#### Scenario: Empty form
- **WHEN** a schema app's form holds no values
- **THEN** the panel makes no dependencies request

#### Scenario: Project publish panel
- **WHEN** the user opens Publish for a project
- **THEN** the project container loads the list with `usePublishDependencies` and renders no section while the list is empty

### Requirement: The catalog Publish panel writes directly into a unit folder the user may approve
`DetailsPanel`'s publish flow SHALL receive from the host `canPublishDirectlyTo(item, folderPath, dependencies)` (backed by `useOrgUnitsContext` and the entity's namespace; `useDetailsPublish` adapts it to the flow's `canPublishDirectlyTo(folderPath)` and passes the loaded dependency list), `getPublishDirectUnavailableNote(item, folderPath, dependencies)` for the information note, and `onPublishDirectly(item, folderPath)`. When the selected folder satisfies `canPublishDirectlyTo`, submit SHALL call `onPublishDirectly`, which the host implements with the generated client's `copyCatalogEntityToOrgUnit` sending `{ folderPath, version }` with the item's version (no `version` for an unversioned type), and SHALL NOT call `onPublish`. Otherwise submit calls `onPublish` as before. The org-unit rights load and refresh when the panel becomes active, as they do today for the folder guards. `isPublishVisible` and the entity-type gate are unchanged: the panel is still offered for the user's own source item only.

For a direct destination the panel SHALL hide the author field and the credentials checkbox, and SHALL show one neutral line (`catalog.publish.directCredentialsNote`) for a toolset that would otherwise offer credentials. The item's publish-history marker is ignored for a direct destination (a direct write leaves no history), a credentials choice made on an earlier request folder is cleared on entering a direct one. The submit button keeps its label. The dependencies section keeps its source (`getPublishDependencies`, DIAL Core, no iframe special case) and its wording; when the user would otherwise write directly but lacks `write` on the namespace of a listed dependency, the folder stays usable, submit files a publication request, and the panel shows an information note (`catalog.publish.directUnavailableDependencies`) naming the missing types and saying a request is sent instead of a direct save. The direct path is chosen only after the dependency list has settled (success or failure): the panel shows the request layout while the list loads and switches at most once, to direct, after it settles. A failed dependency read leaves an empty list, so direct is offered and the server's namespace check is the backstop. The taken-name check SHALL be the existing `onCheckTargetExists` with the item's version: it asks the path the direct copy writes, and a `409` of the copy SHALL be recognised by `isTargetTakenError` so the same callout shows.

On success the host SHALL report a save into the folder (not "publish requested") with the Save panel's `resourceSavePanel.savedToFolder` text shown as a success notification, and keep the folder in the recent publish folders; like every other publish path it SHALL NOT refetch the catalog. On failure the panel SHALL stay open with the error announced assertively and submit enabled for a retry, which completes the copy and reuses what exists.

New strings: `catalog.publish.directCredentialsNote` and `catalog.publish.directUnavailableDependencies`; success and failure reuse the Save panel's `resourceSavePanel.savedToFolder` and the existing publish error notification. A missing `publications` right never disables a folder: the panel falls back to the request, so it has no reason string. RTL: no new directional UI. The feature stays gated by `features.orgUnitsEnabled`; with the flag off the panel never takes the direct path.

#### Scenario: Approver publishes directly
- **WHEN** the user holds the approval right in the unit and publishes their application to `Delivery/Teams`
- **THEN** `onPublishDirectly` is called with the item's version, no publication request is created, the panel closes and a "saved to the folder" notification is shown

#### Scenario: No approval right
- **WHEN** the user lacks the approval right in the unit
- **THEN** `onPublish` is called and a publication request is created

#### Scenario: Direct destination hides publication-only controls
- **WHEN** the selected folder is a direct destination
- **THEN** the author field and the credentials checkbox are not rendered

#### Scenario: Taken name
- **WHEN** the path the copy would write already exists
- **THEN** the existing taken-target callout shows before submit, and after a racing submit the copy's `409` shows the same callout

#### Scenario: Double submit
- **WHEN** a second submit reaches the server while the first still holds the application's staging copy and the server answers `409` with the publish-in-progress code
- **THEN** the panel shows that message as an error and does not mark the target as taken

#### Scenario: Mid-copy failure
- **WHEN** a dependency copy fails
- **THEN** the panel stays open with the error and submit enabled, and submitting again completes the copy

## REMOVED Requirements

### Requirement: Catalog publish flow wires the shared access-rules editor and includes rules in the publish request

**Reason**: Publication access rules are removed from DIAL Chat (change `remove-publish-access-rules`). `CatalogProps.ruleSourceOptions`, `hidePublishAccessRules` and `onFetchExistingRules` are deleted.

**Migration**: Hosts drop those props; `onPublish` is `(item, folderPath, author, publishCredentials)`. Manage folder publication rules in DIAL Core / DIAL Admin. Publish requests no longer send `rules`, so rules already stored on a folder are left untouched.

### Requirement: Selecting a destination folder pre-fills the rules editor with that folder's existing rules

**Reason**: Publication access rules are removed from DIAL Chat (change `remove-publish-access-rules`). `CatalogProps.ruleSourceOptions`, `hidePublishAccessRules` and `onFetchExistingRules` are deleted.

**Migration**: Hosts drop those props; `onPublish` is `(item, folderPath, author, publishCredentials)`. Manage folder publication rules in DIAL Core / DIAL Admin. Publish requests no longer send `rules`, so rules already stored on a folder are left untouched.

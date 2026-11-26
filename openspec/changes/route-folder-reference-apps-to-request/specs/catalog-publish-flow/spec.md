## MODIFIED Requirements

### Requirement: The catalog Publish panel writes directly into a unit folder the user may approve
`DetailsPanel`'s publish flow SHALL receive from the host `canPublishDirectlyTo(item, folderPath, dependencies)` (backed by `useOrgUnitsContext` and the entity's namespace; `useDetailsPublish` adapts it to the flow's `canPublishDirectlyTo(folderPath)` and passes the loaded dependency list), `getPublishDirectUnavailableNote(item, folderPath, dependencies)` for the information note, and `onPublishDirectly(item, folderPath)`. When the selected folder satisfies `canPublishDirectlyTo`, submit SHALL call `onPublishDirectly`, which the host implements with the generated client's `copyCatalogEntityToOrgUnit` sending `{ folderPath, version }` with the item's version (no `version` for an unversioned type), and SHALL NOT call `onPublish`. Otherwise submit calls `onPublish` as before. The org-unit rights load and refresh when the panel becomes active, as they do today for the folder guards. `isPublishVisible` and the entity-type gate are unchanged: the panel is still offered for the user's own source item only.

For a direct destination the panel SHALL hide the author field and the credentials checkbox, and SHALL show one neutral line (`catalog.publish.directCredentialsNote`) for a toolset that would otherwise offer credentials. The item's publish-history marker is ignored for a direct destination (a direct write leaves no history), a credentials choice made on an earlier request folder is cleared on entering a direct one. The submit button keeps its label. The dependencies section keeps its source (`getPublishDependencies`, DIAL Core, no iframe special case) and its wording; when the user would otherwise write directly but lacks `write` on the namespace of a listed dependency, the folder stays usable, submit files a publication request, and the panel shows a note (`catalog.publish.directUnavailableDependencies`) naming the missing types and saying a request is sent instead of a direct save. The same holds for an application whose listed dependencies include a folder of files when the user is not a DIAL admin: the folder stays usable, submit files a publication request, and the panel shows the note `catalog.publish.directUnavailableFolder`, saying a direct save is not possible because the application uses a folder of files. A DIAL admin is unaffected by it. When both reasons apply, the folder note is shown. Either note is the host's `directUnavailableNote`, which `PublishPanel` renders as the continuation of the text of the admin-approval callout (one callout), or as a callout of its own when another callout kind is shown. The direct path is chosen only after the dependency list has settled (success or failure): the panel shows the request layout while the list loads and switches at most once, to direct, after it settles. A failed dependency read leaves an empty list, so direct is offered and the server's namespace check and folder-reference check are the backstop. The taken-name check SHALL be the existing `onCheckTargetExists` with the item's version: it asks the path the direct copy writes, and a `409` of the copy SHALL be recognised by `isTargetTakenError` so the same callout shows.

On success the host SHALL report a save into the folder (not "publish requested") with the Save panel's `resourceSavePanel.savedToFolder` text shown as a success notification, and keep the folder in the recent publish folders; like every other publish path it SHALL NOT refetch the catalog. On failure the panel SHALL stay open with the error announced assertively and submit enabled for a retry, which completes the copy and reuses what exists. The server's `folderReferenceNeedsRequest` refusal, which can reach the panel only when the dependency read failed, is such a failure: it is shown as an error and the panel does not file the request by itself; the user chooses again.

New strings: `catalog.publish.directCredentialsNote`, `catalog.publish.directUnavailableDependencies` and `catalog.publish.directUnavailableFolder`; success and failure reuse the Save panel's `resourceSavePanel.savedToFolder` and the existing publish error notification. A missing `publications` right never disables a folder: the panel falls back to the request, so it has no reason string. RTL: no new directional UI. The feature stays gated by `features.orgUnitsEnabled`; with the flag off the panel never takes the direct path.

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

#### Scenario: Folder reference, regular user
- **GIVEN** a user who holds the approval right in the unit but is not a DIAL admin, and an application whose dependencies include a folder of files
- **WHEN** they select `Delivery/Teams`
- **THEN** the panel shows the `directUnavailableFolder` note, submit calls `onPublish` and a publication request is created

#### Scenario: Folder reference, DIAL admin
- **WHEN** a DIAL admin publishes the same application to a unit folder
- **THEN** `onPublishDirectly` is called and no note is shown

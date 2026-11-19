# Spec Delta

## ADDED Requirements

### Requirement: The catalog Publish panel writes directly into a unit folder the user may approve
`DetailsPanel`'s publish flow SHALL receive from the host `canPublishDirectlyTo(folderPath)` (backed by `useOrgUnitsContext` and the entity's namespace) and `onPublishDirectly(item, folderPath)`. When the selected folder satisfies `canPublishDirectlyTo`, submit SHALL call `onPublishDirectly`, which the host implements with the generated client's `copyCatalogEntityToOrgUnit` sending `{ folderPath, version }` with the item's version (no `version` for an unversioned type), and SHALL NOT call `onPublish`. Otherwise submit calls `onPublish` as before. The org-unit rights load and refresh when the panel becomes active, as they do today for the folder guards. `isPublishVisible` and the entity-type gate are unchanged: the panel is still offered for the user's own source item only.

For a direct destination the panel SHALL hide the access rules editor and SHALL NOT fetch the folder's existing rules, SHALL hide the author field and the credentials checkbox, and SHALL show one neutral line (`catalog.publish.directCredentialsNote`) for a toolset that would otherwise offer credentials. The item's publish-history marker is ignored for a direct destination (a direct write leaves no history), a credentials choice made on an earlier request folder is cleared on entering a direct one, and the rules of an earlier request folder are neither sent nor shown; moving back to a request folder loads that folder's rules again. The submit button keeps its label. The dependencies section keeps its source (`getPublishDependencies`, DIAL Core, no iframe special case) and its wording; when the user would otherwise write directly but lacks `write` on the namespace of a listed dependency, the folder stays usable, submit files a publication request, and the panel shows an information note (`catalog.publish.directUnavailableDependencies`) naming the missing types and saying a request is sent instead of a direct save. The direct path is chosen only after the dependency list has loaded (success or failure), so the panel does not switch mode while it loads. The taken-name check SHALL be the existing `onCheckTargetExists` with the item's version: it asks the path the direct copy writes, and a `409` of the copy SHALL be recognised by `isTargetTakenError` so the same callout shows.

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
- **THEN** the rules editor, the author field and the credentials checkbox are not rendered and no existing-rules fetch is made

#### Scenario: Taken name
- **WHEN** the path the copy would write already exists
- **THEN** the existing taken-target callout shows before submit, and after a racing submit the copy's `409` shows the same callout

#### Scenario: Double submit
- **WHEN** a second submit reaches the server while the first still holds the application's staging copy and the server answers `409` with the publish-in-progress code
- **THEN** the panel shows that message as an error and does not mark the target as taken

#### Scenario: Mid-copy failure
- **WHEN** a dependency copy fails
- **THEN** the panel stays open with the error and submit enabled, and submitting again completes the copy

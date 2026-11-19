# Spec Delta

## ADDED Requirements

### Requirement: The catalog Publish panel writes directly into a unit folder the user may approve
`DetailsPanel`'s publish flow SHALL receive from the host `canPublishDirectlyTo(folderPath)` (backed by `useOrgUnitsContext` and the entity's namespace) and `onPublishDirectly(item, folderPath)`. When the selected folder satisfies `canPublishDirectlyTo`, submit SHALL call `onPublishDirectly`, which the host implements with the generated client's `copyCatalogEntityToOrgUnit` sending `{ folderPath, asPublication: true, version }` with the item's version (no `version` for an unversioned type), and SHALL NOT call `onPublish`. Otherwise submit calls `onPublish` as before. Opening the Publish panel SHALL refresh the org-unit rights, as the Save panel does, so a stale answer lasts one request at most. `isPublishVisible` and the entity-type gate are unchanged: the panel is still offered for the user's own source item only.

For a direct destination the panel SHALL hide the access rules editor and SHALL NOT fetch the folder's existing rules, SHALL hide the author field and the credentials checkbox, and SHALL show one neutral line (`catalog.publish.directCredentialsNote`) for a toolset that would otherwise offer credentials. The dependencies section keeps its source (`getPublishDependencies`, DIAL Core, no iframe special case) and its wording; a unit folder where the user lacks `write` on a listed dependency's namespace SHALL be disabled with a typed reason through `getPublishDisabledReason`. The taken-name check SHALL be the existing `onCheckTargetExists` with the item's version: it asks the path the direct copy writes, and a `409` of the copy SHALL be recognised by `isTargetTakenError` so the same callout shows.

On success the host SHALL report a save into the folder (not "publish requested") through the existing operation notifications and keep the folder in the recent publish folders; like every other publish path it SHALL NOT refetch the catalog. On failure the panel SHALL stay open with the error announced assertively and submit enabled for a retry, which completes the copy and reuses what exists.

New strings: `catalog.publish.directSubmit`, `catalog.publish.directCredentialsNote`, `catalog.publish.directSuccess`, `catalog.publish.directFailed`, `orgUnitAccess.noWriteAccessDependencies` (existing) and one `orgUnitAccess.noPublishDirectAccess{Type}` per entity type for a missing `publications` right when it is the only missing one. RTL: no new directional UI. The feature stays gated by `features.orgUnitsEnabled`; with the flag off the panel never takes the direct path.

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

#### Scenario: Mid-copy failure
- **WHEN** a dependency copy fails
- **THEN** the panel stays open with the error and submit enabled, and submitting again completes the copy

## MODIFIED Requirements

### Requirement: The submit button label never embeds the destination name
`PublishFooter`'s submit button SHALL read a fixed label (`'Publish'`, or `'Update version {version}'` when replacing an existing version is allowed, or, for a direct destination, the host-supplied direct label `catalog.publish.directSubmit`) regardless of which folder or the root is selected. The destination name SHALL NOT be interpolated into the button label, since folder/entity names of arbitrary length would overflow the button.

#### Scenario: A long destination folder name is selected
- **WHEN** the user selects a destination folder or the root with an arbitrarily long name
- **THEN** the submit button still reads `'Publish'`, unaffected by the destination name's length

#### Scenario: A direct destination is selected
- **WHEN** the selected folder is a direct destination
- **THEN** the submit button reads the host's direct label, unaffected by the destination name's length

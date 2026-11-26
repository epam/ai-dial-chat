## MODIFIED Requirements

### Requirement: Save sequencing by destination and version

On the panel's Save, `runResourceSave` (`libs/chat-hooks/src/catalog/resource-save.ts`) SHALL run these steps through the resource's `ResourceSaveAdapter` (`libs/chat-hooks/src/catalog/resource-save.ts`):

| Destination | Version | Steps |
| --- | --- | --- |
| Personal, same folder | Keep | `saveInPlace` |
| Personal, other folder | Keep | `saveInPlace`, then `move(savedId, folder)` |
| Personal, any folder | New | `saveAsNewVersion(version, folder)` |
| Organization folder | Keep | `saveInPlace`, then `publishCatalogEntity(type, savedId, { folderPath, version: current })` |
| Organization folder | New | `saveAsNewVersion(version, currentPersonalFolder)`, then `publishCatalogEntity(type, newId, { folderPath, version })` |
| Personal folder (create) | — | `createIn(folder)` |
| Organization folder (create) | — | `createIn([])` (the Personal root), then `publishCatalogEntity(type, newId, { folderPath, version: form version })` |
| Org-unit folder the user may write to, Keep | Keep | `saveInPlace`, then the adapter's direct write into the unit folder; no `publishCatalogEntity` |
| Org-unit folder the user may write to, New | New | `saveAsNewVersion(version, currentPersonalFolder)`, then the direct write of the new id into the unit folder; no `publishCatalogEntity` |
| Org-unit folder the user may write to (create) | — | `createIn([])`, then the direct write into the unit folder; no `publishCatalogEntity` |

An Organization destination takes a direct-write row only when it lies inside an org unit whose owner grants `write` on the resource type's namespace and the rights are loaded (`org-units-folder-permissions`), and, for an application that refers to a folder of files, only when the user is a DIAL admin; every other Organization destination keeps the publish rows. A failure of the direct write after the first step SHALL be reported like a failed publish (`ResourceSavePanelI18nKeys.SavedButPublishFailed` is replaced there by a dedicated key naming the unit folder), except the server's `folderReferenceNeedsRequest` refusal, after which the save SHALL continue with the publish step of the same row family (a publication request for the saved id) and report it as a publication request, not as a failure.
The Save panel SHALL NOT render an access-rules editor for any destination and SHALL NOT load folder rules. The publish request SHALL carry no `rules`, no `author` and no `publishCredentials`, so DIAL Core keeps the folder's existing rules. After a successful publish the orchestrator SHALL call `rememberPublishFolder(folderPath)`.

Notifications, shown on success through `useOperationNotification` / `useNotification` helpers:

- `EntityOperation.Created` for a create, `EntityOperation.Edited` for a keep-version save;
- `ResourceSavePanelI18nKeys.NewVersionSaved` for a new version;
- the existing `EntityOperation.PublishRequested` copy of `useOperationNotification` when a publish followed;
- a "saved to {folder}" copy (no "publish requested" text) when a direct write into an org-unit folder followed.

After any outcome in which the save succeeded, the editor SHALL refetch its list, allow the next navigation, and navigate to `ROUTES.Catalog` (a created skill to its catalog item; a created Quick App stays in the editor, now in edit mode). When a later step fails (move or publish), the editor SHALL show `ResourceSavePanelI18nKeys.SavedButMoveFailed` or `SavedButPublishFailed` with the backend message and trace id, and still navigate. When the first step fails, the panel SHALL stay open with its submitting state cleared and an error announced through an assertive `LiveRegion`.

While a save runs, every panel control SHALL be disabled, and the Save button SHALL show the kit loading state labelled `ButtonsI18nKeys.Saving`.

#### Scenario: Keep version, same folder equals today's Save
- **WHEN** the user keeps the version and the destination is the resource's current Personal folder
- **THEN** exactly the request today's Save sends is made, no move or publish request is sent, and the editor returns to the Catalog

#### Scenario: Keep version, different Personal folder
- **WHEN** the user keeps the version and selects Personal `Design`
- **THEN** the resource is saved in place, then moved into `Design`, and the Catalog lists it under its new id

#### Scenario: Move fails after a successful save
- **WHEN** the save succeeds and the move answers 409
- **THEN** the "SavedButMoveFailed" notification shows and the editor returns to the Catalog

#### Scenario: Move to the Personal root fails
- **WHEN** the save succeeds and the move into the Personal root fails
- **THEN** the "SavedButMoveFailed" notification names the folder "Personal" (`CatalogI18nKeys.FolderPersonal`), not "Organization"

#### Scenario: Organization destination shows no rules editor
- **WHEN** the committed destination is Organization `EPAM`
- **THEN** no access-rules section renders in the Change folder view, no folder-rules request is made, and Save is enabled once the destination and version are valid

#### Scenario: New version keeps the old version unchanged
- **WHEN** the user saves toolset `search@1.0.0`, with unsaved edits, as new version `1.1.0` in Personal
- **THEN** `toolsets/{bucket}/search__1.1.0` holds the edits and `toolsets/{bucket}/search__1.0.0` is unchanged

#### Scenario: Organization destination saves then publishes
- **WHEN** the user keeps the version and selects Organization `EPAM/Delivery`
- **THEN** the resource is saved in place, then a publication request is created with `folderPath: "EPAM/Delivery"`, no `rules` and no author, and the `EntityOperation.PublishRequested` notification shows

#### Scenario: Direct write into a unit
- **WHEN** the user holds `write` on `applications` in unit `Delivery`, keeps the version and selects `Delivery/Teams`
- **THEN** the application is saved, written into `Delivery/Teams`, no publication request is created, and the "saved to" notification shows

#### Scenario: Folder reference refused by the server, request follows
- **GIVEN** a user who is not a DIAL admin with `write` on `applications` in unit `Delivery`, and a DIAL Loop application whose dependencies the panel cannot list
- **WHEN** they keep the version, select `Delivery/Teams`, and the direct write is answered with `folderReferenceNeedsRequest`
- **THEN** the application stays saved, a publication request is created for `Delivery/Teams`, and the `EntityOperation.PublishRequested` notification shows with no error

#### Scenario: Publish fails after a successful save
- **WHEN** the save succeeds and the publish request fails
- **THEN** the "SavedButPublishFailed" notification shows with the backend message and the editor returns to the Catalog

#### Scenario: First step fails
- **WHEN** the in-place save fails
- **THEN** the panel stays open, its controls are enabled again, and the failure is announced assertively

## ADDED Requirements

### Requirement: The Save panel announces a folder reference that sends the save to a request

The panel knows a folder reference when it lists the dependencies (a schema-form application): a listed `File` dependency that is a folder. For such an application and a user who is not a DIAL admin, an Organization destination inside an org unit SHALL take the publish rows of "Save sequencing by destination and version" and the folder SHALL stay selectable. For an application with an embedded editor, such as DIAL Loop opened in its editor, the panel cannot list the dependencies; the direct write is then tried as before and the sequencing requirement's `folderReferenceNeedsRequest` rule applies.

While the direct-write rows are not taken for this reason, the panel SHALL show one information note in the destination note slot saying that the application refers to a folder of files and a publication request is sent instead of a direct save (`resourceSavePanel.directUnavailableFolder`). The note SHALL NOT change which folders are enabled, and a DIAL admin and every application without a folder reference SHALL see no such note.

#### Scenario: Schema-form application with a folder reference
- **GIVEN** a user who is not a DIAL admin with `write` on applications in the unit, and a form whose dependencies include a folder
- **WHEN** they choose a folder of the unit
- **THEN** the note is shown before saving, and saving creates a publication request for that folder

#### Scenario: DIAL admin
- **WHEN** a DIAL admin saves the same application into a unit folder
- **THEN** no note is shown, the direct write is used and no publication request is created

#### Scenario: Application without a folder reference
- **WHEN** a user who is not a DIAL admin saves an application that refers to no folder into a unit folder they may write to
- **THEN** no note is shown and the direct write is used

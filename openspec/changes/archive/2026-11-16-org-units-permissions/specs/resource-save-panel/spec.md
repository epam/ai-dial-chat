## MODIFIED Requirements

### Requirement: Change folder view

**Change** SHALL replace the panel body with the Change folder view. It renders:

- a header with a back button (mirrored arrow in RTL, `aria-label` from `ButtonsI18nKeys.Back`) and the title `ResourceSavePanelI18nKeys.ChangeFolderTitle`;
- the kit `Search` (`ResourceSavePanelI18nKeys.SearchFolders`), with matches rendered through `Highlight`;
- `PublishFoldersTree` in multi-root mode with two roots, in this order:
  1. `SaveDestinationRoot.Personal` (`libs/chat-hooks/src/catalog/resource-save.ts`), labelled `ResourceSavePanelI18nKeys.PersonalRoot`. It holds the user's folders for that resource type, loaded lazily through `useResourceFolders` (`@epam/ai-dial-chat-hooks`) with the listing operation the editor passes to `ResourceSavePanelContainer` as `listPersonalFolders`;
  2. `SaveDestinationRoot.Organization`, labelled with the existing publish root label. It holds the public bucket folders from `apps/chat/src/hooks/publish/usePublishFolders.ts`. It renders only when the user could publish this item (own item and a publishable type).
- a footer with Cancel and Select (`ButtonsI18nKeys.Select`).

Every folder and both roots SHALL be selectable, except a row the org-unit rights disable (`org-units-folder-permissions`): while `features.orgUnitsEnabled` is on and the rights are loaded, an Organization folder inside an org unit whose owner grants no `write` on the resource type's namespace SHALL render disabled with the typed "You have no access to save your {type} to this folder." reason, and cannot be selected. A Personal folder, the Organization root and a folder outside every unit are never disabled. Inline folder creation (the trailing button and the per-row "Add child" / "Add sibling" items) SHALL work under both roots, with the same validation and local-only semantics as the Publish flow. Select commits the pending destination and returns to the main view. Back and Cancel discard it and return.

Empty and loading states: a root whose first level is loading shows the tree's loading row. A listing failure shows `ResourceSavePanelI18nKeys.FoldersLoadFailed` above the tree, through an assertive `LiveRegion`, with a Retry button. A search that matches nothing shows the tree's existing no-results state.

#### Scenario: User picks a Personal subfolder
- **WHEN** the user opens Change, expands Personal, selects `Design/Audit Agents` and presses Select
- **THEN** the main view shows "Personal / Design / Audit Agents" as the destination

#### Scenario: Back discards the pending choice
- **WHEN** the user selects an Organization folder in the Change view and presses Back
- **THEN** the main view still shows the previously committed destination

#### Scenario: All folders are selectable
- **WHEN** the Change view lists folders under both roots and `features.orgUnitsEnabled` is off, or the rights are not loaded
- **THEN** none is rendered disabled and no "no access" tooltip appears

#### Scenario: Unit without write is disabled
- **WHEN** the rights are loaded and Organization unit `Sales` grants no `write` on `applications` for a Quick App save
- **THEN** the `Sales` row is disabled with the tooltip "You have no access to save your QuickApp to this folder." and Select stays unavailable while it is the pending choice

#### Scenario: Organization root hidden when the item cannot be published
- **WHEN** the panel opens for a resource the user does not own
- **THEN** the Change view shows only the Personal root

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

An Organization destination takes a direct-write row only when it lies inside an org unit whose owner grants `write` on the resource type's namespace and the rights are loaded (`org-units-folder-permissions`); every other Organization destination keeps the publish rows. The access rules editor SHALL NOT render for a direct-write destination, and a failure of the direct write after the first step SHALL be reported like a failed publish (`ResourceSavePanelI18nKeys.SavedButPublishFailed` is replaced there by a dedicated key naming the unit folder).
In the Change folder view, while an Organization folder is selected, the access rules editor (`PublishAccessRules`) SHALL render below the tree, pre-filled with that folder's existing rules. The publish request SHALL carry those rules, and no `author` and no `publishCredentials`. While the committed destination is an Organization folder whose rules are still loading or failed to load, Save SHALL be disabled and `submit` SHALL do nothing, so a publish never sends empty rules over the folder's existing ones. After a successful publish the orchestrator SHALL call `rememberPublishFolder(folderPath)`.

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

#### Scenario: Organization rules not loaded
- **WHEN** the committed destination is Organization `EPAM` and its rules are still loading or failed to load
- **THEN** Save is disabled and no save or publish request is sent

#### Scenario: New version keeps the old version unchanged
- **WHEN** the user saves toolset `search@1.0.0`, with unsaved edits, as new version `1.1.0` in Personal
- **THEN** `toolsets/{bucket}/search__1.1.0` holds the edits and `toolsets/{bucket}/search__1.0.0` is unchanged

#### Scenario: Organization destination saves then publishes
- **WHEN** the user keeps the version and selects Organization `EPAM/Delivery`
- **THEN** the resource is saved in place, then a publication request is created with `folderPath: "EPAM/Delivery"`, the folder's access rules and no author, and the `EntityOperation.PublishRequested` notification shows

#### Scenario: Direct write into a unit
- **WHEN** the user holds `write` on `applications` in unit `Delivery`, keeps the version and selects `Delivery/Teams`
- **THEN** the application is saved, written into `Delivery/Teams`, no publication request is created, and the "saved to" notification shows

#### Scenario: Publish fails after a successful save
- **WHEN** the save succeeds and the publish request fails
- **THEN** the "SavedButPublishFailed" notification shows with the backend message and the editor returns to the Catalog

#### Scenario: First step fails
- **WHEN** the in-place save fails
- **THEN** the panel stays open, its controls are enabled again, and the failure is announced assertively

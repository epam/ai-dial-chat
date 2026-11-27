## MODIFIED Requirements

### Requirement: Save opens the Save panel in every in-scope editor

The primary Save (or Create) action of these editors SHALL open the Save panel instead of persisting immediately:

- the Quick App editor, schema-form app editor and custom app editor (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`);
- the toolset editor (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`);
- the prompt editor (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx`);
- the skill editor (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`).

The editor's existing validation, including the creation-permission check in create mode, SHALL run first. When it fails, the panel SHALL NOT open and the existing inline errors SHALL show.

The panel opens when creating a resource, and when editing one the user owns (`isMy` on the loaded deployment, toolset or prompt, an application or toolset created in this session, or a skill in the user's own bucket). For a resource shared with the user, Save keeps saving in place, because moving and forking act on the caller's own bucket.

In create mode the editor passes a `ResourceCreateSaveAdapter` (`createIn(folderPath)`, `libs/chat-hooks/src/catalog/resource-save-adapter.ts`) and the panel offers no Version section; the version comes from the form. A new Quick App, which that Save only starts before its embedded editor is set up, SHALL offer the Personal root only; after the create the page switches to edit mode in place, and later Saves offer both roots.

State ownership: each editor owns `isOpen` and the adapter it built when the panel opened; `useResourceSavePanel` (`libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`) owns the committed destination, the version mode, the new-version value, the version error and the submitting state.

#### Scenario: Save opens the panel without persisting
- **WHEN** a user edits an existing Quick App, toolset, custom app, schema-form app, prompt or skill they own and clicks Save with a valid form
- **THEN** the Save panel opens, and no save, update, move or publish request has been sent

#### Scenario: Create opens the panel
- **WHEN** a user fills a new prompt and clicks Create
- **THEN** the Save panel opens with no Version section, and no create request is sent until the panel's Save is confirmed

#### Scenario: New Quick App offers Personal folders only
- **WHEN** a user clicks Create on a new Quick App
- **THEN** the panel's Change folder view lists only the Personal root, and after the panel's Save the page switches to edit mode for the created application

#### Scenario: Invalid form keeps the panel closed
- **WHEN** the user clicks Save while a required metadata field is invalid
- **THEN** the panel does not open and the field shows its inline error, as today

#### Scenario: Cancel persists nothing
- **WHEN** the panel is open and the user presses Cancel, the close button or Escape
- **THEN** the panel closes, focus returns to the Save button, nothing is persisted, and the unsaved edits remain in the editor

#### Scenario: Shared resource saves in place
- **WHEN** the user edits a toolset shared with them (`isMy: false`) and clicks Save
- **THEN** the toolset is updated in place and no Save panel opens

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

An Organization destination takes a direct-write row only when it lies inside an org unit whose owner grants `write` on the resource type's namespace and the rights are loaded (`org-units-folder-permissions`); every other Organization destination keeps the publish rows. A failure of the direct write after the first step SHALL be reported like a failed publish (`ResourceSavePanelI18nKeys.SavedButPublishFailed` is replaced there by a dedicated key naming the unit folder).
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

#### Scenario: Publish fails after a successful save
- **WHEN** the save succeeds and the publish request fails
- **THEN** the "SavedButPublishFailed" notification shows with the backend message and the editor returns to the Catalog

#### Scenario: First step fails
- **WHEN** the in-place save fails
- **THEN** the panel stays open, its controls are enabled again, and the failure is announced assertively

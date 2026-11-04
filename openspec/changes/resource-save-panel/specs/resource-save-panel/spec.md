## ADDED Requirements

### Requirement: Save in edit mode opens the Save panel in every in-scope editor

In edit mode, the primary Save action of these editors SHALL open the Save panel instead of persisting immediately:

- the Quick App editor, schema-form app editor and custom app editor (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`);
- the toolset editor (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`);
- the prompt editor (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx`).

The editor's existing validation SHALL run first. When it fails, the panel SHALL NOT open and the existing inline errors SHALL show. Create mode SHALL keep its current behaviour. The skill editor (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`) SHALL keep its in-place Save and render no Save panel.

The panel opens only for a resource the user owns (`isMy` on the loaded deployment, toolset or prompt, or an application created in this session). For a resource shared with the user, Save keeps saving in place, because moving and forking act on the caller's own bucket.

State ownership: each editor owns `isOpen` and the adapter it built when the panel opened; `useResourceSavePanel` (`apps/chat/src/hooks/resource-save/useResourceSavePanel.ts`) owns the committed destination, the version mode, the new-version value, the version error and the submitting state.

#### Scenario: Save opens the panel without persisting
- **WHEN** a user edits an existing Quick App, toolset, custom app, schema-form app or prompt and clicks Save with a valid form
- **THEN** the Save panel opens, and no save, update, move or publish request has been sent

#### Scenario: Invalid form keeps the panel closed
- **WHEN** the user clicks Save while a required metadata field is invalid
- **THEN** the panel does not open and the field shows its inline error, as today

#### Scenario: Cancel persists nothing
- **WHEN** the panel is open and the user presses Cancel, the close button or Escape
- **THEN** the panel closes, focus returns to the Save button, nothing is persisted, and the unsaved edits remain in the editor

#### Scenario: Create mode is unchanged
- **WHEN** the user clicks Create on a new resource
- **THEN** the resource is created exactly as before and no Save panel opens

#### Scenario: Shared resource saves in place
- **WHEN** the user edits a toolset shared with them (`isMy: false`) and clicks Save
- **THEN** the toolset is updated in place and no Save panel opens

#### Scenario: Skill editor is unchanged
- **WHEN** the user clicks Save in `/skill-editor` for an existing skill
- **THEN** the skill is saved in place and no Save panel opens

### Requirement: Save panel main view

The panel SHALL be `StandaloneSaveToFolderPanel` from `@epam/ai-dial-publish-panel`, an end-edge `SideDrawer` that behaves as a modal dialog. Its title is an `h1` reading "Save {resource type}". The main view SHALL render, in order:

1. the entity summary (`ResourceSummary`): icon, type badge, name, and current version for versioned resources;
2. a **Save to folder** section showing the committed destination as a breadcrumb (root label, then folder segments) with a **Change** action. Long paths collapse their middle segments to "…" with the full path in a tooltip;
3. for versioned resources only (applications, toolsets), a **Version** section rendered as the kit `RadioGroup` with a visible legend:
   - "Keep version {current}", selected by default;
   - "Save as new version", which reveals a required Version input;
4. a footer with Cancel and Save.

Prompts SHALL render no Version section. The panel SHALL NOT render a Versions history list or a Dependencies section.

The initial destination SHALL be the Personal root with the resource's current folder (`parseResourceFolderPath(id)` from `@epam/ai-dial-chat-hooks`).

i18n keys:

- `ResourceSavePanelI18nKeys.Title` (with `{type}`), `SaveToFolderHeading`, `ChangeFolder`, `VersionHeading`, `KeepVersion` (with `{version}`), `SaveAsNewVersion`, `NewVersionLabel`, `NewVersionPlaceholder`, `PersonalRoot`;
- `ButtonsI18nKeys.Save`, `ButtonsI18nKeys.Cancel`.

RTL: logical properties only. The breadcrumb separators (chevrons) are mirrored with `rtl:scale-x-[-1]`.

#### Scenario: Default state for a versioned resource
- **WHEN** the panel opens for Quick App `Design Review Agent` at version `1.0.0` in the Personal root
- **THEN** the summary shows the name with `1.0.0`, Save to folder reads "Personal", and "Keep version 1.0.0" is selected

#### Scenario: Default state for a prompt in a folder
- **WHEN** the panel opens for a prompt whose id is `prompts/{bucket}/Work/AI/Summarize`
- **THEN** Save to folder reads "Personal › Work › AI" and no Version section is rendered

#### Scenario: No history or dependencies
- **WHEN** the panel is open for any resource
- **THEN** no Versions history list and no Dependencies section is rendered

### Requirement: New version input validation

When "Save as new version" is selected, Save SHALL stay disabled until the input holds a version that matches `SEMVER_VERSION_PATTERN` (from `@epam/ai-dial-builder-form`) and differs from the current version. The error text SHALL be wired through the kit `Input` `error` prop (`aria-invalid` and `aria-describedby`). It shows after blur or a submit attempt.

When the backend answers 409 (the version already exists in the target folder), the input SHALL show `ResourceSavePanelI18nKeys.VersionExists`, and the panel SHALL stay open with nothing else persisted.

i18n keys: `ResourceSavePanelI18nKeys.VersionInvalid`, `VersionUnchanged`, `VersionExists`.

#### Scenario: Unchanged version is rejected
- **WHEN** the user selects "Save as new version" and types the current version `1.0.0`
- **THEN** the input shows "VersionUnchanged" after blur and Save is disabled

#### Scenario: Existing version is rejected by the backend
- **WHEN** the user saves as new version `1.1.0` and the backend answers 409
- **THEN** the input shows "VersionExists", the panel stays open, and the old version is unchanged

### Requirement: Change folder view

**Change** SHALL replace the panel body with the Change folder view. It renders:

- a header with a back button (mirrored arrow in RTL, `aria-label` from `ButtonsI18nKeys.Back`) and the title `ResourceSavePanelI18nKeys.ChangeFolderTitle`;
- the kit `Search` (`ResourceSavePanelI18nKeys.SearchFolders`), with matches rendered through `Highlight`;
- `PublishFoldersTree` in multi-root mode with two roots, in this order:
  1. `SaveDestinationRoot.Personal` (`apps/chat/src/types/resource-save.ts`), labelled `ResourceSavePanelI18nKeys.PersonalRoot`. It holds the user's folders for that resource type, loaded lazily through `useResourceFolders` (`@epam/ai-dial-chat-hooks`) with the listing operation the editor passes to `ResourceSavePanelContainer` as `listPersonalFolders`;
  2. `SaveDestinationRoot.Organization`, labelled with the existing publish root label. It holds the public bucket folders from `apps/chat/src/hooks/publish/usePublishFolders.ts`. It renders only when the user could publish this item (own item and a publishable type).
- a footer with Cancel and Select (`ButtonsI18nKeys.Select`).

Every folder and both roots SHALL be selectable. No row SHALL render disabled or with a "no access" tooltip. Inline folder creation (the trailing button and the per-row "Add child" / "Add sibling" items) SHALL work under both roots, with the same validation and local-only semantics as the Publish flow. Select commits the pending destination and returns to the main view. Back and Cancel discard it and return.

Empty and loading states: a root whose first level is loading shows the tree's loading row. A listing failure shows `ResourceSavePanelI18nKeys.FoldersLoadFailed` above the tree, through an assertive `LiveRegion`, with a Retry button. A search that matches nothing shows the tree's existing no-results state.

#### Scenario: User picks a Personal subfolder
- **WHEN** the user opens Change, expands Personal, selects `Design/Audit Agents` and presses Select
- **THEN** the main view shows "Personal › Design › Audit Agents" as the destination

#### Scenario: Back discards the pending choice
- **WHEN** the user selects an Organization folder in the Change view and presses Back
- **THEN** the main view still shows the previously committed destination

#### Scenario: All folders are selectable
- **WHEN** the Change view lists folders under both roots
- **THEN** none is rendered disabled and no "no access" tooltip appears

#### Scenario: Organization root hidden when the item cannot be published
- **WHEN** the panel opens for a resource the user does not own
- **THEN** the Change view shows only the Personal root

### Requirement: Save sequencing by destination and version

On the panel's Save, `runResourceSave` (`apps/chat/src/utils/resource-save.ts`) SHALL run these steps through the resource's `ResourceSaveAdapter` (`apps/chat/src/models/resource-save.ts`):

| Destination | Version | Steps |
| --- | --- | --- |
| Personal, same folder | Keep | `saveInPlace` |
| Personal, other folder | Keep | `saveInPlace`, then `move(savedId, folder)` |
| Personal, any folder | New | `saveAsNewVersion(version, folder)` |
| Organization folder | Keep | `saveInPlace`, then `publishCatalogEntity(type, savedId, { folderPath, version: current })` |
| Organization folder | New | `saveAsNewVersion(version, currentPersonalFolder)`, then `publishCatalogEntity(type, newId, { folderPath, version })` |

In the Change folder view, while an Organization folder is selected, the access rules editor (`PublishAccessRules`) SHALL render below the tree, pre-filled with that folder's existing rules. The publish request SHALL carry those rules, and no `author` and no `publishCredentials`. After a successful publish the orchestrator SHALL call `rememberPublishFolder(folderPath)`.

Notifications, shown on success through `useOperationNotification` / `useNotification` helpers:

- `EntityOperation.Edited` for a keep-version save;
- `ResourceSavePanelI18nKeys.NewVersionSaved` for a new version;
- the existing `EntityOperation.PublishRequested` copy of `useOperationNotification` when a publish followed.

After any outcome in which the save succeeded, the editor SHALL refetch its list, allow the next navigation, and navigate to `ROUTES.Catalog`. When a later step fails (move or publish), the editor SHALL show `ResourceSavePanelI18nKeys.SavedButMoveFailed` or `SavedButPublishFailed` with the backend message and trace id, and still navigate. When the first step fails, the panel SHALL stay open with its submitting state cleared and an error announced through an assertive `LiveRegion`.

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

#### Scenario: New version keeps the old version unchanged
- **WHEN** the user saves toolset `search@1.0.0`, with unsaved edits, as new version `1.1.0` in Personal
- **THEN** `toolsets/{bucket}/search__1.1.0` holds the edits and `toolsets/{bucket}/search__1.0.0` is unchanged

#### Scenario: Organization destination saves then publishes
- **WHEN** the user keeps the version and selects Organization `EPAM/Delivery`
- **THEN** the resource is saved in place, then a publication request is created with `folderPath: "EPAM/Delivery"`, the folder's access rules and no author, and the `EntityOperation.PublishRequested` notification shows

#### Scenario: Publish fails after a successful save
- **WHEN** the save succeeds and the publish request fails
- **THEN** the "SavedButPublishFailed" notification shows with the backend message and the editor returns to the Catalog

#### Scenario: First step fails
- **WHEN** the in-place save fails
- **THEN** the panel stays open, its controls are enabled again, and the failure is announced assertively

### Requirement: Quick App new version uses fork, save, commit

For a Quick App (embedded-editor writer), `saveAsNewVersion` SHALL run:

1. `forkApplicationVersion` (`POST /api/v1/applications/:applicationName/versions`), which returns the snapshot id;
2. the existing `TriggerSave` to the current app id;
3. `commitApplicationVersion` (`POST /api/v1/applications/:applicationName/versions/commit`) with that snapshot id.

When step 2 fails or times out, the adapter SHALL delete the snapshot through the existing `deleteApplication` and rethrow. When step 3 fails, the adapter SHALL throw an error whose message is `ResourceSavePanelI18nKeys.CommitFailed`, naming both versions.

Host-written kinds (schema-form, custom app, toolset) SHALL implement `saveAsNewVersion` as one create-only write of the edited values with `{ version, folderPath, createOnly: true }`, and SHALL NOT call fork or commit.

#### Scenario: Quick App new version holds the edits
- **WHEN** the user saves Quick App `agent@1.0.0`, with unsaved embedded-editor edits, as `1.1.0`
- **THEN** after commit, `agent__1.1.0` holds the edits and `agent__1.0.0` holds its pre-edit content

#### Scenario: Embedded save fails after fork
- **WHEN** the fork succeeds and the embedded editor reports `SaveError`
- **THEN** the snapshot is deleted, no new version remains, and the panel shows the error

### Requirement: Resource save panel accessibility and responsiveness

The panel SHALL take focus on open, trap Tab, close on Escape, and return focus to the editor's Save button on close (the `SideDrawer` contract). Switching views SHALL move focus to the new view's heading. Every Tabler icon SHALL pass `stroke={DIAL_KIT_ICON_STROKE}` and be `aria-hidden` inside labelled controls. On phone width the panel SHALL take the full width. On tablet and desktop it uses the `SideDrawer` default width, and the main view's sections scroll above a pinned footer.

Memoisation: the container SHALL pass the labels object through `useMemo` and every callback through `useCallback`. The lib components are `memo`-wrapped.

#### Scenario: View switch moves focus
- **WHEN** the user activates Change
- **THEN** focus moves to the "Change folder" heading, and Back returns focus to the Change button

#### Scenario: Phone layout
- **WHEN** the viewport is under 768px wide
- **THEN** the panel spans the full width with the footer pinned to the bottom

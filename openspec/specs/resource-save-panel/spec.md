# resource-save-panel Specification

## Purpose
TBD - created by archiving change resource-save-panel. Update Purpose after archive.
## Requirements
### Requirement: Save opens the Save panel in every in-scope editor

The primary Save (or Create) action of these editors SHALL open the Save panel instead of persisting immediately:

- the Quick App editor, schema-form app editor and custom app editor (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`);
- the toolset editor (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`);
- the prompt editor (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx`);
- the skill editor (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`).

The editor's existing validation, including the creation-permission check in create mode, SHALL run first. When it fails, the panel SHALL NOT open and the existing inline errors SHALL show.

The panel opens when creating a resource, and when editing one the user owns (`isMy` on the loaded deployment, toolset or prompt, an application or toolset created in this session, or a skill in the user's own bucket). For a resource shared with the user, Save keeps saving in place, because moving and forking act on the caller's own bucket.

In create mode the editor passes a `ResourceCreateSaveAdapter` (`createIn(folderPath)`, `libs/chat-hooks/src/catalog/resource-save-adapter.ts`) and the panel offers no Version section; the version comes from the form. A new Quick App, which that Save only starts before its embedded editor is set up, SHALL offer the Personal root only; after the create the page switches to edit mode in place, and later Saves offer both roots.

State ownership: each editor owns `isOpen` and the adapter it built when the panel opened; `useResourceSavePanel` (`libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`) owns the committed destination, the version mode, the new-version value, the version error, the access rules and the submitting state.

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

### Requirement: Save panel main view

The panel SHALL be `StandaloneSaveToFolderPanel` from `@epam/ai-dial-publish-panel`, an end-edge `SideDrawer` that behaves as a modal dialog. Its title is an `h1` reading "Save {resource type}". The main view SHALL render, in order:

1. the entity summary (`ResourceSummary`): icon, type badge, name, and current version for versioned resources;
2. a **Save to folder** section showing the committed destination as the kit `FolderName` — the file manager's folder icon, then the root label and folder segments joined with " / " in a secondary text color, truncated with the full path in a tooltip — followed by a small ghost **Change** action;
3. for versioned resources only (applications, toolsets), a **Version** section rendered as the kit `RadioGroup` with a visible legend:
   - "Keep version {current}", selected by default;
   - "Save as new version", which reveals a required Version input;
4. a footer with Cancel and Save.

Prompts SHALL render no Version section. The panel SHALL NOT render a Versions history list or a Dependencies section.

The initial destination SHALL be the Personal root with the resource's current folder (`parseResourceFolderPath(id)` from `@epam/ai-dial-chat-hooks`).

i18n keys:

- `ResourceSavePanelI18nKeys.Title` (with `{type}`), `SaveToFolderHeading`, `ChangeFolder`, `KeepVersion` (with `{version}`), `SaveAsNewVersion`, `NewVersionLabel`, `NewVersionPlaceholder`, `PersonalRoot`;
- `EditorI18nKeys.VersionLabel` for the Version heading;
- `ButtonsI18nKeys.Save`, `ButtonsI18nKeys.Cancel`.

RTL: logical properties only.

#### Scenario: Default state for a versioned resource
- **WHEN** the panel opens for Quick App `Design Review Agent` at version `1.0.0` in the Personal root
- **THEN** the summary shows the name with `1.0.0`, Save to folder reads "Personal", and "Keep version 1.0.0" is selected

#### Scenario: Default state for a prompt in a folder
- **WHEN** the panel opens for a prompt whose id is `prompts/{bucket}/Work/AI/Summarize`
- **THEN** Save to folder reads "Personal / Work / AI" and no Version section is rendered

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
- `FolderDestinationTree` in multi-root mode with two roots, in this order:
  1. `SaveDestinationRoot.Personal` (`libs/chat-hooks/src/catalog/resource-save.ts`), labelled `ResourceSavePanelI18nKeys.PersonalRoot`. It holds the user's folders for that resource type, loaded lazily through `useResourceFolders` (`@epam/ai-dial-chat-hooks`) with the listing operation the editor passes to `ResourceSavePanelContainer` as `listPersonalFolders`;
  2. `SaveDestinationRoot.Organization`, labelled with the existing publish root label. It holds the public bucket folders from `apps/chat/src/hooks/publish/usePublishFolders.ts`. It renders only when the user could publish this item (own item and a publishable type).
- a footer with Cancel and Select (`ButtonsI18nKeys.Select`).

Every folder and both roots SHALL be selectable. No row SHALL render disabled or with a "no access" tooltip. Inline folder creation (the trailing button and the per-row "Add child" / "Add sibling" items) SHALL work under both roots, with the same validation and local-only semantics as the Publish flow. Select commits the pending destination and returns to the main view. Back and Cancel discard it and return.

Empty and loading states: a root whose first level is loading shows the tree's loading row. A listing failure shows `ResourceSavePanelI18nKeys.FoldersLoadFailed` above the tree, through an assertive `LiveRegion`, with a Retry button. A search that matches nothing shows the tree's existing no-results state.

#### Scenario: User picks a Personal subfolder
- **WHEN** the user opens Change, expands Personal, selects `Design/Audit Agents` and presses Select
- **THEN** the main view shows "Personal / Design / Audit Agents" as the destination

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

In the Change folder view, while an Organization folder is selected, the access rules editor (`PublishAccessRules`) SHALL render below the tree, pre-filled with that folder's existing rules. The publish request SHALL carry those rules, and no `author` and no `publishCredentials`. While the committed destination is an Organization folder whose rules are still loading or failed to load, Save SHALL be disabled and `submit` SHALL do nothing, so a publish never sends empty rules over the folder's existing ones. After a successful publish the orchestrator SHALL call `rememberPublishFolder(folderPath)`.

Notifications, shown on success through `useOperationNotification` / `useNotification` helpers:

- `EntityOperation.Created` for a create, `EntityOperation.Edited` for a keep-version save;
- `ResourceSavePanelI18nKeys.NewVersionSaved` for a new version;
- the existing `EntityOperation.PublishRequested` copy of `useOperationNotification` when a publish followed.

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

The commit SHALL write the edits into the snapshot first and restore the source second, both with `If-Match`. When restoring the source fails, it SHALL write the snapshot's pre-edit body back before answering the error, so a failed commit leaves the edits in the current version, as `CommitFailed` says. A failure SHALL never leave the edits in neither version. The fork SHALL derive the base name from the text before the last `__`, so a name that itself contains `__` keeps it.

Host-written kinds (schema-form, custom app, toolset) SHALL implement `saveAsNewVersion` as one create-only write of the edited values with `{ version, folderPath, createOnly: true }`, and SHALL NOT call fork or commit.

#### Scenario: Quick App new version holds the edits
- **WHEN** the user saves Quick App `agent@1.0.0`, with unsaved embedded-editor edits, as `1.1.0`
- **THEN** after commit, `agent__1.1.0` holds the edits and `agent__1.0.0` holds its pre-edit content

#### Scenario: Restoring the source fails during commit
- **WHEN** the commit writes the edits into `agent__1.1.0` and then restoring `agent__1.0.0` fails
- **THEN** `agent__1.1.0` gets its pre-edit body back, `agent__1.0.0` still holds the edits, and the panel shows `CommitFailed`

#### Scenario: Name containing the separator
- **WHEN** the user saves Quick App `my__app@1.0.0` (`my__app__1.0.0`) as `1.1.0`
- **THEN** the snapshot is `my__app__1.1.0`

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

### Requirement: Skill editor saves through the Save panel

`useSkillEditorSubmit` (`libs/chat-hooks/src/skill/useSkillEditorSubmit.ts`) SHALL accept an optional `onSaveRequest(adapter, values)`. When the page passes it, a submit that passes the hook's validation SHALL NOT write anything itself: it SHALL build a `ResourceSaveAdapter`, hand it to `onSaveRequest`, and show no success notification and not navigate.

- Create: `createIn(folderPath)` calls `client.createSkill(bucket, [...folderPath, normalizedName].join('/'), …)`, refetches the skills, and resolves `skills/{bucket}/{path}`.
- Edit: `saveInPlace()` calls `client.updateSkill(…, etag)` and advances the stored ETag; `move(id, folderPath)` calls `client.moveSkill(path, folderPath)` (`POST /api/v1/skills/move`). A skill has no version, so the panel offers no Version section.
- Every write failure rejects with a `ResourceSaveError` carrying the message the inline flow showed: 409 → name conflict; 412 on edit → the stale-edit message, while the page's conflict state with Reload latest still appears; 413; 503; 400 → the backend message or the path-invalid fallback; otherwise the generic save error.

The Personal tree lists the skill's grouping folders through `createSkillFolderLister(skillsApi, bucket)` (`libs/chat-hooks/src/catalog/resource-save-adapters.ts`).

#### Scenario: A new skill is created in the chosen folder
- **WHEN** the user creates skill "Good morning" and picks Personal `team-a` in the panel
- **THEN** `createSkill(bucket, 'team-a/good-morning', …)` is sent and the page navigates to the catalog item `skills/{bucket}/team-a/good-morning`

#### Scenario: A name conflict shows in the panel
- **WHEN** `createSkill` rejects with 409 during the panel's Save
- **THEN** the panel shows the name-conflict message, stays open, and the form keeps its values

#### Scenario: A skill shared with the user saves in place
- **WHEN** the user saves a writable skill in another user's bucket
- **THEN** `updateSkill` is sent directly and no Save panel opens

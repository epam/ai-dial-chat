## Why

Saving an existing resource in its editor writes it back in place. There is no way to choose where it lives, fork a new version, or send it to an Organization folder without leaving the editor for the Catalog's Publish panel. The new design (Figma "QuickApp_Publish/Save", which applies to every resource editor) makes **Save** open a "Save {Resource}" side panel. The user picks a destination folder (Personal or Organization) and, for versioned resources, keeps the current version or saves a new one, all in one step.

## Problem

- **Every editor saves in place, then returns to the Catalog:**
  - Quick Apps, schema-form apps and custom apps: `ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx:455`, `handleSubmit` → `persist`);
  - toolsets: `ToolsetApplicationEditor` (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx:171`, `updateToolset`);
  - prompts: `PromptEditor` (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx:242`, `updatePrompt`).
- **Folder and version are not part of a save:**
  - The Version field stays editable in edit mode and only renames `display_version` in place.
  - Applications and toolsets are always stored flat at `{type}/{bucket}/{name}__{version}` (`buildApplicationPath`, `apps/chat-api/src/applications/applications.service.ts:49`; `apps/chat-api/src/toolsets/mutation/toolsets-mutation.service.ts:73`).
  - Prompts have folders and a move endpoint, but the prompt editor deliberately shows no folder control (`openspec/specs/prompt-editor/spec.md`, "The editor screen does not move or manage prompt folders").
- **Publishing to an Organization folder** exists only in the Catalog (`useCatalogPublishing`, `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts:74`).

## Solution

- **In-scope editors**: Quick Apps, schema-form apps, custom apps, toolsets and prompts. In each, **Save in edit mode opens a "Save {Resource}" panel** instead of saving immediately. Create keeps today's behaviour. The panel is an end-edge `SideDrawer`, modelled on `StandalonePublishPanel` (`libs/publish-panel/src/components/PublishPanel/StandalonePublishPanel.tsx`), with:
  - an entity summary card: icon, type badge, name and current version (`ResourceSummary`);
  - a **Save to folder** row showing the current destination as a breadcrumb, plus a **Change** action;
  - a **Version** radio group, *for versioned resources only* (applications, toolsets): "Keep version {current}" (default) or "Save as new version" with a version input (`SEMVER_VERSION_PATTERN`, must differ from the current version). Prompts render no Version section;
  - a Cancel / Save footer.
- **Change folder view** replaces the panel body. It has a back arrow, folder search, and a tree with two roots:
  - **Personal**: the user's folders for that resource type;
  - **Organization**: the public bucket, the same data as Publish via `usePublishFolders`.

  Inline folder creation works as in the Publish flow. Every folder is selectable, with no disabled or "no access" rows. Select or Cancel returns to the main view.
- **What Save does** depends on the destination and the version choice. Each resource type supplies the operations through an app-level adapter:
  - **Personal, Keep version**: save in place as today. If the folder changed, also move the resource there.
  - **Personal, new version**: write `{folder}/{name}__{newVersion}` holding the edits. The old version stays exactly as it was last saved.
    - Host-written editors (schema-form, custom apps, toolsets) do this with a create-only write of the edited values.
    - Quick Apps, whose embedded editor is the single writer, use a fork / save / commit sequence (design D3).
  - **Organization**: do the Personal save in the resource's current folder (keeping or forking the version), then send the existing catalog publish request for the saved resource with `folderPath` = the chosen folder.
  - On success, notify and return to the Catalog, as Save does today.
- **The Version field is read-only in edit mode** for applications and toolsets. `MetadataForm` gains `isVersionReadOnly`, following `isNameReadOnly`.
- **New BFF endpoints** for applications and toolsets: list Personal folders, move to a folder, and a `folderPath` on create-only writes. Applications also get fork/commit for Quick Apps. Prompts reuse the existing folder listing and `POST /api/v1/prompts/move`. See design.md.

## Non-goals

- **Skills.** DIAL Core has no move or rename for a whole skill, and `skill-editing` forbids create-then-delete. The skill editor keeps its in-place Save.
- The **Versions history** list and the **Dependencies** section shown in the mockups.
- Disabling folders the user cannot write to, or the "You have no access" tooltip.
- Author and credential opt-in in this panel. Publishing from here sends the default author and no credentials. Access rules are edited under the folder tree for an Organization folder.
- Changing any create flow, and changing models (not edited in chat).
- Real backend folder creation. A new folder exists only in the client until a save, move or publish writes to it, as in the Publish flow.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. One lib panel plus a per-resource app adapter (chosen)** | One UI and one orchestration. Each resource type supplies save, move, fork and publish callbacks, so the lib stays host-agnostic and new types plug in. |
| B. A separate panel per editor | Five copies of the same UI and sequencing, which drift on the next change. Rejected. |
| C. Reuse `StandalonePublishPanel` as is, with a Personal root added | Its body carries author, rules and credentials and has no version radio. Bending it would regress the Catalog and Conversation Publish flows. Rejected in favour of a sibling component sharing `PublishFoldersTree` and `ResourceSummary`. |
| D. One generic `/api/v1/resources/move` endpoint | It would duplicate the existing `POST /api/v1/prompts/move` and bypass per-domain cache invalidation. Rejected for per-domain endpoints sharing one BFF transfer helper. |
| E. Point the Quick App embedded editor at the new deployment for "new version" | The iframe is bound to `appId` through its URL (`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx:225`), so reloading it loses unsaved setup edits. Rejected. See design D3. |

## Capabilities

### New Capabilities

- `resource-save-panel`: the Save {Resource} panel and Change folder flow across the in-scope editors. It covers the destination tree (Personal + Organization), the version choice for versioned types, the per-resource adapter contract, and the save / move / fork / publish sequencing.

### Modified Capabilities

- `quick-app-authoring`: in edit mode, Save opens the panel instead of saving immediately, and the Version field is read-only.
- `toolset-authoring`: "Save and exit" in edit mode goes through the panel, and Version is read-only in edit mode.
- `prompt-editor`: "The editor screen does not move or manage prompt folders" is superseded. The editor now moves a prompt through the panel's destination.
- `builder-form`: `MetadataForm` adds `isVersionReadOnly`.
- `publish-panel-library`: new exported `SaveToFolderPanel` / `StandaloneSaveToFolderPanel`, and `PublishFoldersTree` supports more than one root.
- `applications-write-api`: Personal folder listing, move, `folderPath` on create, and fork/commit version endpoints.
- `toolset-write-api`: Personal folder listing, move, and `folderPath` on create.

## Impact

- **Backend**
  - `apps/chat-api/src/applications/` and `apps/chat-api/src/toolsets/`: new handlers and DTOs.
  - A shared transfer helper in `apps/chat-api/src/common/` wrapping SDK `moveResource` / `copyResource` and resource-folder listing.
  - Specs, and an OpenAPI regeneration of `libs/chat-api-client`.
- **Libs**
  - `libs/publish-panel`: new presentational components and a multi-root tree, with no host knowledge. Folder data, labels and callbacks come in as props.
  - `libs/chat-hooks`: a generic `useResourceFolders`, built like `usePublishFolders`, which takes the listing operation as a parameter. Also a pure `parseResourceFolderPath`.
  - `libs/builder-form`: `isVersionReadOnly`.
  - REST paths, storage keys, i18n and navigation stay in `apps/chat`.
- **App (`apps/chat`)**:
  - a `ResourceSavePanelContainer` and the `useResourceSavePanel` hook;
  - per-resource adapters (application kinds, toolset, prompt);
  - wiring in `ApplicationFormEditor`, `ToolsetApplicationEditor` and `PromptEditor`;
  - new `server-api` wrappers.

  The Organization branch reuses the publish call from `useCatalogPublishing`.
- **i18n**: new strings in a new `ResourceSavePanelI18nKeys` group: title per resource, "Save to folder", "Change", "Change folder", "Version", "Keep version", "Save as new version", the version placeholder, the "Personal" root, validation errors, success / publish-requested / partial-failure notifications. Generic Save, Cancel and Select come from `ButtonsI18nKeys`.
- **RTL / a11y**: the panel uses logical properties. The back arrow and breadcrumb chevrons are mirrored. The kit `RadioGroup` carries a legend. Status goes through `LiveRegion`. The panel is a modal `SideDrawer` with focus return.
- **Docs**: READMEs for `libs/publish-panel`, `libs/builder-form` and `libs/chat-hooks`, `docs/architecture.md` (new endpoints), and `docs/host-install-matrix.md` if peer dependencies change.

## Acceptance criteria

1. In every in-scope editor, Save in edit mode opens the panel and persists nothing until the panel's Save. Cancel or Escape closes it with nothing persisted. The skill editor is unchanged.
2. Version is read-only in edit mode for applications and toolsets and editable on create. Prompts show no Version section.
3. Change shows a searchable tree with Personal (that resource type's folders) and Organization roots. Every folder is selectable, and inline creation works under both roots.
4. Keep version to the same Personal folder behaves exactly like today's Save. A different Personal folder also moves the resource, and the Catalog shows it under the new id.
5. Save as new version leaves the old version's stored content unchanged and creates `{folder}/{name}__{newVersion}` holding the edits. An existing version is rejected inline (409). An invalid or unchanged version blocks Save.
6. An Organization destination saves first, then creates a publication request for that folder. A publish failure after a successful save says that the save succeeded and the publish failed.
7. No Versions history, Dependencies or access-disabled folder rows are rendered.
8. `npm run verify:changed`, `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass.

## Rollback / backward compatibility

The change is not breaking. The new endpoints and the optional `folderPath` fields are additive, and existing flat resources keep working: folder `[]` means the Personal root. To roll back, revert the app wiring, and each editor's Save goes back to in-place saves. Resources already moved or forked into subfolders remain valid DIAL Core resources, resolvable by id. The BFF `PATCH` / `DELETE` handlers already accept nested ids (`parseDialApplicationResource`, `apps/chat-api/src/common/utils/dial-application-resource.ts:15`).

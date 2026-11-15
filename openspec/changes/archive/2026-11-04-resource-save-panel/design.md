## Context

The proposal covers the motivation. Current save paths, all of which navigate to `ROUTES.Catalog` on success:

| Editor | Save today | Writer | Versioned | Personal folders today |
| --- | --- | --- | --- | --- |
| Quick App (`/apps-editor`, embedded editor) | `ApplicationFormEditor.persist` → `setupRef.save` → `TriggerSave` | the embedded iframe, bound to one id through its URL (`AppsEditorIframeQuery.Id`) | yes (`name__version`) | none: flat at the bucket root |
| Schema-form app (`/apps-editor`, schema form) | `schemaAppDefinition.update` → `PATCH /api/v1/applications/:id` | host | yes | none |
| Custom app (`/custom-app-editor`) | `customAppDefinition.update` → `PATCH` | host | yes | none |
| Toolset (`/toolset-editor`) | `ToolsetApplicationEditor` → `updateToolset` → `PATCH /api/v1/toolsets/:id` | host | yes (`name__version`) | none |
| Prompt (`/prompt-editor`) | `updatePrompt` → `PUT /api/v1/prompts` | host | no | yes: folders listed by `GET /api/v1/prompts`, moved by `POST /api/v1/prompts/move` |

Two more facts the design builds on:

- **Publish**: `PublishFoldersTree` (`libs/publish-panel`) renders one root. `usePublishFolders` (`libs/chat-hooks`) lists the public bucket. `publishCatalogEntity` takes `{ folderPath, version?, author?, rules?, publishCredentials? }`, and `toPublishEntityType` maps Application, Toolset and Prompt.
- **Feature gating**: the editors are already gated (`RequireCatalogCreation`, prompt-editor feature gate). No new `ENABLED_FEATURES` key. The Organization root renders only when the host would show Publish for the item (`isPublishVisible` logic: own item and a publishable type).

## Goals / Non-Goals

**Goals**:

- One Save panel, with a Change folder sub-view, for edit-mode Save in five editors.
- Personal subfolders for applications and toolsets, matching what prompts already have.
- Save as a new version (applications, toolsets) without changing the old version's stored content.
- Organization destination = save + publication request.
- Version is read-only in edit mode.

**Non-Goals**: Versions history, Dependencies, access-disabled rows, author / credentials in this panel (see the proposal).

## Decisions

### D1. Components live in `libs/publish-panel`, as siblings of the Publish components

New exports:

- `SaveToFolderPanel` (body: a main view and a Change folder view);
- `StandaloneSaveToFolderPanel` (`SideDrawer` shell + footer), modelled on `StandalonePublishPanel`;
- models `SaveToFolderPanelProps`, `SaveToFolderPanelLabels`, `FolderDestination { rootKey: string; path: string[] }` and `FolderDestinationRoot`;
- the string enum `SaveVersionMode { Keep = 'keep', New = 'new' }`.

The version section renders only when the host passes `version` props (`versionMode`, `onVersionModeChange`, `newVersion`, `onNewVersionChange`, `newVersionError`). Prompts omit them. The components reuse `ResourceSummary` (from `@epam/ai-dial-chat-shared`), `PublishFoldersTree` and the kit `Search`, `RadioGroup` / `Radio`, `Input` and `SideDrawer`.

**Isolation**: the lib receives folder nodes, the committed destination, labels and callbacks. It never knows resource ids, REST paths, i18n or navigation. The main ↔ Change view switch and the *pending* destination inside the Change view are internal UI state, committed to the host only on Select.

### D2. Multi-root folder tree

`PublishFoldersTree` gains optional `roots?: FolderDestinationRoot[]`, where each root is `{ key, label, items, canCreateFolders? }`, plus `destination` / `onDestinationChange`. Search, ordering, inline creation and validation run per root, and keyboard navigation spans the roots. Without `roots`, the existing single-root props behave exactly as today, so Catalog and Conversation Publish are untouched.

- Stacking two trees was rejected: two searches, two empty states, and keyboard navigation broken between them.
- A synthetic hidden root was rejected: path keys would be ambiguous between roots.

The app's root keys are `SaveDestinationRoot { Personal = 'personal', Organization = 'organization' }` in `libs/chat-hooks/src/catalog/resource-save.ts`.

### D3. Per-resource adapter in the app

All resource-specific behaviour sits behind `ResourceSaveAdapter` (interface in `libs/chat-hooks/src/catalog/resource-save.ts`):

```ts
interface ResourceSaveAdapter {
  publishEntityType: CatalogPublishEntityType;
  isVersioned: boolean;
  /** In-place save, the editor's current behaviour. */
  saveInPlace(): Promise<{ id: string }>;
  /** Writes the edits as `{folder}/{name}__{version}`; old stays as last saved. */
  saveAsNewVersion?(version: string, folderPath: string[]): Promise<{ id: string }>;
  move(id: string, folderPath: string[]): Promise<{ id: string }>;
}
```

Adapters:

All in `libs/chat-hooks/src/catalog/resource-save-adapters.ts`, each taking the configured generated client (`ApplicationsApi`, `ToolsetsApi`, `PromptsApi`) from the host:

- `createEmbeddedApplicationSaveAdapter` (Quick Apps) and `createHostApplicationSaveAdapter` (schema-form and custom apps, which pass their definition's `update` / `create` as callbacks).
- `createToolsetSaveAdapter`.
- `createPromptSaveAdapter`, with `createPromptFolderLister` for the Personal tree.

New-version strategies differ by writer:

- **Host-written** (schema-form, custom, toolset): `saveAsNewVersion` = a create-only write of the *edited* values with `{ version, folderPath, createOnly: true }`. The old resource is never touched. 409 → inline "version already exists".
- **Quick App** (embedded writer): see D4.

`useResourceSavePanel` (`libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`, with JSDoc) owns `isOpen`, `destination`, `versionMode`, `newVersion`, `versionError` and `isSubmitting`. It calls the pure orchestrator `runResourceSave(adapter, choice, publish)` in `libs/chat-hooks/src/catalog/resource-save.ts`, which takes the adapter and the publish function, so it is unit-testable without React.

The thin app component `ResourceSavePanelContainer` (`apps/chat/src/components/ResourceSavePanelContainer/`) builds the labels with `t()` (inside `useMemo`) and the two roots, and renders the lib panel. Each editor's existing Save handler opens the panel (after the same validation) instead of saving, in edit mode only.

### D4. Quick App "Save as new version": fork, save, commit

The embedded editor can only write to the old id. Sequence:

1. **Fork.** `POST /api/v1/applications/:applicationName/versions` with `{ version, folderPath }`. The BFF `copyResource`s the *stored* (pre-edit) deployment to `applications/{bucket}/{folderPath…}/{name}__{version}` with `overwrite: false`, sets `displayVersion`, and returns `{ id }` of the snapshot. If the target exists → 409.
2. **Save.** `TriggerSave` to the old id, as today. The old path now holds the edits.
3. **Commit.** `POST /api/v1/applications/:applicationName/versions/commit` with `{ snapshotId }`. The BFF swaps the two bodies, keeping each path's `displayVersion`, using `If-Match` on the ETags read in the same request. It returns `{ id: snapshotId }`.

Failure handling:

- Fork fails → nothing changed.
- Save fails or times out → the client deletes the snapshot (the existing `DELETE`).
- Commit fails → see R1.

Alternatives:

- Save first, then copy. Rejected: the edits leak into the old version.
- Reload the iframe on the new id. Rejected: unsaved edits are lost.
- Extend `TriggerSave` with a target id. Rejected: every external schema editor would have to change.

### D5. Move

After a successful keep-version save, when the chosen Personal folder differs from the resource's current folder (`currentFolderPath`, which the editor passes into the choice — `parseResourceFolderPath(id)`, or the prompt's `folderId`), call `adapter.move`:

- **Applications**: `POST /api/v1/applications/:applicationName/move` with `{ folderPath }`.
- **Toolsets**: `POST /api/v1/toolsets/:toolsetName/move` with `{ folderPath }`.
- **Prompts**: the existing `POST /api/v1/prompts/move`.

A new-version write already targets the chosen folder, so no move follows it. A 409 or other failure after a successful save → "Saved, but could not move to {folder}". The editor still exits, because the save happened.

### D6. Organization destination = save in place + publish

The Personal location stays the resource's current folder. The orchestrator runs the keep or new-version path, then calls `publishCatalogEntity(adapter.publishEntityType, savedId, { folderPath: path.join('/'), version, rules })`, with no author. The rules are edited under the tree in the Change folder view while an Organization folder is selected: the shell reports the pending destination through `onPendingDestinationChange`, and `useResourceSavePanel` fetches that folder's existing rules with `getPublishRules`, keeping the user's edits while the same folder stays chosen. On success it calls `rememberPublishFolder` and shows a "publish request sent" notification. If publish fails after a successful save, the partial-failure notification names both outcomes, and the editor still exits. This reuses `useCatalogPublishing`'s publish call through a narrow app hook.

### D7. Folder data

- **Personal**: a generic `useResourceFolders({ listFolders, rememberedFolderKeys? })` in `libs/chat-hooks`, built from the same tree-merge helpers as `usePublishFolders`. It takes the already-bound listing operation, lazy-loads per level, and keeps locally created folders. Each editor passes its listing to `ResourceSavePanelContainer` as `listPersonalFolders`:
  - applications: `listApplicationFolders`;
  - toolsets: `listToolsetFolders`;
  - prompts: the folder nodes of `GET /api/v1/prompts?path=`.
- **Organization**: the existing `apps/chat/src/hooks/publish/usePublishFolders.ts`.
- The current folder comes from `parseResourceFolderPath(id)` in `libs/chat-hooks`, a pure function: `{type}/{bucket}/{a}/{b}/{leaf}` → `['a','b']`.

### D8. Version field read-only

- `MetadataForm` gets `isVersionReadOnly?` and `versionReadOnlyTooltip?`, mirroring `isNameReadOnly`. The application definitions set it in edit mode through a new optional `getMetadataFieldState?(ctx, isEditMode)`.
- The toolset editor's Version field gets the same treatment through its metadata form.
- On keep-version the stored version is unchanged. On new-version the BFF write sets it.

### D9. New and changed endpoints

All are under the existing versioned controllers.

| Method / path | operationId | Body → Response | Errors |
| --- | --- | --- | --- |
| `GET /api/v1/applications/folders?path=a/b` | `listApplicationFolders` | → `ResourceFoldersResponseDto { folders: { name, path }[] }` | 400, 401, 502 |
| `POST /api/v1/applications/:applicationName/move` | `moveApplication` | `MoveResourceDto { folderPath }` → `ResourceIdResponseDto { id }` | 400, 401, 403, 404, 409, 502 |
| `POST /api/v1/applications/:applicationName/versions` | `forkApplicationVersion` | `ForkApplicationVersionDto { version, folderPath }` → `ResourceIdResponseDto` | 400, 401, 403, 404, 409, 502 |
| `POST /api/v1/applications/:applicationName/versions/commit` | `commitApplicationVersion` | `CommitApplicationVersionDto { snapshotId }` → `ResourceIdResponseDto` | 400, 401, 403, 404, 409 (ETag changed), 502 |
| `POST /api/v1/applications` (changed) | `createApplication` | adds optional `folderPath` | 400 invalid path |
| `GET /api/v1/toolsets/folders?path=` | `listToolsetFolders` | → `ResourceFoldersResponseDto` | 400, 401, 502 |
| `POST /api/v1/toolsets/:toolsetName/move` | `moveToolset` | `MoveResourceDto` → `ResourceIdResponseDto` | 400, 401, 403, 404, 409, 502 |
| `POST /api/v1/toolsets` (changed) | `createToolset` | adds optional `folderPath`, `createOnly` | 400, 409 |

- **Implementation**: one shared helper, `apps/chat-api/src/common/utils/dial-resource-transfer.ts`, wraps SDK `moveResource` / `copyResource` and per-type folder listing. Listing uses the SDK application- or toolset-metadata call, the counterpart of `getPromptMetadata`.
- **Validation**:
  - `folderPath` uses `@IsValidFilePath()` (empty = root);
  - `version` uses the existing allowlist `@Matches`;
  - `snapshotId` must be in the caller's own bucket.
  - Create joins `folderPath` per segment with `encodeDialResourcePath`, replacing today's whole-path `encodeURIComponent`.
- **Authorization**: an authenticated session (the existing `SessionGuard`). Every call runs with the user's bearer token, so DIAL Core enforces bucket ownership. Source and target must both be in the caller's own bucket, else 403.
- **Cache**: every write deletes `applications:list:{userSub}` or the toolsets list key (the same invalidation as create / update). Folder listings are not cached.
- **Logging**: `Logger` warnings on failure, never tokens or bodies.

## Risks / Trade-offs

- **[R1] Quick App commit is two writes, not atomic.** → `If-Match` guards both writes. The edits go into the new version first, then the old path is restored. If restoring fails, the new version is rolled back to its pre-edit body, so the edits stay in the current version, as `CommitFailed` says. If the rollback fails too, the edits exist in both versions — duplicated, never lost. A retry re-reads the ETags.
- **[R2] Code assuming flat ids.** Callers may assume `{type}/{bucket}/{name}` with exactly three segments (`normalizeDeploymentId`, catalog id parsers, toolset lookups). → Task 1.1 audits them before any move ships.
- **[R3] Locally created folders vanish if the user cancels.** This is intended and matches Publish.
- **[R4] Publishing without author or credentials** differs from the Catalog panel. → Documented as a non-goal; access rules are offered under the folder tree.
- **[R5] Prompt rename + move.** A prompt's id includes its name, so rename and move compose. → The orchestrator saves first (which may change the id), then moves the id returned by the save.

## Migration Plan

No data migration. Ship order:

1. BFF endpoints + OpenAPI.
2. Lib components and hooks.
3. Quick App wiring (the highest-risk path).
4. Schema-form and custom apps.
5. Toolsets.
6. Prompts.

Each slice ships independently. Rollback = revert that editor's wiring.

## Extension: create mode, skills, and the shared flow

Added after the first review round.

- **Create adapters.** `ResourceSaveAdapter` is an edit adapter (`saveInPlace`, `move`, `saveAsNewVersion`) or a create adapter (`createIn(folderPath)`, `isVersioned: false`); `isResourceCreateAdapter` tells them apart, and the result carries `isCreated`. `runResourceSave` creates straight in the chosen Personal folder, or at the Personal root before publishing. The adapter types and `ResourceSaveError` sit in the dependency-free `libs/chat-hooks/src/catalog/resource-save-adapter.ts`, so the `./skill-editor` entry point that imports them gains no `@epam/ai-dial-publish-panel` peer.
- **Shared flow.** `useResourceSavePanel` (in `libs/chat-hooks`) returns the panel's state props; the host passes its folder listing, Organization folder state, publish client, version pattern and translated copy, and notifies from `onSaved`. The adapters in `libs/chat-hooks/src/catalog/resource-save-adapters.ts` take configured generated clients; the editor-specific steps (embedded save, definition create/update, form bodies, translated commit copy) stay host callbacks.
- **Skills.** `useSkillEditorSubmit` takes `onSaveRequest(adapter, values)` and `client.moveSkill`. Validation stays inline; write failures become `ResourceSaveError` messages matching the inline flow's copy, and a stale edit still raises the page's conflict state. The skill move is `POST /api/v1/skills/move`, which calls DIAL Core's generic `moveResource` on `skills/{bucket}/{path}` without overwriting. That DIAL Core moves a v2 skill folder through this operation is not yet verified against a live DIAL Core; a failure leaves the skill saved and shows the "saved but not moved" notification.
- **Toolset drafts.** The toolset editor's pre-login draft save also goes through the panel in create mode; a toolset created this way is then edited as the user's own.

## Open Questions

- Is SDK metadata listing for applications and toolsets available under per-type methods (D9)? Task 1.2 verifies this. If not, the fallback is the generic metadata call used by `files-listing.service.ts`, documented as an SDK gap.
- Should the Organization root be hidden for users without publish rights? This design hides it using the `isPublishVisible` gate. Confirm with design during review.

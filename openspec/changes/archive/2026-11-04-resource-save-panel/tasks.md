## Slicing strategy

The strategy is contract-first for the BFF and lib surface, then vertical per editor, riskiest first:

1. BFF endpoints and OpenAPI, so both sides build against generated types.
2. Lib panel, tree and hooks.
3. Quick App end to end (fork/commit, the highest risk).
4. Schema-form and custom apps.
5. Toolsets.
6. Prompts.

Slices 4–6 each depend only on slices 1–3. Run `npm run verify:changed` once per completed slice, and `npm run verify:full` once at the end. Read `apps/chat-api/AGENTS.md` before group 1 and `.claude/rules/libs.md` before group 2.

## 1. BFF: folders, move, create-only folder writes, fork/commit

- [x] 1.1 Audit flat-id assumptions (R2). Check `normalizeDeploymentId`, catalog id parsers in `libs/chat-hooks/src/catalog/`, toolset lookups in `apps/chat-api/src/toolsets/`, and `encodeURIComponent(appPath)` in `apps/chat-api/src/applications/applications.service.ts`, with a 4+-segment id like `applications/b/Design/agent__1.0.0`. Record each finding as a follow-up task in this file and fix only those this change needs (the create path encoding).
  - Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts`
- [x] 1.2 Confirm the SDK metadata-listing and `copyResource` / `moveResource` signatures for applications and toolsets. If a per-type listing is missing, document the SDK gap in design.md D9 and use the generic metadata call.
- [x] 1.3 Add the shared helper `apps/chat-api/src/common/utils/dial-resource-transfer.ts`: `listResourceFolders`, `moveResource`, `copyResource` (`overwrite: false`), folder-path join with `encodeDialResourcePath`, and own-bucket guard → `ForbiddenException`. Add `ResourceFoldersResponseDto`, `MoveResourceDto` and `ResourceIdResponseDto` under `apps/chat-api/src/common/dto/`, with `@ApiProperty` and `@IsValidFilePath()`.
  - Verification: `npm run test:file -- apps/chat-api/src/common/utils/tests/dial-resource-transfer.spec.ts`
- [x] 1.4 Applications: add optional `folderPath` to `CreateApplicationBodyDto` and apply it in `ApplicationsService.create`, with `createOnly` candidates kept in the folder.
  - Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts`
- [x] 1.5 Applications: add `listApplicationFolders` (`GET folders`, registered before `:applicationName` routes) and `moveApplication` (`POST :applicationName/move`) in `applications.controller.ts` / `applications.service.ts`. Include `@ApiOperation` and `@ApiResponse` for every status, and invalidate `applications:list:{userSub}`.
  - Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.controller.spec.ts`
- [x] 1.6 Applications: add `forkApplicationVersion` and `commitApplicationVersion`, with `ForkApplicationVersionDto` / `CommitApplicationVersionDto` in `apps/chat-api/src/applications/dto/`. Commit writes with `If-Match` and restores the source first.
  - Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts`
- [x] 1.7 Toolsets: add `folderPath` and `createOnly` to the create body (`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`, `toolsets-mutation.service.ts`), plus `listToolsetFolders` (registered before `:toolsetName`) and `moveToolset` in `toolsets.controller.ts`. The move neither reads nor logs secrets.
  - Verification: `npm run test:file -- apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts`
- [x] 1.8 Unit tests for the helper and every new service method: happy path, each thrown exception, and validation rejection including `../` traversal and a foreign-bucket `snapshotId`.
- [x] 1.9 Supertest integration tests for every new and changed route in `apps/chat-api/src/applications/tests/` and `apps/chat-api/src/toolsets/tests/`.
- [x] 1.10 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Confirm that the operationIds match design.md D9.
- [x] 1.11 Add app wrappers to `apps/chat/src/server-api/applications.ts` (`listApplicationFolders`, `moveApplication`, `forkApplicationVersion`, `commitApplicationVersion`) and a toolsets wrapper (`listToolsetFolders`, `moveToolset`), using the generated client. Update the `api-client.ts` singletons if a new API class appears.
- [x] 1.12 Run `npm run verify:changed`.

  - Findings (1.1): `getModelIdFromConversationId`, `toolset-id.ts`, `normalizeDeploymentId` and publish `getResourceName` already handle nested ids (published apps are nested). Only the create paths assume a flat leaf: `encodeURIComponent(appPath)` in `ApplicationsService.createApplication` and `${name}__${version}` in `toolsets-mutation.service.ts` — fixed by 1.4 and 1.7. No follow-ups.
  - Findings (1.2): SDK exposes `getApplicationMetadata(bucket, path)` / `getToolSetMetadata(bucket, path)` (folder path must end with `/`, paginated via `token`/`nextToken`), `copyResource`/`moveResource({ body: { sourceUrl, destinationUrl, overwrite } })`, `getCustomApplication` (returns `ETag`). No SDK gap.

## 2. Libs: multi-root tree, save panel, folder hooks, read-only version

- [x] 2.1 Add `isVersionReadOnly` and `versionReadOnlyTooltip` to `MetadataFormProps` (`libs/builder-form/src/models/metadata-form-props.ts`) and `MetadataForm`, mirroring `isNameReadOnly`. Tests go in the existing MetadataForm `tests/` folder.
  - Verification: `npm run test:file -- libs/builder-form/src/components/MetadataForm/tests/MetadataForm.spec.tsx`
- [x] 2.2 Add `FolderDestination`, `FolderDestinationRoot` and `SaveVersionMode` to `libs/publish-panel/src/models/` and `libs/publish-panel/src/types/`. Extend `PublishFoldersTree` with `roots` / `destination` / `onDestinationChange`, covering per-root search, creation and keyboard navigation across roots. Single-root behaviour stays unchanged.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/PublishFoldersTree/tests/PublishFoldersTree.spec.tsx`
- [x] 2.3 Build `SaveToFolderPanel`:
  - main view: summary, breadcrumb with Change, optional kit `RadioGroup` version section with `Input`, and an assertive `LiveRegion` for submit errors;
  - Change view: back button, `Search`, multi-root tree, Cancel/Select, and a pending destination committed only on Select;
  - focus moves to each view's heading;
  - labels, colors and `*ClassName` props with defaults, and a `.module.scss` using `var(--publish-panel-*, fallback)`.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/SaveToFolderPanel/tests/SaveToFolderPanel.spec.tsx`
- [x] 2.4 Build `StandaloneSaveToFolderPanel`: a `SideDrawer` shell, `h1` title, pinned footer with a loading Save, full width on phone, and `returnFocusRef`.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/SaveToFolderPanel/tests/StandaloneSaveToFolderPanel.spec.tsx`
- [x] 2.5 Add `useResourceFolders` (`libs/chat-hooks/src/catalog/useResourceFolders/useResourceFolders.ts`) and `parseResourceFolderPath` (`libs/chat-hooks/src/catalog/resource-folder.ts`), reusing the `usePublishFolders` tree-merge helpers. The listing callback is injected. Export both from `libs/chat-hooks/src/index.ts`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/useResourceFolders/tests/useResourceFolders.spec.ts` and `npm run test:file -- libs/chat-hooks/src/catalog/tests/resource-folder.spec.ts`
- [x] 2.6 Architecture guard. Confirm that `libs/publish-panel`, `libs/builder-form` and the new `libs/chat-hooks` code contain:
  - no `/api` paths, no `server-api` or app imports, no i18n, routing, storage, env or analytics;
  - no generated-client import outside `chat-hooks`' allowed types;
  - no `.tsx` in `chat-hooks`.
  
  Run `npm exec nx lint publish-panel builder-form chat-hooks`.
- [x] 2.7 Update the READMEs: `libs/publish-panel/README.md` (new components, props, enums, `dial-*` class table), `libs/builder-form/README.md` (`isVersionReadOnly`) and `libs/chat-hooks/README.md` (`useResourceFolders`, `parseResourceFolderPath`). Run `npm run validate:docs`.
- [x] 2.8 Run `npm run verify:changed`.

## 3. App: shared save flow and the Quick App slice

- [x] 3.1 Add `SaveDestinationRoot` (`apps/chat/src/types/resource-save.ts`), `ResourceSaveAdapter` and the choice types (`apps/chat/src/models/resource-save.ts`).
- [x] 3.2 Implement the pure orchestrator `runResourceSave` in `apps/chat/src/utils/resource-save.ts`, covering the destination × version table from the spec, publish with no rules or author, `rememberPublishFolder`, and the partial-failure results.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/resource-save.spec.ts`
- [x] 3.3 Implement `useResourceSavePanel` (`apps/chat/src/hooks/resource-save/useResourceSavePanel.ts`, with JSDoc) for panel state, version validation (`SEMVER_VERSION_PATTERN`, unchanged, 409 → `VersionExists`) and the submit lifecycle. Wire in notifications through `useOperationNotification` and the `show*Notification` helpers.
  - Verification: `npm run test:file -- apps/chat/src/hooks/resource-save/tests/useResourceSavePanel.spec.ts`
- [x] 3.4 Add the `usePersonalResourceFolders` app wrapper (`apps/chat/src/hooks/publish/usePersonalResourceFolders.ts`) that binds the adapter's listing to `useResourceFolders`.
  - Resolved without a wrapper: the Personal listing has no storage or other app-level concern to inject (the `usePublishFolders` wrapper exists only for `localStorage`), so `ResourceSavePanelContainer` calls `useResourceFolders` from `@epam/ai-dial-chat-hooks` directly with the editor's listing operation.
- [x] 3.5 Add `ResourceSavePanelContainer` (`apps/chat/src/components/ResourceSavePanelContainer/ResourceSavePanelContainer.tsx`). It builds the `t()` labels in `useMemo` and the Personal and Organization roots (Organization gated by the publish visibility rule), lazy-loads the lib panel, and keeps callbacks in `useCallback`.
  - Verification: `npm run test:file -- apps/chat/src/components/ResourceSavePanelContainer/tests/ResourceSavePanelContainer.spec.tsx`
- [x] 3.6 Add the application adapter `apps/chat/src/utils/resource-save-adapters/application.ts`. Its Quick App `saveAsNewVersion` runs fork → `setupRef.save` → commit, deletes the snapshot on save failure, and throws `CommitFailed` on commit failure.
  - Verification: `npm run test:file -- apps/chat/src/utils/resource-save-adapters/tests/application.spec.ts`
- [x] 3.7 Wire `ApplicationFormEditor`:
  - add the optional `savePanel` and `getMetadataFieldState` to `ApplicationEditorFormDefinition` (`apps/chat/src/models/application-editor.ts`);
  - in edit mode, `handleSubmit` opens the panel after validation;
  - set `isVersionReadOnly` in edit mode;
  - enable both in `quickAppDefinition`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
- [x] 3.8 Add the i18n keys: a `ResourceSavePanelI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts` and the matching `en.json` entries for every key the spec names. Reuse `ButtonsI18nKeys` (Save, Cancel, Select, Back, Saving) and check that no existing value duplicates a new one.
- [x] 3.9 RTL pass: logical classes only in the container and the lib. Mirror the back arrow and breadcrumb chevrons with `rtl:scale-x-[-1]`. Add an `ar` render test asserting the mirrored classes.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/SaveToFolderPanel/tests/SaveToFolderPanel.spec.tsx`
  - Result: no physical-direction utility or property in the new lib or app UI (scanned). Its only own icon is the symmetric folder glyph; the back arrow comes from the kit `SideDrawer` `onBack` and the path separators from the kit `FolderPath`, which own their mirroring. No mirrored class exists to assert, so no `ar` render test was added.
- [x] 3.10 Run `npm run verify:changed`.
  - Result (run once for slices 1–3): typecheck:affected passed; lint:affected failed only on `scheduled-tasks-consumer-fixture`, whose errors come from a stray local `tools/scheduled-tasks-consumer-fixture/.npm-cache/` unrelated to this change; test:changed passed 85/86 targets, the one failure a 5s timeout in `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx` that passes (154/154) when run alone. Lint needs `NODE_OPTIONS=--max-old-space-size=8192` on this machine.

## 4. Schema-form and custom apps

- [x] 4.1 Add the host-written `saveAsNewVersion` to the application adapter: the definition's create with the edited values plus `{ version, folderPath, createOnly: true }`.
  - Verification: `npm run test:file -- apps/chat/src/utils/resource-save-adapters/tests/application.spec.ts`
- [x] 4.2 Enable `savePanel` and `getMetadataFieldState` in `schemaAppDefinition` and `customAppDefinition`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/customAppDefinition.spec.tsx`
- [x] 4.3 Run `npm run verify:changed`.
  - Covered by the single 7.3 run below.

## 5. Toolsets

- [x] 5.1 Add the toolset adapter `apps/chat/src/utils/resource-save-adapters/toolset.ts` (`saveInPlace` = `updateToolset`, `saveAsNewVersion` = create-only into the folder, `move` = `moveToolset`).
  - Verification: `npm run test:file -- apps/chat/src/utils/resource-save-adapters/tests/toolset.spec.ts`
- [x] 5.2 Wire `ToolsetApplicationEditor`: in edit mode, Save opens `ResourceSavePanelContainer`, and Version is read-only.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`
- [x] 5.3 Run `npm run verify:changed`.
  - Covered by the single 7.3 run below.

## 6. Prompts

- [x] 6.1 Add the prompt adapter `apps/chat/src/utils/resource-save-adapters/prompt.ts`: `isVersioned: false`, `saveInPlace` = `updatePrompt`, `move` = `movePrompt` on the id the update returned, and `listPersonalFolders` from the prompts listing.
  - Verification: `npm run test:file -- apps/chat/src/utils/resource-save-adapters/tests/prompt.spec.ts`
- [x] 6.2 Wire `PromptEditor`: in edit mode, Save opens the panel with no Version section. The page body keeps no folder control.
  - Verification: `npm run test:file -- apps/chat/src/pages/PromptEditor/tests/PromptEditor.spec.tsx`
- [x] 6.3 Run `npm run verify:changed`.
  - Covered by the single 7.3 run below.

## 7. Docs and close-out

- [x] 7.1 Update `docs/architecture.md` with the new application and toolset endpoints and the save-panel flow summary. Run `npm run docs:install-matrix` if any lib manifest changed, then `npm run validate:docs`.
- [x] 7.2 Run `npm run validate:specs` and fix any missing path cited in this change's specs.
- [x] 7.3 Run `npm run verify:full` once, then `npm run build:quiet` (lazy-loaded panel bundling).
  - Result: `typecheck:full` passed; `lint:check` failed only on `scheduled-tasks-consumer-fixture` (the stray local `tools/scheduled-tasks-consumer-fixture/.npm-cache/`, unrelated to this change); `test:full` passed (939s); `build:quiet` passed (`build:affected`, 116s). Run with `NODE_OPTIONS=--max-old-space-size=8192` and `NX_SKIP_NX_CACHE=true` because of local memory limits and an Nx cache file lock.

## 8. Extension: create mode, skills, shared flow

- [x] 8.1 Move the Save flow into `libs/chat-hooks`: `runResourceSave`, models, enums, `useResourceSavePanel` and the resource save adapters (taking configured generated clients); the app keeps a thin `ResourceSavePanelContainer` and `useResourceSaveNotification`.
  - Verification: `npm exec nx test @epam/ai-dial-chat-hooks -- --run resource-save useResourceSavePanel`
- [x] 8.2 Add create adapters (`createIn`, `isResourceCreateAdapter`, `isCreated`) and route Create through the panel in the application, toolset and prompt editors; a new Quick App offers Personal only.
  - Verification: `npm exec nx test chat -- --run pages/ApplicationEditor pages/PromptEditor`
- [x] 8.3 Add `POST /api/v1/skills/move` with DTO, service, controller and tests; regenerate the client.
  - Verification: `npm exec nx test chat-api -- --run skills`; `npm run openapi:check`
- [x] 8.4 Route the skill editor through the panel: `onSaveRequest` and `moveSkill` in `useSkillEditorSubmit`, `createSkillFolderLister`, page wiring.
  - Verification: `npm exec nx test chat -- --run pages/SkillEditor`; `npm exec nx test @epam/ai-dial-chat-hooks -- --run useSkillEditorSubmit`
- [x] 8.5 Show the destination with the kit `FolderName` in a secondary color and make Change a small ghost button.
  - Verification: `npm exec nx test @epam/ai-dial-publish-panel -- --run SaveToFolderPanel`


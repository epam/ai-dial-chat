## Why

The Projects page (#9596) lists projects and #9605 creates them, but a project cannot be opened: a card is not interactive, and a successful create lands back on the list. Users cannot inspect a project's instructions and context, keep it current, or share, publish, download or delete it. This change adds the project's home page and its actions. Issue #9621.

## Problem

- The BFF has only `GET /api/v1/projects` and `POST /api/v1/projects` (`apps/chat-api/src/projects/projects.controller.ts`). There is no read of one project, and no update, file, download or delete endpoint.
- Project ids are not accepted by the shared flows:
  - Share's `RESOURCE_KIND_BY_PREFIX` and `IsCatalogResourcePath` (`apps/chat-api/src/share/utils/share-resource.util.ts`, `apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`) know no `projects/` prefix.
  - The publish BFF `CatalogEntityType` (`apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts`) has no `project` member.
  - User-config pins are conversation-only. `UserConfigService.updatePin` writes every id into `conversations.pinnedIds` (`apps/chat-api/src/user-config/user-config.service.ts`).
- DIAL Core already supports what the page needs. Verified in the local `ai-dial-core` checkout (`b9c6f0dd`):
  - **ETags:** per-file `PUT`/`DELETE` and whole-project `DELETE` honor `If-Match` against the project's aggregate ETag (`ComplexResourceService.copyOnWrite` / `delete`).
  - **Move:** `/v1/ops/resource/move` accepts `PROJECT` and, within one bucket, moves the shares and invitations with the resource. It does **not** check an ETag (`ResourceOperationService.moveResource`).
  - **Publication:** `PublicationService` accepts `PROJECT`.
  - **Share limit:** invitations for `PROJECT` are capped at 10 accepted users (`ShareService.DEFAULT_MAX_ACCEPTED_USERS`).
- Core does **not** expose what the issue assumes:
  - **No sizes or content types.** `ComplexResourceService.listFiles` returns each file's name, ETag, timestamps and author, and `itemMetadata` returns the project's ETag, timestamps and author. Per-file sizes live only in the internal marker. The BFF's capacity check and the edit form's capacity meter therefore cannot come from metadata.
  - **No `permissions`** on a project's item metadata. The read-only decision cannot come from Core permissions.
  - Both points still hold on `origin/development` of `ai-dial-core`.

## Solution

- **A project snapshot from the ZIP.** The BFF reads a project through Core's `downloadProjectFolder`. Its `ETag` header is the aggregate ETag of exactly the files read. From one buffered ZIP, `yauzl` (already a `chat-api` dependency, `apps/chat-api/src/skills/import/skills-archive-extraction.service.ts`) gives the central directory (each file's name and uncompressed size) and `PROJECT.md`. The other entries are inflated only when a save needs them.
- **BFF**, in `apps/chat-api/src/projects/`, under the existing class-level `FeatureGuard` + `@RequireFeature(FeatureKey.ProjectsEnabled)`. Five endpoints:
  - `GET /api/v1/projects/:id` (`getProject`): metadata plus the snapshot. It returns the name, description, instructions, context files (name and size), `etag`, `source` and `canEdit`.
  - `GET /api/v1/projects/:id/files/:fileName` (`downloadProjectFile`): streams `context/{fileName}`.
  - `GET /api/v1/projects/:id/archive` (`downloadProject`): streams Core's ZIP unchanged.
  - `PUT /api/v1/projects/:id` (`updateProject`): one atomic save. It takes the same multipart shape as create, plus `removedFileNames`, and a required `If-Match`. The BFF checks the request against the snapshot, rebuilds `PROJECT.md`, keeps the untouched context files from the snapshot, adds the new ones, and makes **one** `uploadProjectFolder` call with `If-Match`. When the name changes, a Core move to the new path follows, after a destination pre-check.
  - `DELETE /api/v1/projects/:id` (`deleteProject`): requires `If-Match`.

  Core's `412` becomes `409 project-changed`. `:id` is the URL-encoded DIAL id, as `:entityId` already is in `apps/chat-api/src/publish/publish.controller.ts`. The streaming endpoints follow `SkillsController.downloadSkill` (`apps/chat-api/src/skills/skills.controller.ts`, `pipeline(Readable.fromWeb(…), res)`).
- **Deviations from the issue's endpoint table** (user decision):
  - one `PUT /:id` replaces `PATCH /:id` and the per-file `PUT`/`DELETE /:id/files/:fileName`, so a save is all-or-nothing in one Core version;
  - context files carry no `contentType` or `updatedAt`, because Core does not expose them, and the UI infers the type from the extension;
  - `permissions` is replaced by `canEdit`.
- **Pins** get their own `projects.pinnedIds` section in the user config (config version 7). The existing `PATCH /api/v1/user-config/pins` routes an id by its `projects/` prefix. A rename moves the pin on the server, and a delete removes it.
- **Share and publish** reuse the existing flows:
  - **Share:** `['projects/', 'PROJECT']` is added to `RESOURCE_KIND_BY_PREFIX`, and `projects` to the resource-path regex. Project invitations get a `/projects/shared/:invitationId` landing route that reuses `SharedInvitation` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) with a project target, as `ConversationSharedInvitation` does.
  - **Publish:** `CatalogEntityType.Project = 'project'` is added to the BFF enum, and a `PublishProjectPanelContainer` follows `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`.
- **View page:**
  - `ROUTES.ProjectView = '/projects/view/:bucket/*'`, rendering a lazy `ProjectViewPage`. It owns the data (`useProject`), the actions and the strings.
  - A presentational `ProjectView` in `libs/projects` renders the header, the actions menu and the Details panel, reusing `AttachmentCard`, the kit `Search`/`Highlight`, and `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, as the catalog About tab does (`libs/catalog/src/components/Details/TabsContent/About.tsx`).
- **Edit page:**
  - `ROUTES.ProjectEdit = '/projects/edit/:bucket/*'`, rendering a lazy `ProjectEditPage`. It reuses `ProjectCreateForm` in an edit mode and `useBuilderLeaveGuard`, following the `ScheduledTaskEditPage` split.
  - Save sends the whole edit in one `PUT /api/v1/projects/:id` with the loaded ETag: the text fields, the new files only, and the removed file names.
- **Read-only rule:** a project is editable only when it lives in the caller's own bucket (`source: personal`). Shared and organization projects keep Pin and Download, and hide Edit, Delete, Share and Publish.

## What Changes

- **BFF `projects`:**
  - five new endpoints and their DTOs: `ProjectDetailsDto`, `ProjectContextFileDto`, `UpdateProjectDto`, `UpdateProjectResponseDto`, `ProjectIdParamDto` and `ProjectFileParamDto`;
  - a `ProjectsSnapshotService` that reads and rebuilds the ZIP;
  - a `PROJECT.md` parser next to `buildProjectManifest`;
  - `ProjectCreateErrorCode` gains `project-changed`, `if-match-required`, `project-too-large` and `unknown-file`;
  - `ProjectsModule` imports `UserConfigModule`.
- **BFF `user-config`:**
  - a `ProjectsConfig { pinnedIds }` section, with `CURRENT_CONFIG_VERSION` bumped from 6 to 7 and the migration extended;
  - `updatePin` routes `projects/` ids to the new section;
  - new `replaceProjectPin` / `removeProjectPin` helpers.
- **BFF `share`:** the `projects/` prefix in `RESOURCE_KIND_BY_PREFIX` and in `IsCatalogResourcePath`. `getInvitationRoutePath` maps `projects/` to `/projects/shared`.
- **BFF `publish`:** `CatalogEntityType.Project`. The target URL is already derived from the id prefix (`apps/chat-api/src/publish/publish-target.util.ts`).
- **Generated client:** `npm run openapi` regenerates `ProjectsApi` with the five new operations, `PublishCatalogEntityEntityTypeEnum.Project` and `UserConfigDto.projects`.
- **`libs/projects`:**
  - new `ProjectView` and its types;
  - `ProjectItem.isPinned`, with pinned projects sorted first;
  - `Projects` gains an `onOpenProject` prop, and its cards become links;
  - `ProjectCreateForm` serves the edit page unchanged in shape. The host already supplies the title, submit and status labels. The only change is that `contextFiles` widens to a `ProjectContextFile` union (`Attachment | StoredProjectContextFile`), so files already in the project render as cards. `Attachment` stays assignable to `contextFiles`. `onContextFilesChange` now receives the union, so `ProjectCreatePage` types its state as `ProjectContextFile[]` and narrows with `isStoredContextFile` when collecting the files to upload.
- **`libs/chat-hooks`:** `CatalogPublishEntityType` gains `'project'`.
- **App:**
  - the `ProjectView`, `ProjectEdit` and `ProjectSharedInvitation` routes and `getProjectViewRoute` / `getProjectEditRoute` helpers;
  - the `ProjectViewPage`, `ProjectEditPage` and `ProjectSharedInvitation` pages;
  - the `useProject`, `useProjectActions` and `useSaveProject` hooks;
  - new `projects.api.ts` wrappers;
  - `UserConfigContext` gains `pinnedProjectIds`, `setPinnedProject` and `replacePinnedProjectId`;
  - `SharePopoverContainer` takes `itemId` + `canEditAccess` instead of a `CatalogItem`, and `CatalogView` passes them;
  - `NotifiableEntity.Project`;
  - after create, the app navigates to the new project's view route.
- **i18n:** new user-visible strings under the `projects` namespace (`projects.view.*`, `projects.edit.*`, `projects.actions.*`). Generic labels (Share, Download, Delete, Edit, Publish, Cancel, Save, Retry) reuse `ButtonsI18nKeys`.
- **Docs:** `docs/architecture.md` (routes, endpoints, user-config section), `apps/chat-api/README.md`, `libs/projects/README.md`, and the specs below.

## Capabilities

### New Capabilities

- `project-detail-api`: the five per-project BFF endpoints, covering id/file-name validation, the ZIP snapshot, the `PROJECT.md` read and its fallbacks, the atomic save with `If-Match` and `412` → `409`, rename via move with the destination pre-check, ZIP and file streaming, and pin side effects.
- `project-view-ui`: the `/projects/view/:bucket/*` page and the `ProjectView` lib component, covering the header, actions, Details panel, context search, states, read-only mode, mobile, RTL and a11y.
- `project-edit-ui`: the `/projects/edit/:bucket/*` page, covering `ProjectCreateForm` reused for editing, the single atomic save, conflict and name-taken handling, rename navigation and the leave guard.

### Modified Capabilities

- `projects-page-ui`: cards open the view page, pinned projects sort first and show a pinned marker, and `ProjectItem` gains `isPinned`.
- `project-create-ui`: a successful create navigates to the view route instead of `/projects`, and `ProjectCreateForm` accepts the widened `ProjectContextFile` type.
- `navigation-routing`: adds the `ProjectView`, `ProjectEdit` and `ProjectSharedInvitation` routes and their helpers.
- `user-config-api`: adds the `projects.pinnedIds` section (v7), prefix routing in `PATCH /pins`, and `ProjectsModule` as an importer.
- `share-revoke-access`: adds a requirement that the shared resource-path validator and `RESOURCE_KIND_BY_PREFIX` accept `projects/`.
- `share-service-decomposition`: adds a requirement that `getInvitationRoutePath` maps `projects/` to `/projects/shared`.
- `catalog-publish-api`: adds a requirement that `entityType` accepts `project` for whole-project publication.

## Non-goals

These are the issue's own follow-ups:

- the chat input on the project page, the Chats list, and conversations in a project's context (Core has no conversation ↔ project link; epam/ai-dial-core#2131);
- Outputs;
- Duplicate, and moving a project between grouping folders;
- Unpublish, and surfacing published projects anywhere but the existing Organization source of the Projects page (user decision);
- editable shares: project share links are view-only, so a shared project is always read-only.

## Acceptance criteria

The issue's acceptance criteria, with these clarifications:

- `GET`/`PUT`/`DELETE` under `/api/v1/projects/:id…` are rejected with `403` by `FeatureGuard` when the flag is off, and the routes render `NotFound`.
- A card click and a successful create both open `/projects/view/{bucket}/{path}`.
- A project without `PROJECT.md` renders with its name taken from the last path segment and empty description and instructions.
- Pin survives a reload and a rename, and pinned projects sort first.
- Share, Publish, Edit and Delete appear only for personal projects. Download and Pin appear for every project.
- A stale ETag on any write yields `409 project-changed` and a reload prompt. A rename onto an existing name yields an inline `name-taken` error.
- BFF and frontend tests as listed in the issue. `npm run openapi:check`, `validate:docs` and `validate:specs` pass.

## Alternatives considered

- **URL:** a query parameter (`/projects/view?id=…`, like `SkillEditor`) was rejected for a readable, shareable splat path. The user chose the splat.
- **Edit location:** editing in place on the view page was rejected for a separate route that keeps loading, the guard and the actions apart. The user chose the route.
- **Edit save:** the issue's per-file `PUT`/`DELETE` plus `PATCH` makes each step atomic, but not the save as a whole: a failure midway leaves a partial edit. Each file `PUT` would also re-read the snapshot for the capacity check, and Core copies a whole version per step (`copyOnWrite`). It was rejected for one BFF-merged `PUT`, chosen by the user. The browser still uploads only new files, because the BFF takes the unchanged ones from the snapshot it reads anyway.
- **Sizes:** streaming a per-file `GET` only to read `Content-Length` costs up to 100 Core requests per page view, and gives no consistent ETag. A Core change exposing the marker's sizes is the real fix, and is listed as a follow-up.
- **Pin storage:** reusing `conversations.pinnedIds` needs no migration, but mixes resource kinds in a section that conversation listing reads as a set. It was rejected for a `projects` section.
- **`412` handling:** passing `412` through, as skills do (`apps/chat-api/src/skills/mutation/skills-mutation.service.ts`), was rejected because the issue asks for `409`. The project create flow already speaks `409` with a typed code.

## Library isolation

`libs/projects` stays host-agnostic:

- `ProjectView` receives a `ProjectViewModel` (name, description, instructions, context files), `isPinned`, resolved `labels`, and callbacks (`onBack`, `onTogglePin`, `onPublish`, `onEdit`, `onShare`, `onDownload`, `onDelete`, `onOpenFile`, `onRetry`).
- REST paths, ids, ETags, the feature flag, routing, i18n, toasts and the share/publish containers stay in the app.

## Rollback and compatibility

- Additive and flag-gated. Reverting the PR removes the routes and endpoints.
- The user-config v7 migration only adds an empty `projects` section. A v6 reader would ignore it, so rolling back leaves stored configs readable.
- Projects renamed or edited through the new endpoints remain valid Core resources with the same `PROJECT.md` + `context/` layout.
- `SharePopoverContainer`'s prop change is app-internal.
- `ProjectCreateForm`'s context-file type is widened, not narrowed, so it is not breaking for hosts.

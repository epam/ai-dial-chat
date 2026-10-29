## Context

#9596 added the Projects listing (`GET /api/v1/projects`, `@epam/ai-dial-projects` `Projects`, `/projects`). #9605 added create:

- `POST /api/v1/projects`;
- `ProjectCreateForm`;
- `/projects/new`;
- the `PROJECT.md` (frontmatter `name`/`description`, instructions as body) + `context/{fileName}` layout;
- name = path.

The archived design is `openspec/changes/archive/2026-10-28-add-project-create-page/design.md`.

DIAL Core facts this design relies on. They were read in the local `ai-dial-core` checkout (`b9c6f0dd`) and re-checked against its `origin/development`:

- **One version per write, one aggregate ETag.**
  - `ComplexResourceService.put` writes a whole new version. It checks `If-Match`/`If-None-Match` against the marker's aggregate ETag, then commits.
  - The per-file `PUT`/`DELETE` routes go through `copyOnWrite`, which copies the whole current version per call.
  - `delete` also checks `If-Match`.
- **The archive is a consistent snapshot.** `ComplexResourceController.downloadArchive` zips the files of the marker's `currentVersion` into memory. Entry names are paths relative to the project root (`PROJECT.md`, `context/x.csv`). The response carries `ETag` = that marker's ETag, plus `Content-Length`.
- **Metadata is thin.**
  - Item metadata (`itemMetadata`) carries `createdAt`, `updatedAt`, `etag`, `author` and `attributes`, and no permissions.
  - The file listing (`listFiles`) carries name, `etag`, timestamps and author, with no size or content type.
  - Sizes exist only in the marker's `fileMetadata`.
- **Move does not check an ETag.** `ResourceOperationService.moveResource` supports `PROJECT`, needs `ALL` access on the source and `WRITE` on the destination, and refuses an existing destination unless `overwrite`. It deletes the source with `EtagHeader.ANY`, and it takes no `If-Match`. In the same bucket it moves invitations and shared access (`InvitationService.moveResource`, `ShareService.moveSharedAccess`).
- **Publication and share limit.** `PublicationService` accepts `PROJECT`. `ShareService.DEFAULT_MAX_ACCEPTED_USERS[PROJECT] = 10`.

On the chat side, the closest models:

- **View/edit page split:** `ScheduledTaskDetailPage` / `ScheduledTaskEditPage` (`apps/chat/src/pages/`).
- **ZIP download and per-file streaming:** `SkillsController.downloadSkill` and `SkillsDownloadService` (`apps/chat-api/src/skills/download/skills-download.service.ts`).
- **ZIP reading:** `yauzl` in `apps/chat-api/src/skills/import/skills-archive-extraction.service.ts`.
- **Standalone publish panel:** `PublishConversationPanelContainer`.
- **Invitation landing:** `ConversationSharedInvitation`, which reuses `SharedInvitation` with its own `getTargetRoute`.
- **Pins:** `UserConfigContext.setPinnedConversation` (optimistic, reverting on failure).

User decisions taken during planning:

- splat URLs;
- a separate edit route;
- no Unpublish, with published projects shown under Organization;
- one change;
- one atomic BFF-merged save instead of the issue's per-file endpoints.

## Goals / Non-Goals

**Goals:**

- A read of one project that is consistent with its ETag: the files, sizes and manifest shown are exactly the version the ETag names.
- An all-or-nothing edit save in one Core write, with a stale-ETag `409` and a name-taken `409` that the edit page can tell apart.
- Pin, Share, Publish, Download and Delete through the existing flows, extended for `projects/` ids without forking them.
- A host-agnostic `ProjectView` in `libs/projects`, with thin app pages that own data, routing, i18n and containers.

**Non-Goals:** see the proposal:

- chat inside a project;
- Outputs;
- Duplicate, and moving between grouping folders;
- Unpublish;
- editable shares;
- Core-side size exposure, which is a follow-up request to `ai-dial-core`.

## Decisions

### D1. Addressing: URL-encoded `:id` in the BFF, splat routes in the app

- **BFF.** Every per-project route takes `:id`, the full DIAL id `projects/{bucket}/{path…}`, URL-encoded into one path segment. `publish.controller.ts` already does this with `:entityId`, and Express decodes `%2F` in params.
  - `ProjectIdParamDto` validates it with `@Matches(/^projects\/[^/\s]+\/[^\r\n]+$/)` and a custom check. No segment may be empty, `.` or `..`, or contain a control character, and the decoded path must survive `encodeDialResourcePath` unchanged in segment count.
  - `ProjectFileParamDto.fileName` reuses `IsDialEntityName` (`apps/chat-api/src/common/validators/dial-entity-name.validator.ts`), the rule create applies to context file names.
  - The bucket comes from the id, not the session. Reads of shared and public projects need it, and Core authorizes every call with the caller's token.
- **App.**
  - `ROUTES.ProjectView = '/projects/view/:bucket/*'`;
  - `ROUTES.ProjectEdit = '/projects/edit/:bucket/*'`;
  - `ROUTES.ProjectSharedInvitation = '/projects/shared/:invitationId'`.
  - `getProjectViewRoute(id)` and `getProjectEditRoute(id)` in `apps/chat/src/constants/routes.ts` strip the `projects/` prefix, reject unsafe segments with `isSafePathSegment` (falling back to `ROUTES.Projects`), and re-encode each segment, as `getConversationRoute` does. A `parseProjectRouteParams(params)` helper rebuilds the id, or returns `null` for an unsafe or empty path. The page then renders its not-found state.
  - The static `view`, `edit`, `shared` and `new` segments keep the patterns disjoint.
- **Alternative:** a `?id=` query, like `SkillEditor`. Rejected by the user in favour of readable deep links.

### D2. A project snapshot comes from Core's ZIP

`ProjectsSnapshotService` (`apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`) owns reading. `read(bucket, path, token, signal)`:

1. Calls `downloadProjectFolder(bucket, encodeDialResourcePath(path), { parseAs: 'stream' })`.
2. Rejects a missing `ETag` as an invalid upstream response (502). A `Content-Length` above `PROJECT_ARCHIVE_READ_MAX_BYTES` is rejected before buffering: `413 project-too-large`.
3. Buffers the stream with the same running byte cap.
4. Opens the buffer with `yauzl.fromBufferPromise` (`lazyEntries`) and walks the central directory. It records every entry's name and uncompressed size, rejects absolute or `..` entry names (502, zip-slip guard), and inflates only `PROJECT.md`, capped at `PROJECT_MANIFEST_MAX_BYTES`.
5. Returns:
   - `etag`;
   - the parsed `manifest` (`{ description, instructions } | null`);
   - `contextFiles` (direct children of `context/`, with name and size);
   - `otherEntries` (every other path, including nested `context/a/b` paths written by another client);
   - a lazy `readEntry(name)` for the save path.

Constants:

- `PROJECT_ARCHIVE_READ_MAX_BYTES` is 64 MiB, Core's default per-project total (`complexResource.types.projects`).
- `PROJECT_MANIFEST_MAX_BYTES` is 1 MiB, far above the 32,000-character instructions purpose limit.

Why the ZIP:

- It is the only Core read that carries sizes, which the BFF's capacity check and the edit form's capacity meter need. The view page shows no meter (user decision: how to present a project's capacity use is not settled).
- It is one request, and its ETag matches exactly the bytes parsed.
- The alternatives each fail on one of these points:
  - three metadata and file calls have no sizes, and race against each other;
  - a per-file `GET` only to read `Content-Length` means up to 100 requests and still no snapshot ETag;
  - storing sizes in `PROJECT.md` drifts.
- **Trade-off:** a view reads the whole archive, which Core already builds in memory. The cost is bounded by the project's size, which is 10 MiB of context by default.

### D3. `PROJECT.md` parsing and the name rule

`parseProjectManifest(text)` sits next to `buildProjectManifest` in `apps/chat-api/src/projects/utils/project-manifest.util.ts`:

- It splits a leading `---\n…\n---\n` fence and parses it with `yaml`'s `parse`, using the default core schema, so no custom tags.
- It reads `description` only when it is a string. The instructions are the body, with the single blank line `buildProjectManifest` writes removed.
- **Malformed input:** a missing fence, a YAML error or a non-object yields `description: ''` and `instructions` = the whole text, plus one warning log with no content. Nothing in the file is lost on the next save.

**Name:** `ProjectDetailsDto.name` is always the last path segment, never the frontmatter `name`.

- Name = path (#9605 D2), and the listing derives it the same way. The view and the list therefore always agree, and a failed rename (D5) cannot show a name the path does not have.
- The frontmatter `name` is still written on every save, so a downloaded ZIP describes itself.
- A project without `PROJECT.md` reads as `description: ''` and `instructions: ''`.

### D4. `GET /api/v1/projects/:id`

The handler makes two calls concurrently under one `AbortSignal.timeout(PROJECT_READ_TIMEOUT_MS = 30_000)`:

- `listProjectMetadata(bucket, path)` for the item. A `FOLDER` answer means the id names a grouping folder, which is `404`. This call gives `author`, `createdAt` and `updatedAt`.
- the snapshot (D2).

Core `404` on either call is `404`. Core masks a missing resource in the caller's own bucket as `403`, so a `403` there is reported as `404`, as `SkillsDownloadService.isMaskedNotFound` does. A `403` on another bucket stays `403`.

`source` follows the listing's rules:

- `personal` when the bucket is `SessionUser.bucket`;
- `organization` when it is `PUBLIC_BUCKET`;
- `shared` otherwise.

`canEdit` is `source === personal`.

- Core gives the item no permissions.
- Project share links are view-only (D9).
- An organization project is written only through publication.

The response is `Cache-Control: private, no-store`, with no server cache, as for the listing.

### D5. `PUT /api/v1/projects/:id`: one atomic save, then an optional move

**Request.** `multipart/form-data`, reusing `ProjectContextUploadInterceptor` unchanged:

- `name`, `description`, `instructions`, as on create;
- `fileNames`: a JSON array, paired with the `files` parts, for the added or replaced files;
- `removedFileNames`: a JSON array;
- a required `If-Match` header. When it is missing, the BFF answers `428 if-match-required` before any Core call, following `SkillsController`'s update guard.

**Steps in `ProjectsUpdateService`**, a sibling of `ProjectsCreateService`:

1. **Validate** the text fields and new files with the existing create rules, by extracting the shared checks of `ProjectsCreateService.validateAndBuild` into reusable methods. A name change is validated with `IsDialEntityName` plus the reserved names.
2. **Read the snapshot** (D2). If its ETag differs from `If-Match`, answer `409 project-changed` without writing.
3. **Compute the result set:**
   - snapshot context files, minus `removedFileNames`, plus the new files;
   - a removed name that is not in the snapshot is `400 unknown-file`;
   - a new name that collides with a kept file is `400 duplicate-file-name`, so a replacement must list the name in `removedFileNames` as well;
   - the total size and the file count are checked against `PROJECT_CONTEXT_TOTAL_MAX_BYTES` and `PROJECT_CONTEXT_MAX_FILES`, giving `413 capacity-exceeded` and `400 too-many-files`.
4. **Pre-check the destination on rename.** Only when the trimmed `name` differs from the last path segment, call `listProjectMetadata` on `{parentPath}/{name}` in the same bucket. `200` is `409 name-taken`, and Core `404` lets the save go ahead.
5. **Build one `FormData`:**
   - the rebuilt `PROJECT.md`, with frontmatter `name` = the new name;
   - every kept context file, inflated from the snapshot;
   - every new file;
   - every `otherEntries` path, inflated verbatim.
6. **Write once:** `uploadProjectFolder(bucket, path, { headers: { 'If-Match': etag } })` on the current path. Core `412` is `409 project-changed`.
7. **Move on rename:** `moveResource({ sourceUrl, destinationUrl, overwrite: false })`.
   - Core `400`: re-check the destination. If it now exists, answer `409 name-taken`; otherwise use `mapDialHttpStatus`.
   - Then read the destination's item ETag through `listProjectMetadata`, because Core recomputes the marker on copy.
8. **Migrate the pin on rename:** `UserConfigService.replaceProjectPin(oldId, newId)`. This is best effort, and a failure is logged without failing the save, because the project change is already committed.

**Response.** `UpdateProjectResponseDto { id, name, bucket, path, etag, isPinned }`.

**Why one write:**

- Every edit either commits whole, as one Core version, or not at all.
- One snapshot read serves validation and the merge.
- The browser uploads only new bytes.

**Atomicity limit:** the move is a second, unconditional step.

- If it fails after the write, the content is saved under the old path, and the error tells the page to reload. The reload shows the saved text under the old name, because the name comes from the path (D3).
- A concurrent edit landing between steps 6 and 7 is moved along unchecked, because Core's move takes no ETag. The window is milliseconds, and is accepted.

**Alternatives:**

- The issue's `PATCH` plus per-file `PUT`/`DELETE`. Rejected by the user: a save could fail midway, and every file `PUT` needs its own snapshot read and Core version copy.
- Move first, then write on the destination. Rejected: a stale ETag would then be detected only after the rename had already happened.

### D6. Delete and downloads

- **`DELETE /api/v1/projects/:id`.** `If-Match` is required, and a missing one is `428`. The handler calls `deleteProjectFolder` with `If-Match`; Core `412` is `409 project-changed`, and `404` is `404`. On success it best-effort calls `UserConfigService.removeProjectPin(id)` and responds `204`.
- **`GET /api/v1/projects/:id/archive` (`downloadProject`).** Streams `downloadProjectFolder` with `parseAs: 'stream'`. It forwards only `content-type`, `etag` and a BFF-built `Content-Disposition: attachment; filename*=UTF-8''{name}.zip`, and pipes with the `SkillsController.downloadSkill` disconnect handling.
- **`GET /api/v1/projects/:id/files/:fileName` (`downloadProjectFile`).** Streams `downloadProjectFile(bucket, path, 'context/' + fileName)` the same way, with `Content-Disposition: attachment`.
  - Both forward `X-Content-Type-Options: nosniff`, and neither ever serves inline, so a context file cannot render as HTML on the chat origin.
  - `Content-Disposition` carries an ASCII `filename="…"` fallback (non-ASCII, quote and backslash replaced by `_`) before the RFC 5987 `filename*=UTF-8''…`. The app's `extractFilename` (`apps/chat/src/utils/file-download.ts`) now prefers `filename*`, so a Cyrillic file name is saved under its real name rather than the fallback.
- **Frontend.** The generator emits `Blob | void` for these endpoints, so the wrappers use the `Raw` methods. The pattern is `downloadSkill` in `apps/chat/src/server-api/skills.api.ts` with `triggerBrowserDownload`.

### D7. Errors

`ProjectCreateErrorCode` keeps its name, because it is already in the generated client and used by the create page. It gains four members:

- `ProjectChanged = 'project-changed'` (409);
- `IfMatchRequired = 'if-match-required'` (428);
- `ProjectTooLarge = 'project-too-large'` (413);
- `UnknownFile = 'unknown-file'` (400).

The JSDoc is widened to "domain codes on project write rejections". `projectConflict` and the other helpers in `apps/chat-api/src/projects/utils/project-create-error.util.ts` are reused.

A rename to `ProjectErrorCode` was considered. It is deferred, because it would churn the generated client and the create page for no behavior change.

### D8. Pins: a `projects` user-config section

- **Storage.** `UserConfig` gains `projects: ProjectsConfig { pinnedIds: string[] }`. `CURRENT_CONFIG_VERSION` goes from 6 to 7, `DEFAULT_USER_CONFIG` and `createDefaultUserConfig` include `projects: { pinnedIds: [] }`, and `migrateConfig` reads `projects.pinnedIds` when present (filtering to strings) and defaults it otherwise. `UserConfigDto` gains `projects: ProjectsConfigDto`.
- **Routing.** `UserConfigService.updatePin(path, …)` writes to `projects.pinnedIds` when `path` starts with `projects/`, and to `conversations.pinnedIds` otherwise. The endpoint and `UpdatePinsDto` keep their shape. Only the Swagger text widens to "conversation or project".
- **New helpers.** `replaceProjectPin(oldId, newId, token, bucket)` and `removeProjectPin(id, token, bucket)` read, mutate and write the config. Both are no-ops when the id is not pinned. `UserConfigModule` already exports the service, so `ProjectsModule` imports the module.
- **Frontend.** `UserConfigContext` gains:
  - `pinnedProjectIds`, loaded from `config.projects?.pinnedIds ?? []`;
  - `setPinnedProject(id, isPinned)`, optimistic with revert, like `setPinnedConversation`, and calling a new `pinProject` wrapper in `apps/chat/src/server-api/user-config.api.ts`;
  - `replacePinnedProjectId(oldId, newId)`, a local-state update after a rename the BFF already migrated.
  - A failed pin toggle on the view page reverts and shows `projects.actions.pinError`.
- A failed pin toggle on the view page reverts and shows `projects.actions.pinError`.

  The context value stays in `useMemo`, and the new callbacks are `useCallback`.
- **Projects page.** `useProjects` maps `isPinned` from `pinnedProjectIds`. `sortProjects` partitions pinned before unpinned within every `ProjectsSortKey`.
- **Alternative:** reusing `conversations.pinnedIds`. Rejected: conversation listing builds a pinned set from it, and a mixed-kind list is a trap for the next reader.

### D9. Share and publish

- **Share BFF.**
  - `['projects/', 'PROJECT']` is added to `RESOURCE_KIND_BY_PREFIX`, and `projects` to the `CATALOG_RESOURCE_PATH` regex and its message (`apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`).
  - `getInvitationRoutePath` returns `/projects/shared` for `projects/`.
  - `CreateShareLinkDto` already accepts any DIAL id.
- **Share app.**
  - `SharePopoverContainer` props become `{ itemId: string; canEditAccess: boolean; isQuickApp?: boolean; onClose }`. `EDITABLE_ACCESS_TYPES` moves to a `canEditShareAccess(type)` helper in `apps/chat/src/utils/share.ts`, which `CatalogView` calls.
  - The project page passes `canEditAccess={false}`, so project links are view-only. This is what keeps a shared project read-only (D4).
  - The catalog anchors the popover to its Share button through a kit `Dropdown`. The project page opens Share from the ⋮ menu, which has closed by then, so `ProjectShareOverlay` (`apps/chat/src/components/ProjectShareOverlay/`) centres the same popover on a backdrop, closes on a backdrop click, and returns focus to the element that opened it.
- **Share limit.** The issue asks to surface Core's 10-user cap "the same way as for skills". For skills, the chat surfaces it only reactively, when a recipient's accept fails (`ShareInvitationErrorCode.AcceptedUsersLimitReached`, shown by `SharedInvitation`). Projects get the identical behavior through `ProjectSharedInvitation`. No proactive limit text is added, because skills have none to match.
- **Invitation landing.** `ProjectSharedInvitation` (`apps/chat/src/pages/ProjectSharedInvitation/ProjectSharedInvitation.tsx`) renders `SharedInvitation` with:
  - `getTargetRoute = getProjectViewRoute`;
  - `errorFallbackRoute = ROUTES.Projects`.

  This follows `ConversationSharedInvitation`.
- **Publish BFF.** `CatalogEntityType.Project = 'project'`. The target prefix already comes from the id (`getResourceTypePrefix`), and projects are not versioned.
- **Publish app.** `PublishProjectPanelContainer` (`apps/chat/src/components/PublishProjectPanelContainer/`) is a copy of the `PublishConversationPanelContainer` structure:
  - `StandalonePublishPanel`, `usePublishFolders`, `usePublishErrorNotification` and `getPublishRules`;
  - `publishCatalogEntity({ entityType: CatalogPublishEntityType.Project, entityId, … })` from `apps/chat/src/server-api/publish.api.ts`;
  - `NotifiableEntity.Project` + `EntityOperation.PublishRequested` for the toast.

  `CatalogEntityType` in `libs/chat-shared` is **not** extended, because that would break five exhaustive `Record<CatalogEntityType, …>` maps for a type the catalog never renders. `CatalogPublishEntityType` in `libs/chat-hooks` gains `'project'` to stay in sync with the API.

### D10. `ProjectView` in `libs/projects` and the app page

**Lib.** `ProjectView` (`libs/projects/src/components/ProjectView/ProjectView.tsx`) is presentational.

- **Props:**
  - `project: ProjectViewModel | null`;
  - `isLoading`, `hasError`, `isNotFound`;
  - `isPinned`, `isReadOnly`, `isPinPending`;
  - `contextSearchQuery` / `onContextSearchQueryChange`;
  - callbacks: `onBack`, `onTogglePin`, `onPublish?`, `onEdit?`, `onShare?`, `onDownload`, `onDelete?`, `onOpenFile(fileName)`, `onRetry`, `onBrowseProjects`;
  - `labels: ProjectViewLabels`;
  - `styles?`.
- **Read-only.** An omitted `onEdit`, `onDelete`, `onShare` or `onPublish` hides that action, so read-only mode is the host omitting them.
- **`ProjectViewModel`:** `{ name; description; instructions; contextFiles: ProjectContextFileItem[] }`, where `ProjectContextFileItem = { name; contentType }`. The app infers `contentType` with `inferMimeTypeFromPath` (chat-shared).
- **Composition:**
  - **Header:** a back `Button` with `IconArrowLeft` and `rtl:scale-x-[-1]`, and the name in `EllipsisTooltip`.
  - **Pin:** an icon `Button` with `aria-pressed`.
  - **Publish and Edit buttons,** shown on desktop.
  - **⋮ menu:** a kit `ButtonDropdown` with Share, Download and Delete. On mobile (the `mobile:` variant in CSS), Publish and Edit also move into it. The lib renders both placements and hides one with CSS, so it never needs `useIsMobile`.
  - **Details panel:** an `<aside>` on the end side on desktop, stacked under the header on mobile. It holds:
    - Description, as `<p>`, omitted when empty;
    - Instructions, through `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, omitted when empty;
    - Context: the kit `Search` inside `role="search"`, and `AttachmentCard`s whose names go through `Highlight`. A card click calls `onOpenFile`. No capacity meter.
  - **Panel frame:** no card — the page background with only an inline-start border on desktop and a top border when stacked on mobile.
  - **Live region:** an `aria-live="polite"` status announces the match count, or none, while a context query is active.
  - **States:** `Spinner` while loading. `NoDataContent` with a retry `Button` on error. A not-found `NoDataContent` with a link-styled button to the Projects list. An empty-context message when there are no files.
- **New dependency:** `MarkdownRenderer` comes from `@epam/ai-dial-chat-shared`, an existing peer, so no new package.
- **Isolation.** The lib receives resolved strings, sizes and callbacks. It never sees ids, ETags, routes, flags or i18n.

**App.** `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`):

- reads the route params (D1);
- loads through `useProject(id, isEnabled)`, which follows `useProjects`: derived `isLoading`, `AbortController`, and a stable `retry`;
- holds the context query in `useState`;
- wires `useProjectActions`: pin, download, delete with its confirmation state, and open file;
- mounts `SharePopoverContainer`, `PublishProjectPanelContainer` and `DeleteConfirmationDialog` (chat-shared).

Delete runs `deleteProject(id, etag)` then:

- **on success:** toast (`NotifiableEntity.Project` + `EntityOperation.Deleted`), then `navigate(ROUTES.Projects)`;
- **on `409`:** a "changed elsewhere, reload" toast, and `retry()`.

No new context is introduced, because only this page consumes the data.

### D11. Edit mode of `ProjectCreateForm` and `ProjectEditPage`

**Form props.** No new prop. The host already supplies `labels.title`, `labels.createLabel`, `labels.submittingLabel` and `labels.creatingStatus`, so the edit page passes "Edit project", "Save", "Saving…" and "Saving project…". A `mode` prop was considered and dropped: it would only pick strings the host already owns, and the lib rule is that every declared prop is read.

**Context-file type.** `contextFiles` widens to `ProjectContextFile[]`, where `ProjectContextFile = Attachment | StoredProjectContextFile`:

- `StoredProjectContextFile extends DisplayAttachment { size: number; isStored: true }`;
- `getContextFilesSize` and `checkContextFiles` use `'file' in f ? f.file.size : f.size`;
- `Attachment` stays assignable to `contextFiles`. `onContextFilesChange` receives the union, so `ProjectCreatePage` types its state as `ProjectContextFile[]` and narrows with the exported `isStoredContextFile` guard when collecting files to upload. A stored card renders exactly like a new one, with a remove button.

**Page.** `ProjectEditPage` (`apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`):

- loads with `useProject`;
- seeds `values` and `contextFiles` (stored entries) once per loaded ETag;
- tracks `removedFileNames` (stored files the user removed) and the new `Attachment`s;
- computes `isDirty` against the loaded snapshot, which drives `useBuilderLeaveGuard`.

**Save.** `useSaveProject` calls `updateProject(id, { name, description, instructions }, newFiles, removedFileNames, etag, signal)`, aborts on unmount, and normalizes errors with `getApiErrorDetails`.

- **Success:**
  1. toast;
  2. `replacePinnedProjectId` when the id changed;
  3. `allowNextNavigation()`;
  4. `navigate(getProjectViewRoute(response.id))`.
- **`409 name-taken`:** inline on Name, with focus.
- **`409 project-changed`:** an error toast with a Reload action that re-runs `useProject.retry` and reseeds. The draft is discarded only after the user chooses Reload.
- **File codes:** inline under Context, as on create (`mapProjectCreateError`).
- **Anything else:** an error toast, and the draft is kept.

**Read-only guard.** A non-editable project (`canEdit: false`) redirects to the view route.

### D12. Navigation from the list and after create

- **List.** `Projects` gains `onOpenProject?: (id: string) => void`. When it is given, each card's name renders as a kit link-styled `<a href>` built by a host-supplied `getProjectHref(id)`, so middle-click and open-in-new-tab work. Click is intercepted for client routing. Without the prop, cards stay static.
- **After create.** `ProjectCreatePage` navigates to `getProjectViewRoute(response.id)` instead of `ROUTES.Projects`.

## Authorization

| Endpoint | Who may call it |
| --- | --- |
| `GET /api/v1/projects/:id` | Any authenticated session with `projectsEnabled` (`FeatureGuard`, roles from `PROJECTS_ENABLED_ROLES`). Core decides READ with the caller's token: own bucket, shared with them, or public. |
| `GET /api/v1/projects/:id/files/:fileName`, `GET /api/v1/projects/:id/archive` | Same as `GET /api/v1/projects/:id`. |
| `PUT /api/v1/projects/:id` | Same guard, plus CSRF (global). Core requires WRITE on the source, and the move requires `ALL` on the source and `WRITE` on the destination. The BFF does not add a bucket check: project share links are view-only, and public projects reject non-admin writes in Core. |
| `DELETE /api/v1/projects/:id` | Same as `PUT`. |
| `PATCH /api/v1/user-config/pins` (with a project id) | Unchanged: an authenticated session. It writes only the caller's own config. |

The share and publish endpoints are unchanged except for the accepted prefix.

## UI states

**View page:**

- **Flag off:** `NotFound`.
- **Loading:** `Spinner`.
- **Error:** a message and Retry.
- **Not found** (a `404`, or an unsafe route): a message and a link to `/projects`.
- **Loaded:** the header and Details.
- **Empty context:** a message.
- **No search matches:** a message, plus the live announcement.
- **Pin pending:** the Pin button is `aria-disabled`.
- **Delete:** confirm dialog, then a deleting state in the dialog, then a toast and navigation.

**Edit page:**

- loading, error and not-found, as on the view page;
- the form;
- submitting;
- the inline name and context errors;
- a conflict toast with Reload;
- success: navigation to the view page.

## Risks / Trade-offs

- **[A view reads the whole archive]** → It is bounded by `PROJECT_ARCHIVE_READ_MAX_BYTES` and checked against `Content-Length` before buffering. Chat-created projects are at most 10 MiB of context by default. A Core feature request to expose the marker's sizes in item metadata is the follow-up that removes the archive read from `GET`.
- **[Memory on save]** → A save holds the snapshot and the new files: up to capacity plus the request, the same order as create (#9605 D5).
- **[The rename's move is unconditional]** → The ETag is checked by the preceding write. The remaining window is between two BFF calls. Shares and invitations move with the project in the same bucket (Core).
- **[A name taken between the pre-check and the move]** → Core refuses the move (`overwrite: false`), and the BFF re-checks and answers `409 name-taken`. The content write has already succeeded under the old name, which the reload shows.
- **[A pin migration failure after a rename]** → It is logged and the save still succeeds. The old pin becomes a dangling id. `useProjects` ignores ids that are not listed, so the user sees an unpinned project and can re-pin it.
- **[Entries written by another client]** → They are preserved verbatim on save (`otherEntries`). Nested `context/` sub-folders are neither listed nor counted against capacity, and are kept.
- **[ZIP parsing of upstream data]** → Entry names are checked for traversal, the manifest inflate is capped, and `yauzl` validates the central directory. A malformed archive is `502`.
- **[A dangerous file served from the chat origin]** → It is always sent as an attachment with `nosniff`, never inline.

## Migration Plan

- **Deploy.** Deploy is additive behind `PROJECTS_ENABLED`. User config v6 migrates lazily to v7 on the next read or write, gaining `projects: { pinnedIds: [] }`.
- **Order, in one PR:**
  1. BFF: user-config, share, publish, then projects;
  2. `npm run openapi` and `openapi:check`;
  3. libs: `projects`, `chat-hooks`;
  4. the app.
- **Rollback.** Revert the PR. A v7 config read by v6 code keeps an ignored `projects` key, and the migration tolerates extra keys. Edited and renamed projects stay valid Core resources.

## Open Questions

None blocks implementation. Follow-ups:

- **Core.** Expose per-file `contentLength`/`contentType` in the project file metadata, and optionally an ETag-checked move. Raise this on epam/ai-dial-core#2131.
- **Rename.** Whether `ProjectCreateErrorCode` should be renamed to `ProjectErrorCode` in a cleanup change.

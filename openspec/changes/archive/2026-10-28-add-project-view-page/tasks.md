**Slicing strategy: vertical, risk-first.** Slice 1 proves the highest-risk piece, reading a consistent snapshot from Core's ZIP, end to end into a read-only view page. Each later slice adds one action through BFF → generated client → app → lib, and is verifiable on its own. The generated client is regenerated in every slice that changes an endpoint contract. Backend tests live under `apps/chat-api/src/<domain>/tests/`, and frontend tests in a `tests/` folder next to the source. TypeScript relative imports stay extensionless.

## 1. Read path: snapshot, GET /api/v1/projects/:id, read-only view page

- [x] 1.1 Add `parseProjectManifest` to `apps/chat-api/src/projects/utils/project-manifest.util.ts`: fence split, `yaml` `parse`, string-only `description`, the body with the single separator line removed, and the malformed-input fallback with one content-free warning.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-manifest.util.spec.ts`. Cover round-trip with `---`, `: ` and `#` in the description; no fence; invalid YAML; a non-object frontmatter.
- [x] 1.2 Add `ProjectIdParamDto` and `ProjectFileParamDto` (`apps/chat-api/src/projects/dto/project-id-param.dto.ts`), with the `@Matches` allowlist, the segment check (empty, `.`, `..`, control characters, trailing `/`) and `IsDialEntityName` for `fileName`. Add a `parseProjectId` helper in `apps/chat-api/src/projects/utils/project-id.util.ts` that returns `{ bucket, path, parentPath, name }`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-id-param.dto.spec.ts`. Include traversal, a foreign prefix, a Cyrillic name, and a name with spaces, `#` and `?`.
- [x] 1.3 Create `ProjectsSnapshotService` (`apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`). It calls `downloadProjectFolder` with `parseAs: 'stream'`; requires `ETag`; enforces `PROJECT_ARCHIVE_READ_MAX_BYTES` (64 MiB) on `Content-Length` and on the running count, giving `413 project-too-large`; buffers; walks the central directory with `yauzl.fromBuffer` (`lazyEntries`); applies the zip-slip guard (502); inflates `PROJECT.md` capped at `PROJECT_MANIFEST_MAX_BYTES`; classifies entries into `contextFiles` and `otherEntries`; and exposes a lazy `readEntry`. Add the constants to `apps/chat-api/src/projects/constants/project-context.constants.ts`. Register the service in `ProjectsModule`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-snapshot.service.spec.ts`, with fixture ZIPs built in the test with `archiver` (already a dependency). Cover sizes, ETag, a missing ETag, an oversized `Content-Length`, a streamed overflow, `../evil.txt`, nested `context/a/b.csv` and an oversized manifest.
- [x] 1.4 Add `ProjectDetailsDto` and `ProjectContextFileDto` (`apps/chat-api/src/projects/dto/project-details.dto.ts`). Add the `ProjectCreateErrorCode` members `ProjectChanged`, `IfMatchRequired`, `ProjectTooLarge` and `UnknownFile` (`apps/chat-api/src/projects/types/project-create-error-code.enum.ts`), and widen its JSDoc to "project write rejections".
- [x] 1.5 Implement `ProjectsService.getProject(id, sessionBucket, token)`: concurrent metadata and snapshot under one `AbortSignal.timeout(30_000)`; `FOLDER` and `404` both give `404`; `source` and `canEdit` derived from the bucket; `name` from the path. Add the `GET :id` handler (`getProject`) in `projects.controller.ts`, with `Cache-Control: private, no-store`, `@ApiParam` and an `@ApiResponse` for 200/400/401/403/404/413/429/502/503, and `@ApiDialCoreErrors()`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.service.spec.ts`. Cover personal, shared and organization; a missing `PROJECT.md`; `404`; a grouping folder; a timeout.
- [x] 1.6 Add supertest integration tests for `GET /api/v1/projects/:id`: flag off is `403` with no Core call; traversal is `400`; happy path `200` with the cache header.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 1.7 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Confirm that `ProjectsApi.getProject` and `ProjectDetailsDto` are generated, and do not hand-edit generated files.
- [x] 1.8 Add `ROUTES.ProjectView` to `apps/chat/src/types/routes.ts`. Add `getProjectViewRoute`, `getProjectEditRoute` and `parseProjectRouteParams` to `apps/chat/src/constants/routes.ts`.
  - Verification: `npm run test:file -- apps/chat/src/constants/tests/routes.spec.ts`. Cover nested and encoded segments, an unsafe id falling back to `/projects`, and the round trip.
- [x] 1.9 Add `getProject(id, { signal })` to `apps/chat/src/server-api/projects.api.ts` (generated `projectsApi.getProject`). Add `mapProjectDetailsToViewModel` to `apps/chat/src/utils/map-project-dto.ts`, using `inferMimeTypeFromPath` with the `application/octet-stream` fallback.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/map-project-dto.spec.ts`
- [x] 1.10 Create `useProject(id, enabled)` (`apps/chat/src/hooks/projects/useProject.ts`) with JSDoc on why it exists, the derived `isLoading`, `AbortController` cleanup, `isNotFound` vs `hasError`, and a stable `retry`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useProject.spec.ts`
- [x] 1.11 Create `ProjectView` in `libs/projects/src/components/ProjectView/ProjectView.tsx` with its models (`libs/projects/src/models/project-view-props.ts`): header (back, name with `EllipsisTooltip`, Pin with `aria-pressed`, ⋮ `ButtonDropdown` with Download), the Details `<aside>` (description, instructions through `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, Context with `AttachmentCard`s and no capacity meter; the panel is framed only by an inline-start border), and the loading, error, not-found and empty-context states. Omitted callbacks hide their actions. Export it from `libs/projects/src/index.ts`. Add a SCSS module only for overrides, following `.claude/rules/lib-styling.md`.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`. Use role, label and text queries: states, omitted sections, markdown rendering, no meter, read-only (no Edit/Delete/Share/Publish), and `onOpenFile`.
- [x] 1.12 Architecture guard for `libs/projects`: confirm that `libs/projects/src` has no `/api/`, `@epam/ai-dial-chat-api-client`, server-api, `react-router`, `react-i18next`, `useFeatureFlag`, env, storage or app-context imports, and that `ProjectView` receives only resolved strings, values and callbacks.
- [x] 1.13 Create `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`): the config-ready and flag guards, `parseProjectRouteParams`, `useProject`, memoised labels, the view model and callbacks, and back/browse navigation. Register `ROUTES.ProjectView` lazily in `apps/chat/src/app/app.tsx` in the standard wrapper.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`. Cover flag off (no request), loading, error and retry, not-found, an unsafe route, and a loaded personal and shared project.
- [x] 1.14 Slice check: `npm run verify:changed`.

## 2. Pins

- [x] 2.1 Extend `apps/chat-api/src/user-config/dto/user-config.dto.ts`: `ProjectsConfig` / `ProjectsConfigDto`, `CURRENT_CONFIG_VERSION = 7`, `projects` in `DEFAULT_USER_CONFIG` and `createDefaultUserConfig`, `migrateConfig` reading `projects.pinnedIds`, and `UserConfigDto.projects`.
  - Verification: `npm run test:file -- apps/chat-api/src/user-config/tests/user-config.dto.spec.ts`. Cover v6 → v7, filtering of non-strings, and v1 → v7.
- [x] 2.2 In `apps/chat-api/src/user-config/user-config.service.ts`: make `updatePin` route by the `projects/` prefix, and add `replaceProjectPin` (in place) and `removeProjectPin` (no write when absent). Widen the `UpdatePinsDto` Swagger text.
  - Verification: `npm run test:file -- apps/chat-api/src/user-config/tests/user-config.service.spec.ts`
- [x] 2.3 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`.
- [x] 2.4 Add `pinProject(id, isPinned)` to `apps/chat/src/server-api/user-config.api.ts`. Extend `apps/chat/src/context/UserConfigContext.tsx` with `pinnedProjectIds`, an optimistic `setPinnedProject` with revert, and `replacePinnedProjectId`, keeping the value in `useMemo` and the callbacks in `useCallback`.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/UserConfigContext.spec.tsx`
- [x] 2.5 Add `ProjectItem.isPinned` and `labels.pinnedLabel` to `libs/projects/src/models/project-item.ts` and `libs/projects/src/models/projects-props.ts`. Partition pinned first in `sortProjects` (`libs/projects/src/utils/projects.ts`). Render the pinned marker (`IconPinFilled` `aria-hidden` plus visually hidden text) in the card.
  - Verification: `npm run test:file -- libs/projects/src/utils/tests/projects.spec.ts` and `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx`
- [x] 2.6 In `ProjectsPage`, derive `isPinned` from `pinnedProjectIds` in a `useMemo`. In `ProjectViewPage`, wire Pin to `setPinnedProject`, with `isPinPending` while the request runs.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`
- [x] 2.7 Slice check: `npm run verify:changed`.

## 3. Downloads

- [x] 3.1 Add `downloadProject` (`GET :id/archive`) and `downloadProjectFile` (`GET :id/files/:fileName`) to `projects.controller.ts`, with a new `ProjectsDownloadService` (`apps/chat-api/src/projects/download/projects-download.service.ts`) modelled on `SkillsDownloadService`. Both forward only `content-type` and `etag`, set the BFF-built `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`, abort on disconnect, and pipe with `pipeline`. Add `@ApiProduces` and an `@ApiResponse` for every status.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-download.service.spec.ts`
- [x] 3.2 Add supertest tests for both routes: streamed body and headers, `404`, traversal in `:fileName` (`400`), and flag off (`403`).
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 3.3 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`.
- [x] 3.4 Add `downloadProjectArchive(id)` and `downloadProjectContextFile(id, fileName)` to `apps/chat/src/server-api/projects.api.ts`, using the `Raw` methods. Add `NotifiableEntity.Project` to `apps/chat/src/types/entity-notification.ts`, with its map entries in `apps/chat/src/utils/entity-notification.ts`. Create `useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) with download and open-file via `triggerBrowserDownload`, plus the success and error toasts.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectActions.spec.ts`
- [x] 3.5 Add a context search to `ProjectView`: kit `Search` in `role="search"`, filtering, `Highlight` on card names, the no-matches state, and the `aria-live` count. In `ProjectViewPage`, hold `contextSearchQuery` and wire `onDownload` and `onOpenFile`.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`
- [x] 3.6 Slice check: `npm run verify:changed`.

## 4. Delete

- [x] 4.1 Implement `ProjectsService.deleteProject(id, ifMatch, token, bucket)`: `428` without `If-Match`; `deleteProjectFolder` with `If-Match`; `412` gives `409 project-changed`; then a best-effort `removeProjectPin`. Import `UserConfigModule` in `apps/chat-api/src/projects/projects.module.ts`. Add the `DELETE :id` handler (`204`) with the required `@ApiHeader('If-Match')` and every `@ApiResponse`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.service.spec.ts`
- [x] 4.2 Add supertest tests for `DELETE /api/v1/projects/:id`: `204` with pin removal, `409` on `412`, `428`, `404`, and flag off.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 4.3 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`.
- [x] 4.4 Add `deleteProject(id, etag)` to `projects.api.ts`. Extend `useProjectActions` with delete: the confirmation state, success toast plus navigation to `ROUTES.Projects`, the `409` "changed elsewhere" toast plus `retry`, and the generic error that keeps the dialog open. Mount `DeleteConfirmationDialog` in `ProjectViewPage`, and pass `onDelete` only when `canEdit`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectActions.spec.ts` and `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`
- [x] 4.5 Slice check: `npm run verify:changed`.

## 5. Share

- [x] 5.1 Add `projects` to `CATALOG_RESOURCE_PATH_PATTERN` and its message (`apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`). Add `['projects/', 'PROJECT']` to `RESOURCE_KIND_BY_PREFIX`, and the `/projects/shared` branch with its constant to `getInvitationRoutePath` (`apps/chat-api/src/share/utils/share-resource.util.ts`).
  - Verification: `npm run test:file -- apps/chat-api/src/share/tests/catalog-resource-path.validator.spec.ts` and `npm run test:file -- apps/chat-api/src/share/tests/share-resource.util.spec.ts`. Locate the existing spec files first and extend them.
- [x] 5.2 Change `SharePopoverContainer` props to `itemId` + `canEditAccess`. Move `EDITABLE_ACCESS_TYPES` into `canEditShareAccess` in `apps/chat/src/utils/share.ts`, and update the `CatalogView` call site only.
  - Verification: `npm run test:file -- apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx` and `npm run test:file -- apps/chat/src/utils/tests/share.spec.ts`
- [x] 5.3 Create `ProjectSharedInvitation` (`apps/chat/src/pages/ProjectSharedInvitation/ProjectSharedInvitation.tsx`), wrapping `SharedInvitation` with `getProjectViewRoute`, the `ROUTES.Projects` fallback and the flag guard. Add `ROUTES.ProjectSharedInvitation` and register it lazily in `apps/chat/src/app/app.tsx`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectSharedInvitation/tests/ProjectSharedInvitation.spec.tsx`
- [x] 5.4 In `ProjectViewPage`, add the Share item: open `SharePopoverContainer` with `canEditAccess={false}`, only when `canEdit`, and return focus to the ⋮ trigger on close.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`
- [x] 5.5 Slice check: `npm run verify:changed`.

## 6. Publish

- [x] 6.1 Add `CatalogEntityType.Project = 'project'` to `apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts`. Extend the publish service tests for a whole-project publish with an empty version and the target `projects/public/{folder}/{name}`.
  - Verification: `npm run test:file -- apps/chat-api/src/publish/tests/publish.service.spec.ts`. Locate the existing spec file first and extend it.
- [x] 6.2 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`. Add `'project'` to `CatalogPublishEntityType` in `libs/chat-hooks/src/catalog/publish.ts`.
- [x] 6.3 Create `PublishProjectPanelContainer` (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`), following `PublishConversationPanelContainer`: `publishCatalogEntity` with `CatalogPublishEntityType.Project`, a `PublishRequested` toast, and `returnFocusRef`. Wire `onPublish` in `ProjectViewPage` only when `canEdit`.
  - Verification: `npm run test:file -- apps/chat/src/components/PublishProjectPanelContainer/tests/PublishProjectPanelContainer.spec.tsx`
- [x] 6.4 Slice check: `npm run verify:changed`.

## 7. Edit and rename

- [x] 7.1 Extract the shared field, name and file checks of `ProjectsCreateService.validateAndBuild` (`apps/chat-api/src/projects/create/projects-create.service.ts`) into reusable methods, without changing create behavior.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-create.service.spec.ts` stays green, unchanged.
- [x] 7.2 Create `ProjectsUpdateService` (`apps/chat-api/src/projects/update/projects-update.service.ts`) and `UpdateProjectDto` / `UpdateProjectResponseDto`:
  - `428` without `If-Match`;
  - validation;
  - snapshot ETag mismatch → `409 project-changed`;
  - the result-set rules (`unknown-file`, `duplicate-file-name`, `capacity-exceeded`, `too-many-files`);
  - the rename destination pre-check (`409 name-taken`);
  - one `FormData` with the rebuilt manifest, the kept and new context files, and `otherEntries` verbatim;
  - one `uploadProjectFolder` with `If-Match` (`412` → `409`);
  - `moveResource` with `overwrite: false` and the `400` re-check, then a destination ETag read;
  - a best-effort `replaceProjectPin`.

  Logs carry counts and bytes only.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-update.service.spec.ts`. Cover every requirement scenario in `project-detail-api` for `PUT`, including exactly one Core write for a text-only edit, and other clients' entries surviving.
- [x] 7.3 Add the `PUT :id` handler (`updateProject`) using `ProjectContextUploadInterceptor`, with `@ApiConsumes('multipart/form-data')`, the `@ApiBody` schema including `removedFileNames`, the required `@ApiHeader('If-Match')`, and an `@ApiResponse` for 200/400/401/403/404/409/413/428/429/502/503. Add supertest tests: happy path, rename, `409` both codes, `428`, traversal and flag off.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 7.4 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`.
- [x] 7.5 In `libs/projects`, widen the form's context files to `ProjectContextFile = Attachment | StoredProjectContextFile` (`libs/projects/src/models/project-create-form-props.ts`). Update `getContextFilesSize` and `checkContextFiles` (`libs/projects/src/utils/context-files.ts`) to read the stored `size`, and export the new types from `libs/projects/src/index.ts`. `ProjectCreatePage` must compile unchanged.
  - Verification: `npm run test:file -- libs/projects/src/utils/tests/context-files.spec.ts` and `npm run test:file -- libs/projects/src/components/ProjectCreateForm/tests/ProjectCreateForm.spec.tsx`
- [x] 7.6 Add `updateProject(id, fields, newFiles, removedFileNames, etag, signal)` to `projects.api.ts`. Create `useSaveProject` (`apps/chat/src/hooks/projects/useSaveProject.ts`) with JSDoc, abort on unmount and `getApiErrorDetails` normalization. Map `unknown-file` in `apps/chat/src/utils/project-create-errors.ts`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useSaveProject.spec.ts` and `npm run test:file -- apps/chat/src/utils/tests/project-create-errors.spec.ts`
- [x] 7.7 Create `ProjectEditPage` (`apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`):
  - the flag guard and the `canEdit` redirect;
  - seeding once per ETag;
  - `removedFileNames` and the new files;
  - `isDirty` feeding `useBuilderLeaveGuard`;
  - the edit label overrides;
  - the outcome mapping: success navigation plus `replacePinnedProjectId`, `name-taken` inline, `project-changed` toast with a Reload `action`, and file codes inline.

  Add `ROUTES.ProjectEdit`, register it lazily, and wire `onEdit` in `ProjectViewPage` to `getProjectEditRoute`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectEditPage/tests/ProjectEditPage.spec.tsx`
- [x] 7.8 Slice check: `npm run verify:changed`.

## 8. Navigation from the list and after create

- [x] 8.1 Add `onOpenProject` and `getProjectHref` to `Projects` (`libs/projects/src/components/Projects/Projects.tsx`): the stretched-link card, a plain primary click going to `onOpenProject` with `preventDefault`, modified and middle clicks following the `href`, and `:focus-visible` matching hover.
  - Verification: `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx`
- [x] 8.2 Wire `onOpenProject` and `getProjectHref` in `ProjectsPage`, and change `ProjectCreatePage`'s success navigation to `getProjectViewRoute(response.id)`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ProjectCreatePage/tests/ProjectCreatePage.spec.tsx`
- [x] 8.3 Slice check: `npm run verify:changed`.

## 9. i18n, RTL, mobile and a11y

- [x] 9.1 Add every new key to `apps/chat/src/i18n/locales/en.json` and every other locale file, with matching enum members in `apps/chat/src/constants/translation-keys.ts`:
  - `buttons.share`, `buttons.pin`, `buttons.unpin`, `buttons.moreActions`;
  - `projects.card.pinned`;
  - `projects.view.*`, `projects.actions.*`, `projects.edit.*`;
  - `projects.errors.changedElsewhere`, `projects.publish.*`.

  Before adding each value, grep `en.json` for an existing identical string.
  - Verification: `npm run test:file -- apps/chat/src/i18n/tests/locales.spec.ts`. Locate the locale-parity test first.
- [x] 9.2 RTL pass on `ProjectView`, the card pin marker and the edit page:
  - logical classes only (`ms`/`me`, `ps`/`pe`, `start`/`end`, `border-s`/`border-e`, `text-start`);
  - the back arrow with `rtl:scale-x-[-1]`;
  - pin, ⋮, share, download and delete icons not mirrored.

  Add an RTL render assertion.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`
- [x] 9.3 Mobile and a11y pass on `ProjectView`:
  - the `mobile` variant moves Publish and Edit into the ⋮ menu;
  - the Details panel stacks;
  - no horizontal scroll at 320 px;
  - icon-only buttons are named;
  - `aria-pressed` on Pin;
  - a keyboard-operable menu;
  - the labeled delete dialog;
  - the `aria-live` search count;
  - `stroke={DIAL_KIT_ICON_STROKE}` on every Tabler icon;
  - 7:1 fallback colours.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`

## 10. Docs and final verification

- [x] 10.1 Update `docs/architecture.md`: the `ProjectView`, `ProjectEdit` and `ProjectSharedInvitation` routes; the five `/api/v1/projects/:id…` endpoints; the ZIP-snapshot read; the `projects` user-config section (v7); `projects/` in share and publish.
- [x] 10.2 Update `apps/chat-api/README.md` (the per-project endpoints, `If-Match` and `409`/`428` semantics, the archive read cap) and `libs/projects/README.md` (`ProjectView`, `ProjectItem.isPinned`, `onOpenProject` / `getProjectHref`, `ProjectContextFile`, with examples that compile against the source). If any lib dependency changed, run `npm run docs:install-matrix`.
- [x] 10.3 Run `npm run validate:docs` and `npm run validate:specs`, and fix every failure.
- [ ] 10.4 Final verification: `npm run verify:full`, plus `npm run build:quiet`, because the new lazy routes and the lib entry point affect bundling.

## 11. Follow-ups (out of scope, record only)

- [ ] 11.1 Open a DIAL Core feature request on epam/ai-dial-core#2131: expose per-file `contentLength`/`contentType` in the project file metadata, and an ETag-checked move. Once it lands, `GET /api/v1/projects/:id` can drop the archive read.
- [ ] 11.2 Track renaming `ProjectCreateErrorCode` to `ProjectErrorCode` in a separate cleanup change.

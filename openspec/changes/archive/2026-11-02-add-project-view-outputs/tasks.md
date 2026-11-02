**Slicing strategy: contract-first, then vertical.**

- Slice 1 lands the BFF contract (list and download routes) and regenerates the client, so the frontend works against generated types.
- Slice 2 is the save fix (snapshot and `PUT`). It is independent of the UI and can land in any order after slice 1.
- Slices 3–5 deliver the Outputs section end to end: the hook, the lib component, then the page wiring with the canvas and live refresh.
- Slice 6 is docs and the final gate.

Each slice ends with `npm run verify:changed`, and the change closes with exactly one `npm run verify:full`. Read these before starting:

- `apps/chat-api/AGENTS.md`, before slices 1–2;
- `.claude/rules/libs.md` and `.claude/rules/lib-styling.md`, before slices 3–4;
- `.claude/rules/a11y.md` and `.claude/rules/rtl.md`, before slices 4–5.

Use the `@epam/ai-dial-ui-kit` MCP tools (`getEntityDetails`) to confirm the `LinkButton`, `Button`, `LiveRegion` props and the `dial-*-text` class names. Never grep the package for them.

**Architecture guard for every task touching `libs/*`:**

- `libs/projects` gains no `/api` path, no `{projectId}/files/artifacts/…` locator, no `@epam/ai-dial-chat-api-client` import, no `react-i18next`, router, flag, app context, canvas or storage. It gets data, callbacks, labels and styles only.
- `libs/chat-hooks` only calls the injected `ProjectsApiClient`. It never constructs a client, reads a route, shows a toast or navigates.
- Relative imports are extensionless.

## 1. Artifact list and download routes (BFF contract)

- [x] 1.1 Add `ProjectArtifactParamDto extends ProjectIdParamDto` to `apps/chat-api/src/projects/dto/project-id-param.dto.ts`. Its `fileName` takes `@ApiProperty` (description "Name of a file directly under the project `artifacts/` folder.", example `report.pdf`), `@IsString()` and `@IsDialEntityName()`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-id-param.dto.spec.ts`. Add cases for `report.pdf` (valid) and for `..`, `context/tickets.csv`, `a\b` and `../x` (rejected).
- [x] 1.2 Add `apps/chat-api/src/projects/dto/project-artifact-list-response.dto.ts` with the classes `ProjectArtifactItemDto` (`name`, optional `updatedAt`, optional `author`) and `ProjectArtifactListResponseDto` (`items`). Every field carries `@ApiProperty` / `@ApiPropertyOptional` and `class-validator` decorators, with the examples from the spec.
- [x] 1.3 Add `ProjectArtifactsListService` in `apps/chat-api/src/projects/artifacts/projects-artifacts-list.service.ts`, modelled on `ProjectConversationsListService.listFiles`:
  - paged `listProjectFileMetadata(bucket, encodeDialResourcePath(path), 'artifacts/', { limit: 1000, recursive: false, token })` until `nextToken` is empty;
  - `ITEM`s with a name only;
  - Core `404` → `[]`; other failures through `handleDialSdkError`, with a `403` in the caller's own bucket → `NotFoundException`;
  - newest first by `updatedAt`, then by name;
  - `Logger.debug` with the count only.

  Add the folder constant `PROJECT_ARTIFACTS_FOLDER = 'artifacts'` to `apps/chat-api/src/projects/utils/project-manifest.util.ts`, next to `PROJECT_CONTEXT_FOLDER`. Register the service in `apps/chat-api/src/projects/projects.module.ts`.
  - **Verification:** new `npm run test:file -- apps/chat-api/src/projects/tests/projects-artifacts-list.service.spec.ts`. It covers the order, nested folders dropped, `404` → empty, two pages, an own-bucket `403` → `404`, and a `502` passed through.
- [x] 1.4 Add `downloadArtifact(project, fileName, accessToken, callerBucket)` to `apps/chat-api/src/projects/download/projects-download.service.ts`. It reuses `download(...)` with `encodeDialResourcePath(`${PROJECT_ARTIFACTS_FOLDER}/${fileName}`)` and context `projects.downloadProjectArtifact`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects-download.service.spec.ts`. Add cases for the Core path, the attachment, `nosniff` and `no-store` headers, and `404`.
- [x] 1.5 Add two handlers to `apps/chat-api/src/projects/projects.controller.ts`, both under the class-level `FeatureGuard`, with no ownership check:
  - `listProjectArtifacts`, at `@Get(':id/artifacts')` with `@Header('Cache-Control', 'private, no-store')`;
  - `downloadProjectArtifact`, at `@Get(':id/artifacts/:fileName')` with `@ApiProduces('application/octet-stream')`. It goes through `streamDownload`.

  Each takes `@ApiOperation({ operationId })`, `@ApiParam`, `@ApiDialCoreErrors()` and an `@ApiResponse` for every status in the spec, with `type: ProjectArtifactListResponseDto` on the list's `200` and a binary schema on the download's `200`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`. Add delegation and header cases for both handlers.
- [x] 1.6 Add the supertest integration cases. They went into a `project artifacts` block of the existing supertest suite `apps/chat-api/src/projects/tests/projects.controller.spec.ts` rather than a new file, because that suite already boots `ProjectsController`. They cover:
  - flag off → `403` with no Core call;
  - traversal in `:fileName` (`..%2Fcontext%2Ftickets.csv`, `context%2Ftickets.csv`) → `400` with no Core call. A bare `..` never reaches the route, because WHATWG URL parsing resolves it, `%2E%2E` included; the DTO unit test of 1.1 covers it;
  - list `200` newest first;
  - download `200` with `Content-Disposition: attachment` and `nosniff`;
  - a reader in another bucket allowed;
  - a Core `404` on the download → `404`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects-artifacts.integration.spec.ts`
- [x] 1.7 Regenerate the client:
  - run `npm run openapi` and then `npm run openapi:check`;
  - check that `libs/chat-api-client/openapi.json` has `listProjectArtifacts` (returning `ProjectArtifactListResponseDto`) and `downloadProjectArtifact`, and that the generated `ProjectsApi` has `listProjectArtifacts` and `downloadProjectArtifactRaw`;
  - run `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.
- [x] 1.8 Run `npm run verify:changed`. Typecheck and lint pass. `test:changed` has two failures, both outside this change: `libs/catalog` `CreateButton.mobile.spec.tsx` (flaky, passes on rerun) and `apps/chat-api/src/files/tests/files.controller.spec.ts` › "maps a DIAL Core 401 to 401", which also fails on the branch without this change.

## 2. Artifacts leave `contentVersion` and keep their type on save (BFF)

- [x] 2.1 In `apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`, add `artifactEntries: string[]` to `ProjectSnapshot`, with a JSDoc. In `parseArchive`:
  - classify every path starting with `artifacts/` into it, after the `conversations/` check and before `versionedEntries`;
  - keep it out of `versionedEntries` and `otherEntries`, and sort it.

  Update the JSDoc of `contentVersion` and `otherEntries` to name artifacts.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects-snapshot.service.spec.ts`. Add the spec's "Artifact entries are classified but not inflated" and "An artifact write does not change contentVersion" scenarios, and keep the context-change scenario green.
- [x] 2.2 In `apps/chat-api/src/projects/update/projects-update.service.ts`, `buildFormData` appends every `snapshot.artifactEntries` path with its inflated bytes, typed `lookup(path) || 'application/octet-stream'` (`import { lookup } from 'mime-types'`).
  - Add an `artifacts=` count to the `Project saved (…)` log line, with no names.
  - Replace the comment about files outside the chat's layout, so that it no longer covers artifacts.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects-update.service.spec.ts`. Add these scenarios:
    - an artifact written while editing, which saves;
    - the `412` retry, which carries a new artifact;
    - the content types of `.pdf`, nested `.pptx` and unknown extensions;
    - the text-only edit, whose parts now include stored artifacts.
- [x] 2.3 Run `npm run verify:changed`. Typecheck and lint pass. The only test failure is the pre-existing `files.controller.spec.ts` › "maps a DIAL Core 401 to 401" (see 1.8).

## 3. `useProjectArtifacts` and the client method (`libs/chat-hooks`)

- [x] 3.1 In `libs/chat-hooks/src/project/projects-api-client.ts`:
  - add `listProjectArtifacts: (request: { id: string }, options?: RequestInit) => Promise<ProjectArtifactListResponseDto>` to `ProjectsConfiguredClient`;
  - add `listProjectArtifacts: (projectId: string, signal?: AbortSignal) => Promise<ProjectArtifactListResponseDto>` to `ProjectsApiClient`;
  - implement it in `createProjectsApiClient` with `withSignal`.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/projects-api-client.spec.ts`
- [x] 3.2 Add `mapProjectArtifactsToOutputs(items: ProjectArtifactItemDto[]): ProjectOutputItem[]` to `libs/chat-hooks/src/project/project-mapping.ts`. It maps `contentType` from `inferMimeTypeFromPath(name)`, or from `UNKNOWN_CONTENT_TYPE`. It depends on the `ProjectOutputItem` type from task 4.1, so land 4.1's model file first or in the same commit. Export it from the `project` entry point.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-mapping.spec.ts`
- [x] 3.3 Add `useProjectArtifacts(client, projectId)` in `libs/chat-hooks/src/project/use-project-artifacts.ts`, per design D6. It has JSDoc saying why it exists, is exported from the `project` entry point, and returns `{ items, isLoading, hasError, retry, refresh }`. It uses an `AbortController` per request, async/await, and memoises `retry` and `refresh` with `useCallback`.
  - **Verification:** new `npm run test:file -- libs/chat-hooks/src/project/tests/use-project-artifacts.spec.ts`. It covers:
    - the first read;
    - a `null` id, which sends no request;
    - an error, then `retry`;
    - a silent `refresh` that keeps the data and loading flags;
    - a failed `refresh` that keeps the items;
    - a project change that aborts;
    - unmount, which aborts.
- [x] 3.4 Update `libs/chat-hooks/README.md` for `useProjectArtifacts`, `mapProjectArtifactsToOutputs` and the new `ProjectsApiClient` method.
- [x] 3.5 Run `npm run verify:changed`. Slices 3 and 4 were verified in one run, because 3.2 depends on the 4.1 model. Typecheck and lint pass; the only test failure is the pre-existing `files.controller.spec.ts` one (see 1.8).

## 4. `ProjectOutputs` and the panel slot (`libs/projects`)

- [x] 4.1 Add `libs/projects/src/models/project-outputs-props.ts` with:
  - `ProjectOutputItem`, `ProjectOutputsLabels` (English defaults listed in the JSDoc), `ProjectOutputsColors` (`headingText`, `secondaryText`), `ProjectOutputsTypography` (`titleClassName` default `'dial-body-semi-text'`, `helperClassName` default `'dial-tiny-text'`), `ProjectOutputsStyles` and `ProjectOutputsProps`;
  - inline JSDoc on every field, each stating its default.
- [x] 4.2 Add `libs/projects/src/components/ProjectOutputs/ProjectOutputs.tsx` and `ProjectOutputs.module.scss`, per the `project-view-ui` spec and design D4/D7:
  - an empty → `null` branch;
  - a `<section aria-labelledby>` with an `<h2>`;
  - a collapsed `flex-nowrap overflow-x-auto` row of `AttachmentCard`s, limited to `previewLimit`;
  - a `LinkButton` See all / Show less with `aria-expanded` and `aria-controls`, which expands into a `flex-wrap` list;
  - an error branch with `LiveRegion` and the kit `Button` retry;
  - `buildCssVars` for `--po-heading-text` and `--po-secondary-text`, with the fallbacks in the SCSS;
  - typography from props only, and logical utilities only;
  - `memo`, and a one-line JSDoc on the component.
  - **Verification:** new `npm run test:file -- libs/projects/src/components/ProjectOutputs/tests/ProjectOutputs.spec.tsx`. Use role and label queries for: empty renders nothing, 9 items show 6, See all expands and collapses (`aria-expanded`), no See all for 4 items, the card click calls `onOpenOutput('report.pdf')`, the selected card, the error with retry, and the labels applied.
- [x] 4.3 Add `outputs?: ReactNode` to `ProjectConversationsPanelProps` (`libs/projects/src/models/project-conversations-panel-props.ts`), with JSDoc "Content between `composer` and the Chats list; omitted when unset". Render it between `{composer}` and the list in `libs/projects/src/components/ProjectConversationsPanel/ProjectConversationsPanel.tsx`.
  - **Verification:** `npm run test:file -- libs/projects/src/components/ProjectConversationsPanel/tests/ProjectConversationsPanel.spec.tsx`. Add a document-order case (composer, outputs, Chats heading) and an unset-slot case.
- [x] 4.4 Export `ProjectOutputs` and every type of 4.1 from `libs/projects/src/index.ts`. The lib already ships `./styles.css`, so check that the new module's styles land in `dist/index.css` with `npm exec nx build @epam/ai-dial-projects`.
- [x] 4.5 Architecture guard: run `npm exec nx lint @epam/ai-dial-projects`, and confirm that `libs/projects/src/components/ProjectOutputs/**` imports nothing from `apps/`, `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-chat-hooks`, `react-i18next` or `react-router`, and contains no `/api` string or `files/artifacts` string.
- [x] 4.6 Run `npm run verify:changed`. Slices 3 and 4 were verified in one run, because 3.2 depends on the 4.1 model. Typecheck and lint pass; the only test failure is the pre-existing `files.controller.spec.ts` one (see 1.8).

## 5. Page wiring, canvas and live refresh (`apps/chat`)

- [x] 5.1 In `apps/chat/src/utils/dial-file.ts`, add `toProjectArtifactUrl(projectId, fileName)` (locator `{projectId}/files/artifacts/{fileName}`). Generalise `resolveProjectContextFileDownloadUrl` into `resolveProjectFileDownloadUrl`:
  - `/files/context/` maps to `…/files/:fileName`;
  - `/files/artifacts/` maps to `…/artifacts/:fileName`;
  - both keep the single-segment rule.

  `resolveDialUrl` calls the new function. Update its JSDoc.
  - **Verification:** `npm run test:file -- apps/chat/src/utils/tests/dial-file.spec.ts`. Add the spec's locator-mapping scenario (`Q4 deck.pptx`), plus a nested name and a missing name, both of which resolve to `undefined`. Keep the context cases green.
- [x] 5.2 In `apps/chat/src/utils/project-file-preview.ts`, let `toStoredProjectFileAttachment` take the locator builder (default `toProjectContextFileUrl`), and add `toProjectOutputAttachment(item, projectId)` on top of it with `toProjectArtifactUrl`. Add `OUTPUT_PREVIEW_PREFIX = 'artifacts/'` helpers to build an output card id and to read one back from a preview key.
  - **Verification:** `npm run test:file -- apps/chat/src/utils/tests/project-file-preview.spec.ts`
- [x] 5.3 Add `apps/chat/src/hooks/projects/useProjectArtifacts.ts`, the app adapter that binds `projectsClient`, following `useProjectConversations.ts`. The app's `projectsClient` (`apps/chat/src/hooks/projects/projects-client.ts`) is a hand-written `ProjectsApiClient`, so it also needed:
  - a `listProjectArtifacts` entry;
  - a thin server-api wrapper `listProjectArtifacts` in `apps/chat/src/server-api/projects.api.ts`, over `projectsRequests`;
  - a test of that wrapper in `apps/chat/src/server-api/tests/projects.api.spec.ts`.
- [x] 5.4 Add the i18n keys (dedicated task):
  - `projects.outputs.title`, `projects.outputs.seeAll` (`See all ({{count}})`) and `projects.outputs.error` in `apps/chat/src/i18n/locales/en.json`;
  - the `ProjectsI18nKeys.OutputsTitle`, `OutputsSeeAll` and `OutputsError` members in `apps/chat/src/constants/translation-keys.ts`;
  - first check with grep that none of the three English strings already exists in `en.json`.
- [x] 5.5 Add `apps/chat/src/hooks/projects/useProjectOutputsLabels.ts`. It fills `ProjectOutputsLabels` with `t()`, memoised on `t`, reusing `ButtonsI18nKeys.ShowLess`, `ButtonsI18nKeys.Retry` and `ProjectsI18nKeys.ViewOpenFile`.
  - **Verification:** `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectOutputsLabels.spec.ts` (new)
- [x] 5.6 In `apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`, add the optional `outputs?: ReactNode` prop and forward it to `ProjectConversationsPanel`'s `outputs`.
- [x] 5.7 In `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`:
  - call `useProjectArtifacts(project?.id ?? null)`, and memoise the `mapProjectArtifactsToOutputs` items;
  - add `refreshArtifacts` to `handleProjectChanged`'s `Promise.all`;
  - derive `selectedOutputName` from the canvas `attachmentId`;
  - add a `handleOpenOutput` (`useCallback`) that calls `openAttachmentCanvas` with `toProjectOutputAttachment` and the `artifacts/`-prefixed preview key;
  - set `isDetailsStacked` when a context file or an output is selected;
  - render `ProjectOutputs` (with `useProjectOutputsLabels`) as the section's `outputs` when the outputs are loaded and not empty, or when the first read failed.
  - **Verification:** `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`. Add these cases:
    - outputs render between the input and the Chats list;
    - no outputs, no section;
    - the error, then Retry;
    - a read-only project shows outputs;
    - activating a card opens the canvas with the `…/artifacts/report.pdf` URL and selects only that card;
    - the same name in context and outputs;
    - a watch `UPDATE` calls `listProjectArtifacts` again and shows the new card without a spinner.
- [x] 5.8 RTL and mobile check (dedicated task):
  - confirm that `ProjectOutputs` and the panel change use only logical utilities and the `mobile` / `desktop` breakpoints, with no `sm:`/`md:`/`lg:` prefixes;
  - add an RTL render case to `libs/projects/src/components/ProjectOutputs/tests/ProjectOutputs.spec.tsx` (under `dir="rtl"`, the row has no physical-direction class);
  - add a case asserting that the row container has `overflow-x-auto` and its column has `min-w-0`, so the page itself does not scroll.
- [x] 5.9 Run `npm run verify:changed`. Typecheck and lint pass; the only test failure is the pre-existing `files.controller.spec.ts` one (see 1.8).

## 6. Docs and final gate

- [x] 6.1 Update `apps/chat-api/README.md`, in its Projects endpoints section:
  - add the two routes to the per-project table;
  - say that `contentVersion` hashes every file except conversations and artifacts;
  - say that an agent's artifact write no longer fails an edit;
  - rewrite the known-limitation paragraph: artifacts are retyped from their extension (`mime-types`); other files outside the chat's layout are still `application/octet-stream`;
  - add `/artifacts/:fileName` to the downloads sentence.

  The README repeats its whole content four times, already on `development`. Update every copy of the Projects section, and record the dedupe as follow-up 6.6.
- [x] 6.2 Update `libs/projects/README.md`:
  - a `### ProjectOutputs` section with a compiling example that passes every required prop (`items`, `onOpenOutput`, `labels`);
  - the `outputs` slot in the `### ProjectConversationsPanel` section;
  - the new types in `## Types`.
- [x] 6.3 Update `docs/architecture.md`, the `/api/v1/projects` row:
  - `/:id/artifacts` lists the agents' outputs newest first;
  - `/:id/artifacts/:fileName` streams one;
  - `contentVersion` excludes conversations and artifacts;
  - the context-file preview paragraph also covers the `{projectId}/files/artifacts/{name}` locator.
- [x] 6.4 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`, and fix every error. `validate:docs` passes and `validate:specs` reports 0 errors. `spec:impact` (advisory) lists specs touched by the #9681 changes still on this branch relative to `origin/development`; none needs an edit for this change. The `project-view-ui` delta spec was corrected to the code: `labels` is optional, the card is `AttachmentCard`'s `role="button"` element, the error sits in a `LiveRegion` and retries through a `GhostButton`.
- [x] 6.5 Run `npm run verify:full` once. Full typecheck, lint and format checks pass. `test:full` has 6,594 passing tests and one failure, the pre-existing `apps/chat-api/src/files/tests/files.controller.spec.ts` › "maps a DIAL Core 401 to 401", which also fails on the branch without this change (see 1.8).
- [x] 6.6 Follow-ups, out of scope and not done in this change. They are listed here; copy them into the PR description when the PR is opened. Also note the pre-existing `files.controller.spec.ts` failure:
  - dedupe the fourfold-repeated `apps/chat-api/README.md`;
  - extract a shared `listProjectFolderItems` for the conversations and artifacts listings (design D1);
  - a file-storage view of `projects/…/artifacts/` once `DialFileManagerPage` can address project resources (design D4);
  - confirm `previewLimit = 6` against the design (design Open Questions).

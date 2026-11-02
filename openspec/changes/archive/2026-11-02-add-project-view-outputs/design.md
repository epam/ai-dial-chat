## Context

A DIAL project is one Core resource, `projects/{bucket}/{path}/`. Core imposes no layout on it. The chat uses this layout:

| Path | Owner | Read by the BFF through |
| --- | --- | --- |
| `PROJECT.md` | chat | archive snapshot |
| `context/*` | chat | archive snapshot (`contextFiles`) |
| `conversations/*` | chat | `listProjectFileMetadata` (Chats list), snapshot (`conversationEntries`, kept on `PUT`) |
| `artifacts/**` | the agents of the project's chats | today: snapshot `otherEntries` only |

What the code does today, relevant to this change:

- **Snapshot.** `ProjectsSnapshotService.parseArchive` (`apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`) puts every path other than `PROJECT.md`, direct `context/` children and direct `conversations/` children into `otherEntries`.
  - Every entry except `conversationEntries` feeds `computeProjectContentVersion`. An artifact write therefore changes `contentVersion`, and a concurrent `PUT` answers `409 project-changed`.
- **Save.** `ProjectsUpdateService.buildFormData` (`apps/chat-api/src/projects/update/projects-update.service.ts`) re-uploads every `otherEntries` path as `application/octet-stream`. The archive carries no stored content type.
- **Ordering.** The archive snapshot keeps a name, a CRC-32 and a size per file; it has no time. The only source of `updatedAt` is Core's `listProjectFileMetadata`. The Chats list already uses it, through `ProjectConversationsListService.listFiles` (`apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`). Its items carry `name`, `nodeType`, `author`, `createdAt` and `updatedAt`, and no content type or size.
- **Context cards.** On the view page, context cards open the attachment canvas, not a download (`ProjectViewPage.handleContextFileClick` → `openAttachmentCanvas`).
  - The card's attachment `url` is the locator `{projectId}/files/context/{name}` (`toProjectContextFileUrl`, `apps/chat/src/utils/dial-file.ts`).
  - `resolveDialUrl` turns that locator into `GET /api/v1/projects/:id/files/:fileName`, which serves the canvas content resolvers and the canvas download.
- **Live updates.** The #9681 watch (`useProjectWatch`) subscribes to the whole project resource. Any file write, an artifact included, emits an `UPDATE` with a new ETag. `ProjectViewPage.handleProjectChanged` then refreshes the project and the Chats list.
- **Layout.** `ProjectConversationsPanel` (`libs/projects`) renders `{composer}` and then `ProjectConversationList`. `ProjectConversationsSection` (`apps/chat`) fills `composer` with `NewConversationComposer` and passes the panel to `ProjectView` as `mainContent`.
- **File storage.** `DialFileManagerPage` browses the session user's `files/` bucket only, so it cannot open a `projects/…` folder.

## Goals / Non-Goals

**Goals:**

- Show a project's outputs between the chat input and the Chats list, newest first, for every reader.
- Open an output in the canvas, exactly as a context file opens.
- Stop artifact writes from failing a concurrent edit, and stop an edit from rewriting their content type.
- Keep `libs/projects` free of paths, locators and clients.

**Non-Goals:**

- Writing, renaming, deleting or uploading artifacts from the chat.
- Listing nested `artifacts/` paths.
- A file-storage "See all".
- Artifact-specific storage limits.
- Showing outputs on the edit page.

## Decisions

### D1. A separate list endpoint backed by Core's file metadata, not a field on `ProjectDetailsDto`

`GET /api/v1/projects/:id/artifacts` (`listProjectArtifacts`) SHALL list `artifacts/` with `listProjectFileMetadata(bucket, encodeDialResourcePath(path), 'artifacts/', { limit: 1000, recursive: false })`.

- It pages on `nextToken` until done, keeps `nodeType === 'ITEM'` items, and sorts newest first by `updatedAt`, then by name.
- It returns every item. There is no pagination, because Core caps a project at 1,000 files.
- A Core `404` (no `artifacts/` folder yet) is an empty list.
- It goes in a new `ProjectArtifactsListService` (`apps/chat-api/src/projects/artifacts/projects-artifacts-list.service.ts`), modelled on `ProjectConversationsListService.listFiles`.
  - It does not share code with `ProjectConversationsListService`: the conversations service also resolves titles and read state, and generalising it would widen this change.
  - The paging loop is about 25 lines and is duplicated on purpose. Extracting a shared `listProjectFolderItems` util is recorded as a follow-up.

Alternatives:

- **`artifactFiles` in `ProjectDetailsDto`, from the snapshot** (the issue's shape). No time is available, so it can only sort by name. Rejected, because the user chose newest first.
- **The same field, with `updatedAt` merged from a parallel listing inside `getProject`.**
  - Every details read pays a second Core call: the edit page, and every live refresh.
  - The listing and the snapshot can describe different versions.
  - Rejected.
- **One endpoint that returns the first N and a total.** "See all" would then need a second request, with its own loading and error states, for a list that is bounded anyway. Rejected.

No BFF cache: the listing is one Core call and must reflect a write at once for the live update. The response carries `Cache-Control: private, no-store`, as `listProjectConversations` does.

### D2. Download mirrors `downloadProjectFile`

`GET /api/v1/projects/:id/artifacts/:fileName` (`downloadProjectArtifact`) SHALL call `ProjectsDownloadService.downloadArtifact`. It is `download(...)` over `downloadProjectFile(bucket, path, encodeDialResourcePath('artifacts/' + fileName))`.

- It has the same headers as a context-file download: `attachment` disposition, `nosniff` and `private, no-store`, with only `content-type` and `etag` forwarded.
- It has the same 60-second headers deadline, and the same `403`→`404` mapping in the caller's own bucket.
- The route param DTO is a new `ProjectArtifactParamDto extends ProjectIdParamDto`, with `fileName` under `@IsString() @IsDialEntityName()`. Only its Swagger description differs from `ProjectFileParamDto`, which describes a `context/` file.
- The `:fileName` is one path segment. `IsDialEntityName` rejects `/`, `\`, `.` and `..`, so a nested artifact cannot be addressed, which matches D1.

Swagger declares `@ApiProduces('application/octet-stream')`. The generator emits `Blob | void`, so callers use `downloadProjectArtifactRaw`. Today the only caller is the canvas, by URL (D5), so `ProjectsApiClient` needs no download method.

### D3. Snapshot: `artifactEntries` leave `contentVersion`; `PUT` types them by extension

`ProjectSnapshot` SHALL gain `artifactEntries: string[]`: every entry path under `artifacts/`, nested ones included, sorted.

- They are classified before `context/` and leave both `otherEntries` and `versionedEntries`.
- They are never inflated by a read.
- The whole subtree is excluded, not just direct children, unlike `conversations/`. An agent may write `artifacts/run-1/report.pdf`, and that write must not fail an edit either.

`ProjectsUpdateService.buildFormData` SHALL append each artifact entry with its bytes from `snapshot.readEntry(path)`.

- Its type comes from `getArtifactContentType(path)` (`apps/chat-api/src/projects/utils/project-manifest.util.ts`).
  - It first checks an override for the extensions mime-db gets wrong: `ts`, `mts` and `cts` map to `text/typescript`, as in `inferMimeTypeFromPath`, where mime-db would say `video/mp2t`.
  - Otherwise it uses `lookup(path)` from `mime-types`, which `apps/chat-api/src/files/normalize-file-item.ts` and `apps/chat-api/src/themes/theme.controller.ts` already import.
  - When neither names a type, it falls back to `application/octet-stream`.
- `inferMimeTypeFromPath` (`libs/chat-shared`) is the issue's suggestion, but `type:backend` may depend only on `type:backend` (`eslint.config.mjs`).

The retry loop needs no change. An artifact written between the read and the write makes Core answer `412`. The loop re-reads, finds the same `contentVersion`, and rebuilds with the new artifact. At most `PROJECT_WRITE_ATTEMPTS` (3) writes are made.

Not chosen:

- **Excluding direct children only**, as for conversations. Nested agent output would still fail edits.
- **Excluding artifacts from the save**, so that a `PUT` writes no `artifacts/` entries. `uploadProjectFolder` replaces the whole project, so that would delete every artifact.

### D4. "See all" expands in place

`ProjectOutputs` renders the first `previewLimit` items (default `6`) in one `flex-nowrap overflow-x-auto` row at every width.

- When `items.length > previewLimit`, a kit `LinkButton` "See all (N)" follows the heading.
- Activating it shows every item in a wrapping grid, and the button reads "Show less".
- The button carries `aria-expanded` and `aria-controls` pointing at the list.
- The expanded state is the component's own `useState`. A live refresh does not reset it, because nothing remounts.

The issue suggests opening the project's `artifacts/` folder in the file storage. `DialFileManagerPage` browses only the session user's `files/` bucket, and making it address `projects/…` resources is a separate feature. A popup with the full list would duplicate the cards in a second surface and add focus management for no extra information.

`6` is an assumption: it fills a desktop main column at 100 px cards with 8 px gaps. The host can change it through the prop.

### D5. Opening an output reuses the context-card canvas path

The app SHALL build the attachment with `toStoredProjectFileAttachment` and a new locator `{projectId}/files/artifacts/{name}`, from `toProjectArtifactUrl` in `apps/chat/src/utils/dial-file.ts`.

- `resolveProjectContextFileDownloadUrl` becomes `resolveProjectFileDownloadUrl`. It recognises both `/files/context/` and `/files/artifacts/` and maps them to `…/files/:fileName` and `…/artifacts/:fileName`.
- Both checks keep the single-segment rule.
- The canvas content resolvers, the canvas download and `resolveAbsoluteDialUrl` all read `resolveDialUrl`, so they work without further change.

The canvas key is `toProjectPreviewKey(projectId, 'artifacts/' + name)`.

- A context file name cannot contain `/`, so an output and a context file with the same name never both render as selected.
- `ProjectViewPage` derives `selectedOutputName` from the key, and passes `isDetailsStacked` when either a context file or an output is open.

The card's `contentType` comes from `inferMimeTypeFromPath(name)`, with `''` for unknown extensions (see `UNKNOWN_CONTENT_TYPE` in `libs/chat-hooks/src/project/project-mapping.ts`), through a new `mapProjectArtifactsToOutputs`.

### D6. State ownership: `useProjectArtifacts` in `libs/chat-hooks`, owned by `ProjectViewPage`

`useProjectArtifacts(client: Pick<ProjectsApiClient, 'listProjectArtifacts'>, projectId)` lives in `libs/chat-hooks/src/project/use-project-artifacts.ts` and returns `{ items, isLoading, hasError, retry, refresh }`. It follows the shape of `useProjectConversations` without paging:

- `refresh()` silently re-reads. It never sets `isLoading` or `hasError`, and keeps the current items on failure.
  - A `refresh()` that arrives while a read is in flight is not dropped. It marks the read pending, and that read lists once more before it settles. This matters because the watch opens as the first read starts, so an agent's write can land between Core's answer and the read settling.
- A retry keeps `hasError` until its read settles, so the host's error UI, and the focused Retry button with it, stays mounted. A project change resets the state.
- A newer refresh, a retry, a project change or unmount aborts the request in flight.

`ProjectsApiClient` gains `listProjectArtifacts(projectId, signal?)`, which forwards to the generated `listProjectArtifacts({ id })`.

The app adapter `apps/chat/src/hooks/projects/useProjectArtifacts.ts` binds `projectsClient`.

`ProjectViewPage` owns the state and passes:

- `refresh` into `handleProjectChanged` as a third member of its `Promise.all`;
- the rendered `ProjectOutputs` into `ProjectConversationsSection` as a new `outputs` prop.

The section forwards it to the panel's slot. No new context: the state has one consumer.

### D7. UI states

| State | Rendering |
| --- | --- |
| first load in flight | no section, no skeleton: the section is secondary, and a placeholder that then vanishes for a project with no outputs would shift the Chats list. `ProjectViewPage` still always renders `ProjectOutputs`, and in this state, as when empty, it renders only an empty visually hidden `LiveRegion`, so the region exists before any error text. |
| loaded, empty | nothing |
| loaded, items | heading, cards, optional See all |
| first load failed | heading, the error text `projects.outputs.error` (visible copy `aria-hidden`; the always-mounted `LiveRegion` announces it) and a kit `GhostButton` "Retry" (`buttons.retry`) that calls `retry`. The section stays mounted while the retry reads. On success, focus moves to the section heading (`tabIndex={-1}`) instead of falling to the page body. |
| refresh failed | the current items stay; nothing is announced |

### D8. Library isolation

`libs/projects` receives:

- `items: ProjectOutputItem[]` (`{ name, contentType }`);
- `onOpenOutput(name)` and `selectedOutputName?`;
- `hasError?` and `onRetry?`;
- `previewLimit?`;
- `labels: ProjectOutputsLabels`;
- `styles?: ProjectOutputsStyles`, with colors `headingText` and `secondaryText` and typography `titleClassName = 'dial-body-semi-text'` and `helperClassName = 'dial-tiny-text'`.

`ProjectConversationsPanel` only gains an opaque `outputs?: ReactNode` slot. The locator scheme, the endpoint, `inferMimeTypeFromPath` mapping and the canvas stay in `apps/chat` and `libs/chat-hooks`.

## Risks / Trade-offs

- **[Risk]** An agent that writes several artifacts within seconds can exhaust the 3 write attempts of a concurrent `PUT`, which then answers `409 project-changed`. **Mitigation:** this is the existing behaviour for conversation bursts. The user reloads and saves again. No change to `PROJECT_WRITE_ATTEMPTS` is in scope.
- **[Risk]** `contentVersion` changes value once, at deploy, for every project with artifacts. An edit page opened before the deploy and saved after it gets one `409`. **Mitigation:** the edit page already handles `project-changed` with a reload prompt.
- **[Risk]** Artifacts enlarge the archive the view page buffers (`PROJECT_ARCHIVE_READ_MAX_BYTES`, 64 MiB). **Mitigation:** that is Core's own per-project default total, so Core refuses a write before the BFF read cap is reached. If an operator raises Core's limit, the existing `413 project-too-large` applies. This is unchanged behaviour, recorded in `apps/chat-api/README.md`.
- **[Trade-off]** Every owner edit replaces the type an agent stored with an extension-derived one, because the archive carries no stored type. Examples: a `.py` file becomes `application/octet-stream`, and an extensionless file the agent stored as `text/plain` does too. `mime-types` and `inferMimeTypeFromPath` can also name different types for a rare extension; the known-wrong `.ts` family is overridden. The stored type only affects later downloads.
- **[Trade-off]** `DELETE` takes the same `contentVersion`, so an output an agent wrote after the owner opened the page no longer makes the delete answer `409`; it is deleted with the project, as a conversation written meanwhile already is.
- **[Open question]** If Core's whole-project `uploadProjectFolder` resets every file's `updatedAt`, each owner edit gives all outputs one timestamp, and "newest first" falls back to name order until the agents write again. The project Chats list has the same exposure. This is unverified against Core.
- **[Trade-off]** Every live `UPDATE` now also re-lists `artifacts/`, which is one more metadata call per refresh, coalesced by the watch.
- **[Trade-off]** Nested artifacts are invisible in the chat, but they are kept on save and included in the project archive download.

## Migration Plan

No data migrates.

1. Deploy BFF and frontend together, as one release.
2. To roll back, revert the change: the routes and the section disappear, and `contentVersion` reverts to including `artifacts/`, with one more `409` for edit pages open across the rollback.

## Open Questions

- Is `previewLimit = 6` the design's number? It is an assumption (D4), changeable through the prop without an API change.
- A shared `listProjectFolderItems` util for the conversations and artifacts listings is a follow-up refactor, not part of this change.

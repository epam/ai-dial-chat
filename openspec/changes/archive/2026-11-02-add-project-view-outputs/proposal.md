## Why

The agents behind a project's chats save their results (reports, presentations, exports) into the project's `artifacts/` folder (`projects/{bucket}/{path}/artifacts/`). To find one today, the user opens each chat or the file storage. On top of that, every artifact write breaks a concurrent edit:

- `artifacts/` counts towards `contentVersion` (`computeProjectContentVersion` in `apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`), so an agent saving an output while the owner edits the project fails the save with `409 project-changed`.
- The save re-uploads every artifact as `application/octet-stream` (`ProjectsUpdateService.buildFormData` in `apps/chat-api/src/projects/update/projects-update.service.ts`).

This is issue #9688, a follow-up to #9621 (project view page) and #9681 (live updates). It builds on the #9681 branch, which is not merged yet.

## What Changes

**1. BFF: list and download a project's outputs**

- New `GET /api/v1/projects/:id/artifacts` (`listProjectArtifacts`) returns `{ items: [{ name, updatedAt?, author? }] }`:
  - the files directly under `artifacts/`, newest first by `updatedAt`, then by name;
  - read with DIAL Core's `listProjectFileMetadata(bucket, path, 'artifacts/', { recursive: false })`, paged until done, following `ProjectConversationsListService.listFiles` (`apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`);
  - a project without an `artifacts/` folder lists none;
  - nested paths are not listed.
- New `GET /api/v1/projects/:id/artifacts/:fileName` (`downloadProjectArtifact`, used through `downloadProjectArtifactRaw`) streams one artifact as an attachment with `nosniff`. It reuses `ProjectsDownloadService.download` and the `IsDialEntityName` + traversal checks of `/:id/files/:fileName`.
- Any reader of the project may call both, behind the existing `FeatureGuard` (`FeatureKey.ProjectsEnabled`). DIAL Core authorizes each call with the caller's token.
- **Departure from the issue.** The issue adds `artifactFiles` to `ProjectDetailsDto`. That field is not added. Newest-first order needs Core's file metadata, which the archive snapshot does not carry (see design D1). `GET /api/v1/projects/:id` does not change.

**2. BFF: artifacts no longer block or damage an edit**

- `ProjectSnapshot` gains `artifactEntries`: every path under `artifacts/`, nested paths included. These entries are:
  - left out of `contentVersion`, as `conversationEntries` already are;
  - never inflated on a read.
- `PUT /api/v1/projects/:id` carries every artifact entry through unchanged: same bytes, same path. Its content type is inferred from the extension with `mime-types`' `lookup` (already a `chat-api` dependency), and falls back to `application/octet-stream`.
  - The issue names `inferMimeTypeFromPath`. That function lives in `@epam/ai-dial-chat-shared`, which a `type:backend` project may not import (`eslint.config.mjs`).
- An artifact written during an edit therefore changes only Core's ETag. The save's existing `412` retry re-reads the snapshot, finds the same `contentVersion`, and writes again with the new artifact included.

**3. UI: an Outputs section on the project view page**

- New presentational `ProjectOutputs` in `libs/projects`:
  - a heading "Outputs" (`dial-body-semi-text`) and a row of 100×100 `AttachmentCard`s from `@epam/ai-dial-attachment-input`, the same cards as the Details panel's context files;
  - the first `previewLimit` cards (default `6`) show in one row that scrolls horizontally inside the column;
  - when more exist, "See all (N)" expands the section in place into a wrapping grid of every output, and "Show less" collapses it again;
  - it renders nothing when there are no outputs.
- `ProjectConversationsPanel` gains an `outputs?: ReactNode` slot between `composer` and the Chats list. `ProjectConversationsSection` passes `ProjectOutputs` into it.
- The data comes from a new headless `useProjectArtifacts(client, projectId)` hook in `libs/chat-hooks/src/project/`, with an app adapter `apps/chat/src/hooks/projects/useProjectArtifacts.ts`. `ProjectViewPage` owns it, as it owns `useProjectConversations`.
- **Activating a card opens the attachment canvas**, as a context file card does on the same page. The issue says "download". This change follows the current context-card behaviour instead, as the user decided; the canvas offers the download.
  - The card's attachment gets the locator `{projectId}/files/artifacts/{name}`.
  - `resolveDialUrl` (`apps/chat/src/utils/dial-file.ts`) resolves that locator to the new download route.
- **Live updates:** an artifact write is a project write. The #9681 watch (`useProjectWatch`) already refreshes the page on the new ETag, and its `onChange` now also refreshes the outputs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-detail-api`: two new routes (list and download artifacts) in the per-project route table. The snapshot classifies `artifacts/` and leaves it out of `contentVersion`. `PUT` carries artifacts with an extension-inferred content type.
- `project-view-ui`: the `ProjectOutputs` component, the `useProjectArtifacts` state owned by `ProjectViewPage`, opening an output in the canvas, and the new strings.
- `project-conversations-ui`: the main column renders the Outputs section between the chat input and the Chats list, through `ProjectConversationsPanel`'s new `outputs` slot.
- `project-view-live-updates`: the watch's `onChange` also refreshes the outputs.

## Non-goals

- Renaming, deleting or uploading artifacts from the chat app, on the view page or the edit page. The chat only reads `artifacts/`.
- Writing to `artifacts/`: only the agents do that.
- Listing nested paths under `artifacts/`. They are kept on save, but not shown.
- A "See all" that opens `artifacts/` in the file storage. `DialFileManagerPage` browses only the user's `files/` bucket and cannot address a `projects/…` resource. The in-place expansion replaces it (design D4).
- Showing outputs on the edit page, or in the project archive download description.
- Storage limits specific to artifacts. Artifacts count towards DIAL Core's per-project limits like any other file. `PROJECT_CONTEXT_TOTAL_MAX_BYTES` still counts context files only.

## Alternatives considered

- **`artifactFiles` in `ProjectDetailsDto` from the snapshot, sorted by name** (the issue's shape). It needs no extra Core call, but it cannot sort newest first, which the user chose. Rejected.
- **The same field, with `updatedAt` merged from a parallel `listProjectFileMetadata` call inside `getProject`.** It adds a Core call to every details read: the edit page and every live refresh included. It also mixes a snapshot read with a later listing that may not match it. Rejected in favour of a separate endpoint that only the view page calls.
- **Download on click** (the issue's wording). It is simpler, but the two card rows on the same page would then behave differently. Rejected, as the user decided.

## Acceptance criteria

- Between the chat input and the Chats list, on desktop and mobile, the section lists the direct children of `artifacts/`, newest first. It is absent when there are none.
- At most 6 cards show until "See all (N)" is activated. "Show less" restores the row.
- The section offers no rename, delete or upload action.
- Cards show the name and the type icon, open the file in the canvas (where it can be downloaded), and have accessible names.
- An artifact write does not change `contentVersion`, so an open edit still saves. An edit keeps every artifact's bytes and path, and stores it with its extension's content type.
- The download route rejects path traversal and works for every reader of the project.
- A new artifact appears on an open view page without a reload.
- At 320 px there is no horizontal page scroll; only the card row scrolls. RTL uses logical properties.
- New strings go through `ProjectOutputsLabels` in `libs/projects` and `projects.outputs.*` keys in the app.
- The `project-detail-api`, `project-view-ui`, `project-conversations-ui` and `project-view-live-updates` specs, `apps/chat-api/README.md` and `libs/projects/README.md` are updated. `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass.

## Impact

- **Backend** (`apps/chat-api/src/projects/`):
  - `snapshot/projects-snapshot.service.ts` and `update/projects-update.service.ts`;
  - a new `artifacts/projects-artifacts-list.service.ts`;
  - `download/projects-download.service.ts` gains `downloadArtifact`;
  - `projects.controller.ts` gains two handlers;
  - new DTOs: `ProjectArtifactParamDto`, `ProjectArtifactListResponseDto` and `ProjectArtifactItemDto`.
- **Generated client:** `libs/chat-api-client` is regenerated, adding `listProjectArtifacts`, `downloadProjectArtifactRaw` and the new DTOs.
- **Hooks:** `libs/chat-hooks/src/project/` gains `use-project-artifacts.ts`, a `listProjectArtifacts` entry in `ProjectsApiClient`, and `mapProjectArtifactsToOutputs` in `project-mapping.ts`.
- **Projects lib** (`libs/projects`):
  - the new `ProjectOutputs` component and its models;
  - the `outputs` slot on `ProjectConversationsPanel`;
  - README.
- **App** (`apps/chat`):
  - `ProjectViewPage`, `ProjectConversationsSection`, `utils/dial-file.ts` and `utils/project-file-preview.ts`;
  - a new `hooks/projects/useProjectArtifacts.ts` and `hooks/projects/useProjectOutputsLabels.ts`;
  - `translation-keys.ts` and `en.json`.
- **Library isolation:** `libs/projects` gets only props: items, the open callback, the selected name, labels and styles. Endpoint paths, the locator scheme and the client stay in `apps/chat`. `libs/chat-hooks` takes the configured client as a parameter.
- **i18n:** three new keys: `projects.outputs.title`, `projects.outputs.seeAll` and `projects.outputs.error`. It reuses `buttons.showLess`, `buttons.retry` and `projects.view.openFile`.
- **Compatibility and rollback:** the change is additive. `contentVersion` changes value once for every project that already has artifacts, so a client still holding a version read before the deploy gets one `409 project-changed` and reloads. Reverting the change restores the old version rule and drops the section and the two routes. No data migrates.

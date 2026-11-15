# add-project-unpublish — design

## Context

- **Backend is done.** `CatalogEntityType.Project` (`apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts`) makes `PublishController`'s `unpublish`, `getCatalogUnpublishAccess` and publish-history routes accept projects. `PublishService.canUnpublish` allows an administrator, the owner of an own-bucket id, or the publisher of a public copy; anything else gets 403. History is cached 60 s per entity and dropped on publish/unpublish; access is cached 60 s per caller.
- **Client wrappers exist.** `apps/chat/src/server-api/publish.api.ts` exports `unpublishCatalogEntity`, `getCatalogUnpublishAccess` and `getCatalogPublishHistory`, bound from `createPublishApiClient` (`libs/chat-hooks/src/catalog/create-publish-api.ts`).
- **The project page** (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) passes `onPublish` when `project.canManage` and mounts `PublishProjectPanelContainer` on first open. `ProjectView` (`libs/projects`) renders Publish as a desktop button plus the first mobile menu item.
- **Prior art.** The catalog decides visibility in `useCatalogPublishing` (synthesised folder for public copies, access lookup for non-admins). The conversation panel confirms in a `ConfirmationDialog` with a `RadioGroup` (`ConversationPanelOverlays.tsx`) driven by `useAsyncConfirmDialog` (`libs/chat-hooks/src/conversation/useAsyncConfirmDialog/useAsyncConfirmDialog.ts`).

## Goals / Non-Goals

**Goals:** owner and publisher/admin can request removal of a published project from its view page; behaviour, copy shape and error handling match the catalog and conversation flows; no flicker.

**Non-Goals:** backend/OpenAPI changes; sidebar pinned-project menu and projects list; republish-to-second-folder; showing a pending removal.

## Decisions

### D1. The lib takes a callback, nothing else

`ProjectView` gets `onUnpublish?: () => void` and `labels.unpublishLabel?: string` (default `'Unpublish'`). Presence of `onUnpublish` is the whole contract: it renders the action and suppresses Publish. History, ownership, admin status, entity types and endpoints stay in `apps/chat`. No `isPublished`/`isPublishPending` props — the host already controls Publish by omitting `onPublish`, so a second flag could only contradict the callbacks (the spec already forbids that for read-only mode).

*Alternative:* catalog-style `publishedFolders` + `onUnpublish(folder)` in the lib. Rejected: the folder choice happens in an app dialog, so the lib would carry data it never renders.

### D2. The decision lives in chat-hooks; the app keeps the dialog and toasts

Who may unpublish, and from which folders, is pure logic over DIAL Core publish data: no routing, i18n, storage or app context. `apps.md` ("Write it there from the start") puts that in `libs/chat-hooks`, and the `chat-hooks` exception in `AGENTS.md` lets it call generated-client operations through an injected client. So:

- **`libs/chat-hooks/src/catalog/unpublishable-folders.ts`** and **`libs/chat-hooks/src/catalog/useUnpublishableFolders/useUnpublishableFolders.ts`** — `resolveUnpublishableFolders(client, target, isAdmin)` and `useUnpublishableFolders(client, target, isAdmin)`, taking `Pick<PublishApiClient, …>` the way the project hooks take `ProjectsApiClient`. Generic over the entity type (`target = { entityType, entityId, isOwner }`), and `useCatalogPublishing` resolves its public-copy branch through it too.
- **Under `./catalog`, not `./project`** — it reuses `catalog/publish.ts`, whose types reference `@epam/ai-dial-publish-panel`; placing it under `./project` would add that peer to the `./project` entry point. `./catalog` already carries it.
- **`libs/chat-hooks/src/catalog/useUnpublishConfirmation/useUnpublishConfirmation.ts`** — `useUnpublishConfirmation(runUnpublish)`, the confirmation state over `useAsyncConfirmDialog`: the pending entity, the folder pick, the close guard while the request runs and the folder resolution (the public root `''` is sent; a pick not among the folders sends nothing). It returns `dialog` props shaped for `UnpublishConfirmationDialog`. The conversation panel (`useConversationSharingDialogs`) and the project page both use it, replacing two copies of that state.
- **`apps/chat/src/hooks/projects/useProjectUnpublish.ts`** — a thin adapter: `isAdmin` from `useUser()`, `publishApiClient` from `server-api/publish.api.ts`, and a `runUnpublish` that sends the request, raises `useOperationNotification` / `usePublishErrorNotification` and refreshes the publish state.

The owner case uses the real history rather than a synthesised folder, since an owner may have published to several folders and the history marks which are still live.

*Alternative (first iteration):* the whole hook in `apps/chat`, mirroring `useCatalogPublishing`. Rejected in review: the catalog's precedent explains only the app-bound half (`useUser`, toasts), not the decision itself.

### D3. Withhold the slot until settled

While the lookup runs the page passes neither `onPublish` nor `onUnpublish`. The catalog first showed a speculative control and had to remove it (#9500). Cost: on a slow network the Publish button appears a few hundred ms later than today for an owner. Accepted — the history call is one bucket-scoped request, cached 60 s server-side.

A failed lookup settles as no folders: an owner gets Publish back (today's behaviour), a public copy shows nothing. No toast: the user did not ask for history.

### D4. One shared confirmation dialog in `libs/publish-panel`

`UnpublishConfirmationDialog` (`libs/publish-panel/src/components/UnpublishConfirmationDialog/UnpublishConfirmationDialog.tsx`) lifts the body `ConversationPanelOverlays.tsx` rendered inline. It reads no app context, so under `apps.md` "Presentational components belong to libs" it lives in the publish lib, next to the other publish surfaces; `publish-panel` already peers `@epam/ai-dial-chat-shared` (for `ConfirmationDialog`) and the kit, so no peer is added. Every string comes from `UnpublishConfirmationDialogLabels` with an English default (`title`, `confirmLabel`, `cancelLabel`, `rootFolderLabel`, `folderGroupAriaLabel`, `loadingStatusLabel`, `confirmMessage(name, folder)`, `selectFolderMessage(name)`); the option typography is `optionClassName` (default `'dial-small-text'`) and its color `colors.optionText`. The app fills the labels with `useUnpublishConfirmationLabels` (`apps/chat/src/hooks/publish/useUnpublishConfirmationLabels.ts`), passing each surface's own keys.

*Alternative (first iteration):* an app component that called `t()` for the buttons and the root folder name. Rejected in review: those three strings were its only tie to the app.

The conversation panel is migrated in the same change (`apps.md` "Dedupe inside the app too"), with its strings untouched; its existing tests guard the behaviour.

*Alternative:* a project-only dialog. Rejected: a second verbatim copy of the folder rule (including the root-folder `''` vs `undefined` trap the conversation hook documents).

### D5. Refresh points

- After **publish success**: `PublishProjectPanelContainer` gains optional `onPublished`, and the page calls `refreshPublishState()`. The BFF already dropped the history cache in `publish`.
- After **unpublish success**: `refreshPublishState()`. The removal is pending, so the folder stays listed and Unpublish stays — consistent with catalog and conversation.
- On **live-watch content change** (`useProjectWatch` → `handleProjectChanged`): no refresh. Publication state is not part of the project's etag.

### D6. Request shape

`unpublishCatalogEntity({ entityType: Project, entityId: project.id, unpublishCatalogEntityDto: { folderPath } })`, no `version`. The folder is chosen by joined path; `folderPath == null` (not found) aborts, `''` (public root) is sent.

## Risks / Trade-offs

- **Pending publish shows Unpublish.** History includes a `PENDING` `ADD`, so right after a publish request the owner sees Unpublish for a folder the copy has not reached yet. Same as catalog and conversations today; out of scope.
- **Public-copy access check costs one bucket scan** for non-admins on every public project view (cached 60 s per caller). Acceptable; it is the catalog's cost too.
- **Shared dialog refactor** touches the conversation panel. Mitigation: identical props mapping, existing `ConversationPanelView`/overlay tests, plus a dedicated component test.

## Migration / Rollback

Additive; revert the commit. No data, config or API migration.

## Open Questions

- Should the pinned-project sidebar menu (`usePinnedProjectsPanel`) also offer Unpublish? Deferred to a follow-up; it has no per-project history today.

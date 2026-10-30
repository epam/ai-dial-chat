<!--
Slicing strategy: risk-first, then vertical.
- Slices 1–2 prove the two riskiest pieces in isolation: project-file persistence with
  content-hash conflicts, and contentVersion for edits.
- Slice 4 refactors ConversationPage behind a context with no behaviour change, guarded
  by the existing tests, before any project UI depends on it.
- Each later slice is one path through the stack, verified before widening.
Test locations follow this repo's convention: `tests/` folders next to the source
(`apps/chat-api/src/projects/tests/`, `Component/tests/Component.spec.tsx`).
-->

## 1. BFF: locator and project conversation persistence (risk-first)

- [x] 1.1 Add `parseProjectConversationLocator` and `buildProjectConversationLocator` in `apps/chat-api/src/projects/utils/project-conversation-id.util.ts`.
  - Rules: the second-to-last segment is `conversations`, the project part passes `parseProjectId`, and the name passes `isValidDialEntityName`.
  - Add `stripProjectConversationLocator` / `fromStrippedProjectConversationPath` for the completion-body `path`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-conversation-id.util.spec.ts` (round trip, nested path, `..`, a project folder named `conversations`).
- [x] 1.2 Before relying on it, confirm against Core that `If-Match: *` on `PUT /v2/projects/{bucket}/{path}/files/{filePath}` means "any version":
  - read `ProxyUtil.etag` and `EtagHeader` in the local `ai-dial-core` checkout;
  - record the finding in `design.md` Open Questions;
  - if Core reads it otherwise, switch unconditional writes to the fresh aggregate ETag with retry.
  - Verification: the finding is recorded in `design.md`.
- [x] 1.3 Implement `ProjectConversationStore` in `apps/chat-api/src/conversations/persistence/project-conversation.store.ts`:
  - read via `downloadProjectFile` (JSON, `404` → null or `NotFoundException`, non-object → `502`);
  - the `"sha256:{hex}"` version token;
  - `saveConversationIfMatch`: aggregate ETag from `listProjectMetadata`, then re-read, hash check, then `uploadProjectFile` with `If-Match: <aggregate ETag>`, retrying `412` up to `PROJECT_CONVERSATION_WRITE_ATTEMPTS` (5);
  - unconditional save and delete with `If-Match: *`;
  - Core `413` → `project-storage-full`;
  - logs without names or content.
  - Add `ProjectStorageFull = 'project-storage-full'` to `ProjectCreateErrorCode` (`apps/chat-api/src/projects/types/project-create-error-code.enum.ts`).
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/persistence/tests/project-conversation.store.spec.ts` (a write to another file is retried, a real conflict is `isSaved: false`, a shared-bucket read, `413`, `404`).
- [x] 1.4 Route project locators in `apps/chat-api/src/conversations/persistence/conversation-persistence.service.ts`:
  - every public method delegates to the store, including `getConversationWithStoredVersion` and `getStoredConversation`;
  - make `qualifySessionConversationPath` and `resolveConversationLocation` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` return a locator unchanged;
  - register the store in `apps/chat-api/src/conversations/conversation.module.ts`.
  - Verification:
    - `npm run test:file -- apps/chat-api/src/conversations/persistence/tests/conversation-persistence.service.spec.ts` (new routing cases, plus all existing cases unchanged);
    - `npm run test:file -- apps/chat-api/src/conversations/tests/conversation.utils.spec.ts`.
- [x] 1.5 Slice check: `npm run verify:changed`.

## 2. BFF: contentVersion and the snapshot (risk-first)

- [x] 2.1 In `apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`:
  - classify direct `conversations/*` children as `conversationEntries`, never inflated on read;
  - compute `contentVersion` from the central directory (`{path}\t{crc32}\t{size}` of non-conversation entries, sorted, SHA-256, quoted).
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-snapshot.service.spec.ts` (classification, a conversation-only change keeps `contentVersion`, a context change alters it).
- [x] 2.2 Add `contentVersion` and `conversationCount` (with `@ApiProperty`) to `apps/chat-api/src/projects/dto/project-details.dto.ts`, and fill them in `getProject` (`apps/chat-api/src/projects/projects.service.ts`).
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-get.service.spec.ts`.
- [x] 2.3 In `apps/chat-api/src/projects/update/projects-update.service.ts`:
  - compare `If-Match` with `contentVersion`;
  - include `conversationEntries` as `application/json` parts;
  - on Core `412`, re-read and rebuild from the fresh snapshot while `contentVersion` is unchanged, up to `PROJECT_WRITE_ATTEMPTS` (3, in `apps/chat-api/src/projects/constants/project-context.constants.ts`).
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-update.service.spec.ts` (chat during edit succeeds, retry carries the newer bytes, a real edit is `409`, attempts are bounded).
- [x] 2.4 Make `deleteProject` in `apps/chat-api/src/projects/projects.service.ts` take `contentVersion`: snapshot compare, then `deleteProjectFolder` with the fresh ETag, retrying `412` up to `PROJECT_WRITE_ATTEMPTS`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-delete.service.spec.ts`.
- [x] 2.5 Update the `If-Match` descriptions on `updateProject` and `deleteProject` in `apps/chat-api/src/projects/projects.controller.ts` (Swagger `@ApiHeader`), then run `npm run openapi` and `npm run openapi:check`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`.
- [x] 2.6 Switch the app to `contentVersion`:
  - `apps/chat/src/hooks/projects/useSaveProject.ts` and `apps/chat/src/server-api/projects.api.ts` (`updateProject`, `deleteProject`);
  - `apps/chat/src/hooks/projects/useProjectActions.ts`;
  - `apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`.
  - Verification:
    - `npm run test:file -- apps/chat/src/hooks/projects/tests/useSaveProject.spec.ts`
    - `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectActions.spec.ts`
    - `npm run test:file -- apps/chat/src/pages/ProjectEditPage/tests/ProjectEditPage.spec.tsx`
- [x] 2.7 Slice check: `npm run verify:changed`.

## 3. BFF: project conversation endpoints and project context

- [x] 3.1 Add DTOs in `apps/chat-api/src/projects/conversations/dto/`:
  - `project-conversation-param.dto.ts`: `IsDialEntityName`, 255-byte cap;
  - `project-conversation-list-query.dto.ts`: `limit` `1..100`, default 50;
  - `project-conversation-list-response.dto.ts`: `ProjectConversationItemDto`, `ProjectConversationListResponseDto`.

  Use classes with `@ApiProperty` on every field.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-conversation-param.dto.spec.ts` (traversal, control characters, over-long names).
- [x] 3.2 Implement `ProjectConversationsListService` in `apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`:
  - page through `listProjectFileMetadata(…, 'conversations/')`, sort newest first, apply the limit, set `hasMore`;
  - resolve titles through the `projects:conversation-title:{locator}` cache (`{ updatedAt, title }`, 10-minute TTL, at most 4 concurrent reads, file-name fallback);
  - expose an `evict(locator)` helper.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations-list.service.spec.ts` (ordering, cache hit without a read, an empty folder `404` → `[]`).
- [x] 3.3 Implement `ProjectConversationsController` in `apps/chat-api/src/projects/conversations/project-conversations.controller.ts`:
  - `FeatureGuard` and `@RequireFeature(FeatureKey.ProjectsEnabled)`;
  - the owner check before Core on writes and completions;
  - routes: list, create, get, save, rename, delete, `completions`, `completions/stop`, `completions/attach`;
  - each handler delegates to `ConversationService` with the locator;
  - body `path` validation against `:id`;
  - title-cache eviction on writes;
  - `@ApiOperation` / `@ApiResponse` for every status.

  Export `ConversationService` from `apps/chat-api/src/conversations/conversation.module.ts`, and import `ConversationModule` in `apps/chat-api/src/projects/projects.module.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.controller.spec.ts`.
- [x] 3.4 Add supertest integration coverage for the new controller:
  - flag off → `403`;
  - shared-project write → `403` with no Core call;
  - a path outside `:id` → `400`;
  - traversal in `:conversationName` → `400`;
  - create → `201`;
  - stop finds the generation started with the same path.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.integration.spec.ts`.
- [x] 3.5 Add `PROJECT_ID_HEADER` and `buildProjectIdHeaders` to `apps/chat-api/src/common/utils/header-value.ts`. Add an options bag (`extraHeaders`) to `stream` in:
  - `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`;
  - `apps/chat-api/src/conversations/generation/responses.adapter.ts`.

  With no options, the requests are unchanged.
  - Verification:
    - `npm run test:file -- apps/chat-api/src/conversations/generation/responses.adapter.spec.ts`
    - the chat-completions adapter spec next to it
    - `npm run test:file -- apps/chat-api/src/common/utils/tests/header-value.spec.ts`
- [x] 3.6 Send `x-project-id`, derived from the locator by `buildProjectHeadersForPath` in `apps/chat-api/src/conversations/utils/conversation.utils.ts`, from `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` and `apps/chat-api/src/conversations/generation/background-generation.service.ts`, including replay. No system message, no attachment and no project file read are added (the earlier `PROJECT.md` system prefix and context attachments were removed by the user's decision).
  - Verification:
    - `npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts` (a top-level chat is unchanged)
    - `npm run test:file -- apps/chat-api/src/conversations/tests/project-completions.integration.spec.ts` (header only, body equal to a top-level request, no project file read, background replay header)
- [x] 3.7 Confirm that `apps/chat-api/src/rate/rate.service.ts` and its DTO accept a project locator as `conversationId`. Widen the validation only if they reject it.
  - Verification: `npm run test:file -- apps/chat-api/src/rate/tests/rate.service.spec.ts`.
- [x] 3.8 Regenerate the client:
  - `npm run openapi` and `npm run openapi:check`;
  - `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`;
  - confirm that `ProjectsApi` exposes the new operations in `apps/chat/src/server-api/api-client.ts`.
  - Verification: `npm run openapi:check` passes.
- [x] 3.9 Slice check: `npm run verify:changed`.

## 4. App: ConversationDataSourceContext refactor (no behaviour change)

- [x] 4.1 Create `apps/chat/src/context/ConversationDataSourceContext.tsx`:
  - `ThemeContext` pattern;
  - `useConversationDataSource` throws outside the provider;
  - the value is memoised.

  Add `apps/chat/src/utils/regular-conversation-data-source.ts`, which wraps today's calls in `conversations.api.ts`, `conversation-stream-transport.ts` and `ConversationsContext`. Mount the provider in `apps/chat/src/AppRoot.tsx`.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/ConversationDataSourceContext.spec.tsx`.
- [x] 4.2 Move the direct calls in `apps/chat/src/pages/Conversation/Conversation.tsx` behind the data source:
  - load, save, status message, custom-viewer reload;
  - duplicate, deleted and custom-viewer navigation;
  - title watch, read-only, list side effects.

  No other behaviour change.
  - Verification:
    - every spec in `apps/chat/src/pages/Conversation/tests/` passes unchanged
    - `npm run test:file -- apps/chat/src/pages/ConversationRoute/tests/ConversationRoute.spec.tsx`
- [x] 4.3 Slice check: `npm run verify:changed`.

## 5. App: project chat route and page

- [x] 5.1 Add `ROUTES.ProjectChat` to `apps/chat/src/types/routes.ts`. Add `getProjectConversationRoute`, `parseProjectConversationRouteParams` and `isConversationPagePath` to `apps/chat/src/constants/routes.ts`.
  - Verification: `npm run test:file -- apps/chat/src/constants/tests/routes.spec.ts`.
- [x] 5.2 Add the server-api wrappers in `apps/chat/src/server-api/project-conversations.api.ts`, over the generated `ProjectsApi`: list, create, get, save, rename, delete.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/project-conversations.api.spec.ts`.
- [x] 5.3 Implement `createProjectConversationDataSource` in `apps/chat/src/utils/project-conversation-data-source.ts`:
  - `createChatStreamApi` with the project base path;
  - a no-op watch;
  - `watchTitle` with backoff re-reads;
  - project routes;
  - `isReadOnly` from `canEdit`;
  - `listSync: null`;
  - `canDuplicate: false`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/project-conversation-data-source.spec.ts`.
- [x] 5.4 Create `apps/chat/src/pages/ProjectChatPage/ProjectChatPage.tsx`:
  - flag gate;
  - route parse;
  - `useProject`;
  - the provider with a `useMemo` value;
  - the breadcrumb bar with a mirrored back arrow;
  - not-found states.

  Register it lazily in `apps/chat/src/app/app.tsx` inside the `ChatLayout` group.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx` (flag off, a bad route, read-only shared chat, back navigation, a missing conversation exits to the project).
- [x] 5.5 Replace the `/conversations/` prefix checks with `isConversationPagePath` in:
  - `apps/chat/src/context/ClientChannelContext.tsx`
  - `apps/chat/src/components/Header/SourcesSidebarToggle.tsx`
  - `apps/chat/src/context/CelebrationHost.tsx`
  - the sources/attachments gate in `apps/chat/src/app/app.tsx`

  Keep `activeConversationId` derived from `/conversations/` only.
  - Verification: the existing specs of those files, plus a project-chat-route case each.
- [x] 5.6 Slice check: `npm run verify:changed`.

## 6. Lib: ProjectView main column and ProjectConversationList

- [x] 6.1 Add `mainContent` and the optional `mainContentLabel` to `libs/projects/src/models/project-view-props.ts`. Render the `<section>` before the `<aside>` in `libs/projects/src/components/ProjectView/ProjectView.tsx` (stacked above it on `mobile`), using logical properties only.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`.
- [x] 6.2 Create `libs/projects/src/components/ProjectConversationList/ProjectConversationList.tsx` and its models:
  - rows with `InitialsAvatar` and `EllipsisTooltip`;
  - the ⋮ `Dropdown` only when callbacks are given;
  - loading, error and empty (`PanelEmptyState`) states with a `role="status"` region.

  Export it from `libs/projects/src/index.ts`.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectConversationList/tests/ProjectConversationList.spec.tsx` (read-only has no menu, empty state, Enter opens, accessible names).
- [x] 6.3 Architecture guard: confirm `libs/projects/src` contains no `/api` path, `@epam/ai-dial-chat-api-client` or server-api import, app context, feature flag, router, i18n, storage or analytics. Run `npm exec nx lint projects`.
  - Verification: the lint passes, and a search of `libs/projects/src` for those terms finds nothing.

## 7. App: project view main column

- [x] 7.1 Add `ComposerLayout.Embedded` in `apps/chat/src/types/conversation-composer.ts`, and support it in `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`: no greeting, normal flow.
  - Verification: `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`.
- [x] 7.2 Create `apps/chat/src/hooks/projects/useProjectConversations.ts` (load, retry, rename, remove; `AbortController` cleanup; JSDoc explaining why) and `apps/chat/src/hooks/projects/useProjectConversationListLabels.ts`.
  - Verification:
    - `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectConversations.spec.ts`
    - `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectConversationListLabels.spec.ts`
- [x] 7.3 Create `apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`:
  - the embedded composer, only when `canEdit`, with `restoreDefaultSelection` on mount;
  - first message → create, save, navigate with `state.conversation`;
  - the list;
  - the rename `Popup` and the delete `DeleteConfirmationDialog`, both with focus return;
  - toasts.

  Pass it as `mainContent` from `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`.
  - Verification:
    - `npm run test:file -- apps/chat/src/components/ProjectConversationsSection/tests/ProjectConversationsSection.spec.tsx` (first message navigates, read-only, rename, delete, storage-full error, empty state)
    - `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`
- [x] 7.4 Add `conversationCount` to the delete confirmation in `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx` (the pluralised body) and to the chats warning in `apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx` (a kit `Notification` through `renderSummary`).
  - Verification: `npm run test:file -- apps/chat/src/components/PublishProjectPanelContainer/tests/PublishProjectPanelContainer.spec.tsx`.
- [x] 7.5 Slice check: `npm run verify:changed`.

## 8. i18n, RTL and a11y

- [x] 8.1 Add every key listed in the `project-conversations-ui` spec to `apps/chat/src/i18n/locales/en.json`, and the matching members to `ProjectsI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, with `_one`/`_other` plurals.
  - Verification: `npm run test:file -- apps/chat/src/i18n/tests/config.spec.ts`.
- [x] 8.2 RTL pass over the new UI:
  - `ProjectConversationList`, the `ProjectView` main column, `ProjectChatPage`'s breadcrumb and `ProjectConversationsSection` use only logical classes (`ms`/`me`, `ps`/`pe`, `start`/`end`, `border-s`);
  - the back arrow has `rtl:scale-x-[-1]`, and the ⋮ icon is not mirrored.

  Add a `dir="rtl"` render case to the specs.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectConversationList/tests/ProjectConversationList.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx`.
- [x] 8.3 a11y pass:
  - `stroke={DIAL_KIT_ICON_STROKE}` on every Tabler icon;
  - labelled dialogs with focus return;
  - row names include the author;
  - `role="status"` for list states;
  - contrast fallbacks at least 7:1.

  Cover these with role and label queries in the specs above.
  - Verification: the same spec files.

## 9. Docs and specs

- [x] 9.1 Update `docs/architecture.md`:
  - the `ROUTES.ProjectChat` route;
  - the `/api/v1/projects/:id/conversations…` endpoints;
  - `ConversationDataSourceContext`;
  - project conversation persistence routing;
  - the `x-project-id` header, which Core forwards to the deployment on Chat Completions and Responses.
- [x] 9.2 Update `apps/chat-api/README.md` (new endpoints, `contentVersion` in `If-Match`) and `libs/projects/README.md` (`mainContent`, `ProjectConversationList` with a compiling example).
- [x] 9.3 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`, and fix what they report.
  - Verification: all three pass.

## 10. Close

- [x] 10.1 Run `npm run build:quiet`: lazy routes, the lib export and the generated client affect bundling.
- [x] 10.2 Run exactly one `npm run verify:full`.

## 11. Reusable libs (design D10)

- [x] 11.1 Add `libs/chat-hooks/src/project/` and the `@epam/ai-dial-chat-hooks/project` entry point: `createProjectsApiClient`, the data hooks taking the client first, `useProjectActions` with host handlers, the DTO mappers, limit helpers and `getProjectFormError`. Register the entry (package `exports`, Vite entry and alias, the `@epam/ai-dial-projects` optional peer, tsconfig reference) and cover it in `libs/chat-hooks/src/project/tests/`.
- [x] 11.2 Add `ProjectConversationsPanel` and `ProjectChatHeader` to `libs/projects` with specs, and export them.
- [x] 11.3 Switch `apps/chat` to them: one-line hook adapters over `apps/chat/src/hooks/projects/projects-client.ts`, the server-api modules over `createProjectsApiClient`, `ProjectConversationsSection` and `ProjectChatPage` over the lib components; remove the app's `map-project-dto` and `project-limits`.
- [x] 11.4 Docs: both lib READMEs, `AGENTS.md` and `docs/architecture.md` (the `chat-hooks` → feature-lib list), `docs/projects-reuse.md` indexed in `dial-docs`, and the regenerated `docs/host-install-matrix.md`.
- [x] 11.5 Run `npm run build:quiet` and exactly one `npm run verify:full`.

## Follow-ups (out of scope, record only)

- [ ] F.1 Core feature request: a cheaper per-file write for complex resources (no full-version copy), and sizes in `listFiles` metadata, so the view can stop reading the archive.
- [ ] F.2 Core: confirm resource subscriptions for files inside a complex resource, then add watch and live title updates for project chats.
- [ ] F.3 Refactor: switch the persistence consumers to `@Inject(CONVERSATION_PERSISTENCE)` once the port covers `getConversationWithStoredVersion`.

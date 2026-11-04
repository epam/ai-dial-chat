**Slicing strategy: contract-first, then vertical.**

- Slice 1 fixes the read-state data model and the OpenAPI contract, so the BFF and frontend work against generated types.
- Slices 2–3 deliver live updates end to end (they need no BFF change).
- Slices 4–6 deliver unread end to end.
- Slice 7 is docs and the final gate.

Each slice ends with `npm run verify:changed`, and the change closes with exactly one `npm run verify:full`. Read `apps/chat-api/AGENTS.md` before slices 1 and 4, and `.claude/rules/libs.md` plus `.claude/rules/lib-styling.md` before slices 2, 3 and 5.

**Architecture guard for every task touching `libs/*`:**

- `libs/projects` gains no `/api` path, no `@epam/ai-dial-chat-api-client` import, no `react-i18next`, router, flag, app context or storage.
- `libs/chat-hooks` only calls the injected `ProjectsApiClient`. It never constructs a client, reads a route, shows a toast or navigates.

## 1. Read-state model and endpoint contract (BFF)

- [x] 1.1 Extend `ViewedConversations` in `apps/chat-api/src/scheduled-task-unread/dto/viewed-conversations.dto.ts`:
  - add `projectConversationIds: Record<string, Record<string, string>>`, and add it to `DEFAULT_VIEWED_CONVERSATIONS`;
  - in `parseViewedConversations`, read a missing or non-object field as `{}`, drop non-object project entries and non-string versions, and keep the rest.
  - **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-task-unread/tests/conversation-read-state.service.spec.ts`. Add parse cases for a missing field, a malformed entry and a mixed-valid map.
- [x] 1.2 Add the project methods to `ConversationReadStateService` (`apps/chat-api/src/scheduled-task-unread/conversation-read-state.service.ts`), per design D3:
  - `getProjectReadState` (fail closed, creates the baseline lazily);
  - `markProjectConversationViewed` (no upload when equal);
  - `removeProjectConversation`;
  - `removeProject`;
  - `renameProject` (re-key, rewrite the prefix, merge);
  - the pure `isProjectConversationUnread`.

  Empty project maps are removed. `addViewed` / `removeViewed` keep `projectConversationIds`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-task-unread/tests/conversation-read-state.service.spec.ts`. Cover each method, the no-op writes, the regular write keeping project state, and the fail-closed read.
- [x] 1.3 Add `isUnread!: boolean` (`@ApiProperty`, `@IsBoolean`, with an example) to `ProjectConversationItemDto` in `apps/chat-api/src/projects/conversations/dto/project-conversation-list-response.dto.ts`.
- [x] 1.4 Add the `markProjectConversationViewed` handler to `apps/chat-api/src/projects/conversations/project-conversations.controller.ts`:
  - `@Patch(':id/conversations/:conversationName/viewed')`, `@HttpCode(204)`, `ProjectConversationParamDto`;
  - `@ApiOperation({ operationId: 'markProjectConversationViewed' })`, `@ApiParam` for both params, `@ApiDialCoreErrors()`, and `@ApiResponse` for 204, 400, 401, 403, 404, 502 and 503.

  At this step it only delegates to a `ProjectConversationsService.markViewed` stub, which slice 4 implements.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.controller.spec.ts`
- [x] 1.5 Regenerate the client: run `npm run openapi` and then `npm run openapi:check`. Check that `libs/chat-api-client/openapi.json` has the strongly typed `isUnread` and `markProjectConversationViewed`. Then run `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.
- [x] 1.6 Run `npm run verify:changed`.

## 2. Shared watch helper and useProjectWatch (libs/chat-hooks)

- [x] 2.1 Keep `etag` (when it is a string) in `ProjectWatchEvent` / `parseProjectWatchEvent` (`libs/chat-hooks/src/project/project-events.ts`).
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-events.spec.ts`
- [x] 2.2 Extract the connect / read / backoff / unavailable loop of `useProjects` into the internal `runProjectWatch` (`libs/chat-hooks/src/project/project-watch-stream.ts`). Do not export it from the entry points. Switch `useProjects` to it with no behaviour change.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/use-projects.spec.ts` (unchanged and green), plus a new `libs/chat-hooks/src/project/tests/project-watch-stream.spec.ts` covering the backoff, `onReconnected`, the first-open failure and abort.
- [x] 2.3 Add `useProjectWatch` (`libs/chat-hooks/src/project/use-project-watch.ts`):
  - options kept in refs;
  - the open waits for a loaded `etag`;
  - id filter and etag skip;
  - the coalescing gate (one in flight plus one trailing), also used by `onReconnected`;
  - `DELETE` → abort and call `onDelete` once;
  - cleanup on unmount and on an id change.

  Export it, with its `ProjectWatchOptions` type, from `libs/chat-hooks/src/entry-points/project.ts`. Add JSDoc on why it exists.
  - **Verification:** a new `npm run test:file -- libs/chat-hooks/src/project/tests/use-project-watch.spec.ts`, covering:
    - a refresh on `UPDATE`;
    - the skip on an equal etag;
    - five events during one refresh giving one trailing refresh;
    - `DELETE` calling `onDelete` once and then nothing else;
    - a reconnect refreshing once;
    - an unavailable watch never retrying;
    - abort on unmount and on an id change;
    - new callbacks not resubscribing.
- [x] 2.4 Add `refresh()` returning `ProjectRefreshOutcome` (a string enum in a new `libs/chat-hooks/src/project/project-refresh.ts`, exported) to `useProject` (`libs/chat-hooks/src/project/use-project.ts`). It is silent, keeps the data on failure, resolves `NotFound` on `404`, aborts older refreshes, and leaves `isLoading` untouched.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks.spec.ts`
- [x] 2.5 Run `npm run verify:changed`.

## 3. Live updates on ProjectViewPage (app)

- [x] 3.1 Add `refresh()` to `useProjectConversations` (`libs/chat-hooks/src/project/use-project-conversations.ts`):
  - covers the loaded rows in pages of at most 100;
  - silent, keeps the rows on failure;
  - aborts a `loadMore` in flight, and is aborted by a newer refresh, a retry or a project change.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks.spec.ts`. Cover the 120-row two-page refresh, a new row appearing, the failure keeping the rows, and `loadMore` racing a refresh.
- [x] 3.2 Lift `useProjectConversations(projectId)` from `ProjectConversationsSection` (`apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`) to `ProjectViewPage`, and pass it as the new `conversations` prop. Close a rename or delete dialog whose row a refresh removed.
  - **Verification:** `npm run test:file -- apps/chat/src/components/ProjectConversationsSection/tests/ProjectConversationsSection.spec.tsx`
- [x] 3.3 Wire `useProjectWatch` in `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`):
  - `etag: project?.etag`;
  - `onChange` (a memoised `useCallback`) runs both refreshes, and on `ProjectRefreshOutcome.NotFound` it goes down the delete path;
  - `onDelete` (memoised) is ignored while the page's own delete runs or after it succeeded. Otherwise it calls `showInfoNotification(t(ProjectsI18nKeys.ViewDeletedElsewhere))`, `replacePinnedProjectId(id, null)` and `navigate(ROUTES.Projects, { replace: true })`.

  Reset the deleted-chats counter when `project` refreshes; it is already keyed by the `project` identity.
  - **Verification:** `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`, covering:
    - an `UPDATE` refreshing details and chats without a spinner;
    - the search query kept;
    - the equal-etag skip;
    - `DELETE` → toast and `/projects`;
    - the own delete giving a single toast;
    - a refresh `404` → leave;
    - the watch aborted on unmount.
- [x] 3.4 i18n: add `projects.view.deletedElsewhere` ("This project was deleted") to `apps/chat/src/i18n/locales/en.json` and every other locale file (English placeholder). Add `ProjectsI18nKeys.ViewDeletedElsewhere` to `apps/chat/src/constants/translation-keys.ts`.
  - **Verification:** the `ProjectViewPage.spec.tsx` toast assertion, and `npm exec nx lint chat`.
- [x] 3.5 Run `npm run verify:changed`.

## 4. Unread in the BFF list, viewed endpoint and cleanup

- [x] 4.1 Extend `ProjectConversationsListService` (`apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`):
  - read `getProjectReadState` in parallel with `listFiles`;
  - add `version` to `CachedTitle`, filled from `readConversationWithEtag(...).etag`; a cache hit supplies it;
  - compute `isUnread` with `isProjectConversationUnread`;
  - an unknown version or a `null` state gives `false`.

  Inject `ConversationReadStateService`, and add `ScheduledTaskUnreadModule` to `ProjectsModule.imports` (`apps/chat-api/src/projects/projects.module.ts`).
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations-list.service.spec.ts`, covering an unread item, a read-at-current-version item, a pre-baseline item, a cache hit with no body read, a failed title read, and the fail-closed state.
- [x] 4.2 Implement `ProjectConversationsService.markViewed(project, name, at, bucket)` (`apps/chat-api/src/projects/conversations/project-conversations.service.ts`): `readConversationWithEtag` → `null` is `NotFoundException`; otherwise `markProjectConversationViewed`. It is not owner-gated. Logs carry the outcome only.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.controller.spec.ts`
- [x] 4.3 Cleanup in `ProjectConversationsService`, best effort with a `warn` on failure:
  - delete → `removeProjectConversation`;
  - title rename → compute "was read" first, then store the new hash after the save.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.controller.spec.ts`. Add service-level cases there or in a new `apps/chat-api/src/projects/tests/project-conversations.service.spec.ts`.
- [x] 4.4 Project delete and rename cleanup, best effort:
  - `ProjectsService.deleteProject` (`apps/chat-api/src/projects/projects.service.ts`) → `removeProject` after `removePinQuietly`;
  - `ProjectsUpdateService.updateProject` (`apps/chat-api/src/projects/update/projects-update.service.ts`) → `renameProject` after `migratePinQuietly`, only on a successful move.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects-delete.service.spec.ts` and `npm run test:file -- apps/chat-api/src/projects/tests/projects-update.service.spec.ts`. Cover the success path and a read-state failure that does not fail the request.
- [x] 4.5 supertest integration for the new route and the list field, in `apps/chat-api/src/projects/tests/project-conversations.integration.spec.ts`:
  - `PATCH …/viewed`: `204`, `404`, `400` on `..%2F` traversal and on an invalid `id`, `403` with the flag off;
  - `GET …/conversations` items carry `isUnread`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.integration.spec.ts`
- [x] 4.6 Run `npm run verify:changed`, and also `npm exec nx build chat-api`, since Nest module wiring changed.

## 5. Unread UI in libs/projects

- [x] 5.1 Extend the `ProjectConversationList` models (`libs/projects/src/models/project-conversation-list-props.ts`):
  - `ProjectConversationListItem.isUnread?: boolean`;
  - `ProjectConversationListLabels.unreadLabel?: string`;
  - `ProjectConversationListTypography.unreadRowTitleClassName?: string`;
  - a new `ProjectConversationListColors { unreadDot?: string }` and a `colors?` prop.

  JSDoc every field with its default.
- [x] 5.2 Render unread rows in `ProjectConversationList.tsx`, per the `project-conversations-ui` delta:
  - semibold title class;
  - `aria-hidden` dot hidden while the row is hovered or focused or its menu is open;
  - `aria-describedby` → a visually hidden `unreadLabel`;
  - logical properties only (`me-*`, `ms-*`), and no new icons, so nothing is mirrored.

  Add `ProjectConversationList.module.scss` with `.unreadDot { background: var(--pcl-unread-dot, var(--text-accent, #1d4ed8)); }`, and apply `colors` with `buildCssVars` from `@epam/ai-dial-chat-shared`. Confirm the lib's `./styles.css` export picks up the new stylesheet.
  - **Verification:** `npm run test:file -- libs/projects/src/components/ProjectConversationList/tests/ProjectConversationList.spec.tsx`. Use role and description queries to cover the unread description, the read row having none, the title class, and focus staying when a row turns unread.
- [x] 5.3 RTL check: in the same spec, render under `dir="rtl"` and assert the dot sits on the inline end (the `me-*` / `ms-*` classes, no `ml-*` / `mr-*`). Run the `lib-theming` audit and the `i18n-strings` audit on `libs/projects`.
- [x] 5.4 Run `npm run verify:changed`.

## 6. Marking read on the frontend

- [x] 6.1 Add the pure `createSerializedKeyedWriter` (`libs/chat-hooks/src/shared/serialized-writer.ts`): serial, deduplicated, with `drop(id)`, and a failure rejects only its caller. Export it from the entry point that `projects-client.ts` already imports.
  - **Verification:** a new `npm run test:file -- libs/chat-hooks/src/shared/tests/serialized-writer.spec.ts`
- [x] 6.2 Client plumbing:
  - add `markProjectConversationViewed` to `ProjectsConfiguredClient`, `ProjectsApiClient` (optional) and `createProjectsApiClient` (`libs/chat-hooks/src/project/projects-api-client.ts`);
  - add a `markProjectConversationViewed(conversationId)` wrapper over the generated `projectsApi.markProjectConversationViewed` in `apps/chat/src/server-api/project-conversations.api.ts`;
  - in `apps/chat/src/hooks/projects/projects-client.ts`, forward it through one module-level writer and export that writer for the data source;
  - confirm that `apps/chat/src/server-api/api-client.ts` already exposes `projectsApi`, and add nothing new there.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/projects-api-client.spec.ts` and `npm run test:file -- apps/chat/src/server-api/tests/project-conversations.api.spec.ts`
- [x] 6.3 `useProjectConversations` (`libs/chat-hooks/src/project/use-project-conversations.ts`):
  - map `isUnread` in `toListItems`;
  - add `markViewed(id)`: optimistic `isUnread: false`, a fire-and-forget client call, the failure swallowed, and an `{ id → updatedAt }` memo applied to refresh results.

  `ProjectConversationsSection`'s `onOpen` calls it before navigating, and its labels pass `unreadLabel: t(ConversationPanelI18nKeys.UnreadIndicatorLabel)` through `useProjectConversationsPanelLabels`.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks.spec.ts` and `npm run test:file -- apps/chat/src/components/ProjectConversationsSection/tests/ProjectConversationsSection.spec.tsx`. Cover the optimistic clear, a stale refresh not restoring the dot, a newer version restoring it, and the unread row label coming from i18n.
- [x] 6.4 Chat page marking:
  - add the optional `shouldMarkOpenChatViewed?: boolean` to `ConversationListSync` (`apps/chat/src/models/conversation-data-source.ts`);
  - set it in the project `listSync` of `apps/chat/src/utils/project-conversation-data-source.ts`, with `markViewed` → the writer's enqueue and `markUnread` → `drop`;
  - in `apps/chat/src/pages/Conversation/Conversation.tsx`, OR it into `isOpenChatUnread`.
  - **Verification:**
    - `npm run test:file -- apps/chat/src/utils/tests/project-conversation-data-source.spec.ts`;
    - `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` ("read state without a sidebar row"), covering a mark on load when idle, no mark while streaming, a mark when the stream ends, no mark when leaving mid-stream, and the queued write dropped on a new generation. `ProjectChatPage.spec.tsx` mocks `ConversationPage`, so the behaviour is proven where it lives;
    - `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`, where the regular read-state cases stay unchanged and green.
- [x] 6.5 Live unread: in `ProjectViewPage.spec.tsx`, assert that an `UPDATE` whose refreshed list reports `isUnread: true` makes that row unread without a reload.
  - **Verification:** `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`
- [x] 6.6 Run `npm run verify:changed`.

## 7. Docs, specs and the final gate

- [x] 7.1 `docs/architecture.md`: add the new endpoint `PATCH /api/v1/projects/:id/conversations/:conversationName/viewed`, the project read state in `.viewed-conversations.json`, and the view page's use of the watch stream. Run the `dial-docs` skill first to confirm no other doc owns this.
- [x] 7.2 `apps/chat-api/README.md`: document the endpoint and the `isUnread` field.
- [x] 7.3 `libs/chat-hooks/README.md`: document `useProjectWatch`, `ProjectWatchOptions`, `ProjectRefreshOutcome`, `useProject().refresh`, `useProjectConversations().refresh` / `markViewed`, `createSerializedKeyedWriter` (if exported) and `ProjectsApiClient.markProjectConversationViewed`, each with a minimal example that compiles.
- [x] 7.4 `libs/projects/README.md`: document the `ProjectConversationListItem.isUnread`, `labels.unreadLabel`, `typography.unreadRowTitleClassName` and `colors.unreadDot` / `--pcl-unread-dot` defaults, and the `ProjectConversationListColors` type.
- [x] 7.5 Run `npm run validate:docs` and `npm run validate:specs`. Fix any path or key the delta specs cite.
- [x] 7.6 Run the `code-review-and-quality` five-axis review on the branch diff.
- [ ] 7.7 Run `npm run verify:full` once.
  - **Run on 2026-11-02:** `typecheck:full` and `lint` (all projects) pass. `format:check` fails only on `libs/celebrations/src/stories/fixtures/pack-scene.lottie.json`, which came from `development` (ea551c707) and is untouched here. Because of that, `test:full:quiet` was run on its own and passed; `nx build chat` and `nx build chat-api` pass too.

## 8. Follow-ups (out of scope, record only)

- [ ] 8.1 Open a DIAL Core issue: preserve `updatedAt` / `author` on a project move or copy (design, Open Questions).
- [ ] 8.2 Backlog items:
  - live updates on the project edit page and on the project conversation page;
  - an unread indicator on project cards.
- [ ] 8.3 Prettier-format `libs/celebrations/src/stories/fixtures/pack-scene.lottie.json` (pre-existing on `development`, blocks `format:check`).

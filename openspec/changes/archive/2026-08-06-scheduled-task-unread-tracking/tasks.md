## 1. Backend: viewed-ids bucket storage

- [x] 1.1 Create `apps/chat-api/src/scheduled-task-unread/` domain folder
- [x] 1.2 Add `dto/viewed-scheduled-task-conversations.dto.ts` — `ViewedScheduledTaskConversations` interface (`version: 1`, `conversationIds: string[]`), `DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS` constant, and a `parseViewedScheduledTaskConversations(raw: unknown)` defensive parser (non-array/invalid → default), mirroring `migrateConfig` in `user-config.dto.ts`
- [x] 1.3 Add `scheduled-task-unread.service.ts` with `VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH = '.client_data/.viewed-scheduled-task-conversations.json'`, `getViewedIds(token, bucket): Promise<string[]>`, and `markViewed(conversationId, token, bucket): Promise<void>`, using `DialClientService.client.downloadFile`/`uploadFile` + `getBearerAuthHeaders` + `handleDialSdkError`, following `UserConfigService`'s read/write pattern (FormData/Blob body on write, non-ok/error → safe default on read)
- [x] 1.4 Add `scheduled-task-unread.module.ts` exporting `ScheduledTaskUnreadService`; import `DialModule` (or equivalent providing `DialClientService`)
- [x] 1.5 Write `scheduled-task-unread.service.spec.ts` covering: missing file → `[]`; malformed file → `[]` + warning logged; `markViewed` appends new id; `markViewed` on existing id is idempotent (no duplicate)

## 2. Backend: mark-as-viewed endpoint

- [x] 2.1 Add `PATCH /api/v1/conversations/viewed` handler to `apps/chat-api/src/conversations/conversation.controller.ts` — `@Query() query: ConversationPathDto` (same convention as `GET`/`PUT`/rename `PATCH`/`DELETE`), `@HttpCode(204)`, `@ApiTags('conversations')`, `@ApiOperation`/`@ApiResponse` for 204/400/401/502, delegates to `ScheduledTaskUnreadService.markViewed`
- [x] 2.2 Wire `ScheduledTaskUnreadModule` into `ConversationsModule` (or the module hosting `ConversationController`)
- [x] 2.3 Reuse the existing `ConversationPathDto` for query validation (no new path-param DTO needed since this follows the query-param convention, not a URL `:id` segment)
- [x] 2.4 Write `conversation.controller.spec.ts` / e2e coverage: 204 on valid path, 204 again on repeat call (idempotent), 401 without bearer token, 400 when `path` is missing

## 3. Backend: expose isUnread on the conversations list

- [x] 3.1 Add `isUnread?: boolean` to `ConversationListItemDto` in `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`, with `@ApiProperty({ required: false })`
- [x] 3.2 In `ConversationService.listConversations` (`conversation.service.ts`), add `ScheduledTaskUnreadService.getViewedIds(token, bucket)` as a fourth parallel fetch alongside `getPinnedIds`, build a `Set<string>` of viewed ids
- [x] 3.3 In the per-item mapping, when `parseScheduledTaskConversationPath(item.id)` is non-null, set `isUnread: !viewedSet.has(item.id)`; when null, omit `isUnread`
- [x] 3.4 Make the viewed-ids fetch resilient: on failure, log a warning and fall back to `isUnread: true` for all scheduler-created items (fail open) instead of failing the whole request
- [x] 3.5 Update `ConversationService` unit tests: unread-when-not-viewed, not-unread-when-viewed, omitted-for-non-scheduler, fail-open-on-viewed-ids-error

## 4. Generated API client

- [x] 4.1 Run `npm run openapi` to regenerate `@epam/chat-api-client` with the new `markConversationViewed` operation and the updated `ConversationListItemDto` (`isUnread`)
- [x] 4.2 Run `npm run openapi:check` and fix any drift
- [x] 4.3 Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`)

## 5. Frontend: server-api wrapper

- [x] 5.1 Add a `markConversationViewed(id)` wrapper to `apps/chat/src/server-api/conversations.api.ts` calling the generated `markConversationViewed` client method
- [x] 5.2 Confirm the existing `listConversations` wrapper's return type picks up the new `isUnread` field from the regenerated client (no wrapper change expected beyond typing)

## 6. Frontend: ConversationsContext mark-as-viewed action

- [x] 6.1 Add `markConversationViewed(id: string): Promise<void>` to `ConversationsContext.tsx`, following the `pinConversation` optimistic-update pattern (`:267`): synchronously set `isUnread: false` on the matching item in local `items` state, call the server-api wrapper, and on rejection restore `isUnread: true`
- [x] 6.2 Add the `isScheduledTask: false` local test-conversation stub's `isUnread` default (omitted) alongside the existing stub fields (`:349-351`), and add fixtures with `isScheduledTask: true, isUnread: true` for the new tests
- [x] 6.3 Write unit tests: optimistic clear on call, rollback on failure, no-op when item is not scheduler-created/not unread

## 7. Frontend: wire mark-as-viewed into conversation open

- [x] 7.1 Identify the existing "conversation selected/opened" handler(s) — history panel row click/middle-click and direct route navigation to a `.scheduler/...` conversation id
- [x] 7.2 Call `markConversationViewed(id)` from that single shared entry point when the opened item has `isScheduledTask: true && isUnread: true` (avoid duplicating the call at each entry point)
- [x] 7.3 Add/extend tests covering both entry points (row click and direct navigation) triggering the mark-viewed call exactly once

## 8. Lib: conversation-panel unread dot

- [x] 8.1 Add `isUnread?: boolean` to `ConversationHistoryItem` in `libs/conversation-panel/src/models/panel-props.ts`
- [x] 8.2 Add `conversationPanel.unreadIndicatorLabel` (`"Unread"`) to `apps/chat/src/i18n/locales/en.json` and the `ConversationPanelI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`
- [x] 8.3 In `libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx`, when `item.isUnread` is true, wrap the existing `avatar` element in a small relatively-positioned wrapper with an absolutely-positioned dot at the logical start edge (`start-0`), `aria-hidden` on the visible dot, plus an `sr-only` span carrying the accessible label; pass the wrapped element as `iconBefore` (mirrors the `taskBadge`/`iconAfter` composition at `:141-150`)
- [x] 8.4 Verify row layout: dot does not overlap the icon, title still truncates with ellipsis, and existing `showTaskBadge` end-padding logic is unaffected
- [x] 8.5 Write/extend `ConversationRow` unit tests: dot renders when `isUnread: true`, no dot when omitted/false, dot has no click handler (row's `onSelectConversation` still fires), accessible label present
- [x] 8.6 Verify RTL: dot stays at the visual start edge under `dir="rtl"` (manual check or RTL-specific test per `libs/conversation-panel`'s existing RTL test conventions)

## 9. Frontend: ConversationPanelView wiring

- [x] 9.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, extend the `ConversationItem[]` `useMemo` mapping (`:232-262`) to pass through `isUnread: item.isUnread` alongside the existing `showTaskBadge`/`taskBadgeLabel` spread
- [x] 9.2 Add/extend component tests verifying a scheduler-created+unread list item renders the dot end-to-end through `ConversationPanelView`

## 10. Verification

- [x] 10.1 `npm exec nx test chat-api` — backend unit tests pass
- [x] 10.2 `npm exec nx lint chat-api` — no lint errors
- [x] 10.3 `npm exec nx build chat-api` — builds cleanly
- [x] 10.4 `npm exec nx test chat` and `npm exec nx test conversation-panel` — frontend/lib unit tests pass
- [x] 10.5 `npm exec nx lint chat` and `npm exec nx lint conversation-panel` — no lint errors
- [x] 10.6 Manual check in the running app: open a scheduler-created conversation from the history panel, confirm the dot appears for unread task conversations and disappears immediately on open (and after refresh, since it's now bucket-persisted)
- [x] 10.7 Manual RTL check: switch to Arabic, confirm the dot sits at the correct visual edge and the badge/dot combination doesn't overlap the row's action trigger

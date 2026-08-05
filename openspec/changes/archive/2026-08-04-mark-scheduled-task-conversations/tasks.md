## 1. Backend: path parser

- [x] 1.1 Create `apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts` exporting the pure `parseScheduledTaskConversationPath` function per design.md (split segments, match `.scheduler`, decode with `safeDecodeURIComponent`, validate against `^[A-Za-z0-9_-]{1,128}$`, return `null` on any failure without throwing).
- [x] 1.2 Add unit tests in `apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.spec.ts` (co-located, matching this module's existing convention) covering: valid path, normal path, missing/empty segments, malformed ids (spaces, traversal `..`), URL-encoded ids.

## 2. Backend: DTO + service wiring

- [x] 2.1 Extend `ConversationListItemDto` (in `apps/chat-api/src/conversations/dto/`) with `isScheduledTask: boolean`, `scheduleId?: string`, `runId?: string`, with `@ApiProperty` Swagger metadata for each.
- [x] 2.2 In `ConversationService.listConversations`, call `parseScheduledTaskConversationPath(item.id)` for every mapped item (user bucket, public bucket, shared resources) and set `isScheduledTask`/`scheduleId`/`runId` accordingly (default `isScheduledTask: false`, ids omitted, when the parser returns `null`).
- [x] 2.3 Add/extend `ConversationService` unit tests for scheduler detection across all three item sources.
- [x] 2.4 Extend `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` with a fixture id `conversations/test-bucket/.scheduler/sched_abc/run_001/gpt-4o__Morning briefing` asserting the list response tags it correctly, alongside a normal conversation fixture asserting `isScheduledTask: false`.
- [x] 2.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 3. OpenAPI + generated client

- [x] 3.1 Update the `conversations-api` OpenAPI/Swagger spec delta so `ConversationListItemDto` includes the three new fields.
- [x] 3.2 Run `npm run openapi && npm run openapi:check`; confirm `@epam/chat-api-client`'s regenerated `ConversationListItemDto` includes the new fields.
- [x] 3.3 Build/lint the regenerated `chat-api-client` package; update `apps/chat/src/server-api/conversations.api.ts` only if the generated typings require explicit mapping (verified: `listConversations` is a thin pass-through, no change needed).

## 4. Frontend: data wiring (app edge)

- [x] 4.1 `ConversationsContext` passes the raw DTO through untouched (no re-mapping needed); fixed its one synthetic/optimistic list-item literal (duplicate placeholder) to include `isScheduledTask: false`. `useConversationListBridge`'s `OverlayConversation` mapping was deliberately **not** extended — `OverlayConversation` is the external overlay-embedding protocol type (`libs/chat-overlay`), out of this change's stated Impact scope; forwarding scheduler metadata there is a separate protocol decision, not required for the history-panel badge.
- [x] 4.2 In `ConversationPanelView`'s `ConversationItem` mapping, set `showTaskBadge: item.isScheduledTask` and `taskBadgeLabel: t(ConversationPanelI18nKeys.TaskBadgeLabel)`.
- [x] 4.3 Add `conversationPanel.taskBadgeLabel` (`"TASK"`) to `apps/chat/src/i18n/locales/en.json` and `ConversationPanelI18nKeys.TaskBadgeLabel` to `translation-keys.ts`.

## 5. Frontend: lib UI (`libs/conversation-panel`)

- [x] 5.1 Add `showTaskBadge?: boolean` and `taskBadgeLabel?: string` to the `ConversationItem` type (this lib's name for the history item shape — no separate `ConversationHistoryItem` type exists).
- [x] 5.2 Update `ConversationRow` to render the pill badge (clock icon `aria-hidden`, uppercase label) via the `Button`'s `iconAfter` slot when `showTaskBadge` is `true`, using logical spacing (`ms-1`) so it stays pinned to the trailing edge in RTL. Badge styling exposed as a new `taskBadgeClassName` prop (threaded through `ConversationPanelStyles` → `RowStyles` → `RowRenderer` → `ConversationRow`, mirroring the existing `itemIconBadgeClassName` pattern) per the libs no-hardcoded-typography/color rule.
- [x] 5.3 Row end-padding: no change to `getButtonPaddingEnd` was needed — the badge is rendered as a normal in-flow `iconAfter` element inside the button's own content (not an absolute overlay like the actions trigger), so it never competes for the same reserved space; the title's `min-w-0`/`Highlight` truncation absorbs the extra width.
- [x] 5.4 Extended `libs/conversation-panel/src/components/ConversationRow/tests/ConversationRow.spec.tsx` covering: badge shown when `showTaskBadge: true`, no badge when omitted/false, clock icon `aria-hidden`, badge click still triggers normal row selection (no separate handler).
- [x] 5.5 Run `npm exec nx test @epam/ai-dial-conversation-panel` and `npm exec nx lint @epam/ai-dial-conversation-panel`.

## 6. Verification

- [x] 6.1 Run `npm exec nx test chat-api`, `npm exec nx test chat`, `npm exec nx test @epam/ai-dial-conversation-panel`, plus `npm exec nx lint` for all three — all green.
- [ ] 6.2 Manual: seed/observe a conversation under `.scheduler/{scheduleId}/{runId}/...` and confirm the list API returns `isScheduledTask: true` with both ids. **Not performed** — requires a live DIAL Core + Scheduler-created conversation; covered by automated integration/unit tests instead.
- [ ] 6.3 Manual: confirm a normal conversation returns `isScheduledTask: false` with no ids. **Not performed manually** — covered by automated tests.
- [ ] 6.4 Manual: confirm the history panel row shows the TASK badge only for the scheduler conversation, in both LTR and RTL (`dir="rtl"`), and that the badge does not navigate on click. **Not performed** — requires running the app in a browser.
- [ ] 6.5 Manual: confirm the badge appears even when the `scheduledTasksEnabled` feature flag is disabled for the test user. **Not performed** — requires running the app in a browser.

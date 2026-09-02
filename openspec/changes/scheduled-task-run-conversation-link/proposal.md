## Why

DIAL Scheduler now returns `conversation_id` on each `GET .../schedules/{id}/runs` result, but the BFF drops it and the History panel treats every run as inert. Users cannot jump from a scheduled-task run to the conversation it produced, and unread scheduler-created chats (already tracked by `scheduled-task-unread-tracking`) have no visual signal inside the History panel where a user is most likely to check on a task's recent activity.

## What Changes

- Add optional `conversation_id` → `conversationId` mapping to `UpstreamScheduleRun` / `fromUpstreamRun` / `ScheduledTaskRunDto` in `apps/chat-api/src/scheduled-tasks/*`; regenerate OpenAPI + `@epam/ai-dial-chat-api-client`.
- Thread `conversationId` through `apps/chat/src/utils/map-scheduled-task-run-dto.ts` into `ScheduledTaskRunItem`.
- Add `isUnread?: boolean` to `ScheduledTaskRunItem`, resolved host-side by matching `conversationId` against `ConversationsContext` items via `conversationIdsMatch`.
- Make `ScheduledTaskRunHistoryList` rows conditionally interactive: clickable/keyboard-activatable only when a row has both a non-empty `conversationId` and `onRunClick` is supplied; otherwise the row stays static as today.
- Add the conversation-panel-style unread dot to `ScheduledTaskRunHistoryList` rows when `item.isUnread === true`, reusing the existing "Unread" i18n key (no new unread string, no new unread store).
- Wire `ScheduledTaskDetailPage`'s `onRunClick` to navigate via `getConversationRoute(conversationId)`. Marking the conversation viewed needs no separate call from the page — the app's always-mounted `useActiveConversationSync` (driven by the URL-derived active conversation id in `app.tsx`, consumed by `ConversationPanelView`) already marks the newly active conversation viewed on any navigation, including this one.
- Update `libs/scheduled-tasks/README.md` examples for the changed `ScheduledTaskRunItem`/`onRunClick` shape.

None of this is `**BREAKING**` — all new fields are additive/optional, and existing callers that don't pass `onRunClick` or don't have `conversationId` see unchanged (fully static) rows.

## Capabilities

### New Capabilities

(none — this change only extends requirements already covered by existing capabilities)

### Modified Capabilities

- `scheduled-tasks-api`: `ScheduledTaskRunDto` gains optional `conversationId`, mapped from upstream `conversation_id` (present/absent/null) in `fromUpstreamRun`.
- `scheduled-task-detail-page`: History rows become conditionally clickable (only when a `conversationId` is present) and show an unread dot sourced from existing conversation-list `isUnread` state; clicking navigates to the conversation and marks it viewed.

## Impact

- Backend: `apps/chat-api/src/scheduled-tasks/dto/scheduled-task-run.dto.ts`, `scheduled-tasks.mapper.ts`, `scheduled-tasks.mapper.spec.ts`, `scheduled-tasks.service.spec.ts`, generated OpenAPI spec + `libs/chat-api-client`.
- Lib: `libs/scheduled-tasks/src/models/scheduled-task-run-item.ts`, `scheduled-task-run-history-list-props.ts`, `ScheduledTaskRunHistoryList.tsx` (+ tests), `README.md`.
- App: `apps/chat/src/utils/map-scheduled-task-run-dto.ts`, `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` (+ tests), `apps/chat/src/i18n/locales/en.json` (reused key only, no new string expected).
- No new API endpoint, no new persistence, no new feature flag — depends on the already-existing `.client_data/.viewed-scheduled-task-conversations.json` unread mechanism from `scheduled-task-unread-tracking`.

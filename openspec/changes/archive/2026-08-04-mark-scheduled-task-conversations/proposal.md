## Why

DIAL Scheduler creates conversations under a reserved `.scheduler/{scheduleId}/{runId}/` path segment when a scheduled task fires. The history panel currently cannot distinguish these from normal chats, and the app has no access to `scheduleId`/`runId` for future linking or diagnostics. Users need a visual (TASK badge) cue to tell scheduler-created chats apart from ones they started themselves.

## What Changes

- Add a pure path-parsing utility in `apps/chat-api/src/conversations/utils/` that detects the `conversations/{bucket}/.scheduler/{scheduleId}/{runId}/...` pattern and extracts `scheduleId`/`runId`, validating both against the existing scheduled-tasks id allowlist (`^[A-Za-z0-9_-]{1,128}$`).
- Extend `ConversationListItemDto` with additive optional fields: `isScheduledTask: boolean`, `scheduleId?: string`, `runId?: string`. Populate them in `ConversationService.listConversations` for every mapped list item (user bucket, public bucket, shared resources).
- Regenerate OpenAPI + `@epam/chat-api-client` so the new fields flow through the generated `ConversationListItemDto` automatically.
- Wire the new fields from `ConversationsContext` through the overlay/list bridge into `ConversationPanelView`'s `ConversationItem` mapping (app edge only — no API knowledge enters `libs/conversation-panel`).
- Extend `libs/conversation-panel`'s `ConversationHistoryItem`/`ConversationRow` with optional `showTaskBadge`/`taskBadgeLabel` presentational props and render a compact "TASK" pill badge at the end of the row when set.
- Add `conversationPanel.taskBadgeLabel` ("TASK") to `en.json` / `ConversationPanelI18nKeys`.
- Badge is informational only in this iteration — no click-through to `/scheduled-tasks` or run details, and it is shown independent of the `scheduledTasksEnabled` nav feature flag.

## Capabilities

### New Capabilities

(none — this extends two existing capabilities)

### Modified Capabilities

- `conversations-api`: `GET /api/v1/conversations/list` response (`ConversationListItemDto`) gains `isScheduledTask`/`scheduleId`/`runId`, derived by parsing the resource path against the `.scheduler` reserved-segment rule.
- `conversation-history-panel`: conversation rows gain an optional TASK badge shown when the underlying conversation is scheduler-created.

## Impact

- **Backend**: `apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts` (new), `apps/chat-api/src/conversations/conversation.service.ts` (populate new fields), `apps/chat-api/src/conversations/dto/*` (extend `ConversationListItemDto`), OpenAPI spec + regenerated `libs/chat-api-client`.
- **Frontend**: `apps/chat/src/context/ConversationsContext` (or wherever list items are bridged), `apps/chat/src/components/.../ConversationPanelView` mapping, `apps/chat/src/i18n/locales/en.json`.
- **Lib**: `libs/conversation-panel` — `ConversationHistoryItem` type, `ConversationRow` component, i18n keys type.
- **Out of scope**: mutating conversation paths, blocking/hiding scheduler conversations, new REST endpoints, a dedicated "Tasks" filter tab, badge → detail-page navigation, and exposing the metadata on the single-conversation `getConversation` response.

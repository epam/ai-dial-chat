## Why

Scheduled tasks create new conversations under `.scheduler/{scheduleId}/{runId}/` outside of any direct user action. Users currently have no way to tell, at a glance in the history panel, which task runs they have already looked at versus new ones that appeared since their last visit. This is a per-conversation "opened" state, not a user preference, and must survive refresh and sync across sessions/devices — so it needs to live in the user's DIAL Core bucket, not local-only state.

## What Changes

- Add a new bucket-persisted file, `.client_data/.viewed-scheduled-task-conversations.json`, tracking the full DIAL Core conversation resource ids the user has opened. This is a dedicated file, separate from `.client_data/.user-config.json`, with its own read-modify-write lifecycle (mirrors the existing `user-config` bucket-file pattern).
- Add a backend endpoint to mark a conversation id as viewed/opened (called when the user opens a scheduler-created conversation).
- Extend the `GET /api/v1/conversations/list` response (`ConversationListItemDto`) with an `isUnread` boolean: `true` only for conversations identified as scheduler-created (via the existing `parseScheduledTaskConversationPath` helper) whose id is absent from the viewed-ids file; `false`/omitted for all other conversations.
- Extend the frontend `ConversationItem` model and history panel row rendering to show a small unread dot before the row's leading icon when `isUnread` is true.
- Mark a conversation as viewed (call the new endpoint, optimistically clear the dot) when the user opens a scheduler-created conversation from the history panel or via direct navigation.

## Capabilities

### New Capabilities

- `scheduled-task-unread-tracking`: Bucket-persisted storage of which scheduler-created conversation ids the user has opened, plus the backend endpoint to record a conversation as viewed, and the derivation of `isUnread` per conversation for API consumers.

### Modified Capabilities

- `conversations-api`: `GET /api/v1/conversations/list` response items gain an `isUnread` field, computed against the new viewed-ids store for scheduler-created conversations.
- `conversation-history-panel`: The conversation row renders an unread dot before its leading icon when the item's `isUnread` is true, and clears it (via the new mark-viewed call) when the user opens the conversation.

## Impact

- **Backend**: New `apps/chat-api/src/scheduled-task-unread/` domain (service + controller + DTOs), following the `user-config` domain's bucket read/write pattern (`DialClientService.client.downloadFile`/`uploadFile`, `getBearerAuthHeaders`, `handleDialSdkError`). Modifies `apps/chat-api/src/conversations/conversation.service.ts` (`listConversations`) and `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`.
- **Frontend**: Modifies `apps/chat/src/context/ConversationsContext.tsx` (mark-as-viewed action + optimistic local update), `apps/chat/src/server-api/` (new API client call), `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (DTO → `ConversationItem` mapping), and `libs/conversation-panel/src/` (`ConversationItem` model, `ConversationRow` rendering).
- **No breaking changes** — `isUnread` is an additive, optional field; conversations that are not scheduler-created are unaffected.

## Why

The conversation panel has "My chats", "Shared", and "Organization" filter tabs, but all three always show empty because the backend strips `sharedWithMe` and `publishedWithMe` flags that DIAL Core already returns. Users cannot filter conversations by source.

## What Changes

- Extend the DIAL Core response type cast in `conversation.service.ts` to preserve `sharedWithMe` and `publishedWithMe` per-item flags
- Add `sharedWithMe` and `publishedWithMe` boolean fields to `ConversationListItemDto`
- Regenerate `libs/chat-api-client` from the updated OpenAPI/Swagger spec
- Map the two flags to `ConversationSource` in `ConversationPanelView` so that each item is assigned to the correct tab

## Capabilities

### New Capabilities

- `conversation-source-filtering`: Expose per-conversation ownership flags (`sharedWithMe`, `publishedWithMe`) from the backend listing endpoint and wire them through the frontend adapter so that the conversation panel's My chats / Shared / Organization tabs correctly filter the conversation list.

### Modified Capabilities

<!-- None — no existing specs are changing requirements -->

## Impact

- **Backend**: `apps/chat-api/src/conversations/conversation.service.ts` (type cast + mapping), `apps/chat-api/src/conversations/dto/conversation-list.dto.ts` (two new fields)
- **Generated client**: `libs/chat-api-client` — must be regenerated after DTO change
- **Frontend adapter**: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`
- **No lib changes**: `libs/conversation-panel` model and filter logic are already correct; only the app-level adapter is updated
- **No breaking changes**: new fields are additive; existing consumers that don't read them are unaffected

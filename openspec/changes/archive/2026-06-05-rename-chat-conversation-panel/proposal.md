## Why

Users have no way to rename a conversation from the conversation panel — only pin and delete are available. Renaming is a fundamental organization action that lets users give meaningful titles to conversations without having to delete and recreate them.

## What Changes

- Add a `PATCH /api/v1/conversations` backend endpoint that renames a conversation by moving it to a new DIAL Core resource URL with the updated title embedded in the filename.
- Add a `RenameChat` popup component in the frontend that renders a `DialPopup` with a text input, Cancel, and Save buttons.
- Add a **Rename** action to the conversation panel action menu alongside Pin and Delete.
- Add a `renameConversation` operation to `ConversationsContext` and to the `apps/chat/src/server-api/conversations.api.ts` wrapper.
- Add i18n keys for all new strings.

## Capabilities

### New Capabilities

- `conversation-rename`: Backend PATCH endpoint to rename a conversation; frontend popup dialog with text input, optimistic title update, and error handling.

### Modified Capabilities

- `conversations-api`: New `PATCH /api/v1/conversations` endpoint added to the existing controller.

## Impact

- **Backend**: New `PATCH` handler in `apps/chat-api/src/conversations/conversation.controller.ts`; new `RenameConversationDto`; new `renameConversation` method in `ConversationService` using SDK `moveResource`.
- **Frontend**: New `RenameConversationPopup` component; updated `ConversationPanelView` with rename action and popup; updated `ConversationsContext` with `renameConversation`; updated `server-api/conversations.api.ts`; new i18n keys in `en.json`.
- **Generated client**: OpenAPI regeneration needed after backend endpoint is added.
- **Tests**: Integration tests for the new PATCH handler; unit tests for the rename popup component.

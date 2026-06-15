## Why

The `bulk-conversation-deletion` change adds `POST /api/v1/conversation-deletions/all` to the backend and exports a `deleteAllConversations()` server-api wrapper in `apps/chat/src/server-api/conversations.api.ts`. Users have no UI entry point to invoke this capability.

Without a panel-level "Delete all conversations" action, users with large conversation histories must delete items one by one from the per-item overflow menu — a slow, repetitive workflow. A single destructive action in the panel header closes this gap.

## What Changes

- **`libs/conversation-panel`** — `ConversationPanelProps` gains an optional `headerActions?: ReactNode` prop. `ConversationPanel` passes it to the `rightActions` slot of `SidebarPanel` (from `@epam/ai-dial-sidebar`) so any app-defined header control can be injected without coupling the library to specific business logic. The library remains host-agnostic: it does not know about "Delete all conversations", the API, routing, or i18n.

- **`apps/chat/src/context/ConversationsContext.tsx`** — `ConversationsContextType` gains `deleteAllConversations(): Promise<ConversationDeletionResultDto>`. The implementation calls the existing server-api wrapper, clears local state on complete success, and calls `refreshConversations()` on partial failure so the panel reflects the actual remaining conversations.

- **`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`** — renders a `DialDropdown` anchored to a `DialIconButton` (`IconDotsVertical`) and passes it as `headerActions` to `ConversationPanel`. Selecting "Delete all conversations" opens a `DialConfirmationPopup` (danger variant). Only confirmation calls the context method. Complete failure shows an inline error inside the popup (keeping it open); partial failure closes the popup and shows a `DialNotification`.

- **i18n** — 7 new keys added to `ConversationPanelI18nKeys` and `apps/chat/src/i18n/locales/en.json`.

## Non-Goals

- No multi-select or per-conversation checkbox UI. Selecting individual conversations for bulk deletion is a separate feature.
- The library does not hardcode "Delete all conversations". The `headerActions` slot is intentionally generic so future actions can be added without changing the lib's public API.
- No changes to the backend contract. `POST /api/v1/conversation-deletions/all` is unchanged.
- No new global notification system. The existing `DialNotification` pattern (already used for duplicate errors in `ConversationPanelView`) is reused.
- No new React Context or provider. `deleteAllConversations` is added to the existing `ConversationsContext`.

## Capabilities

### New Capabilities

- `clear-all-conversations-ui`: Users can delete every conversation in one action from the conversation panel header, with a confirmation step and accessible error feedback.

## Dependencies

- **`bulk-conversation-deletion`** change must be merged and the OpenAPI client regenerated before this change can be implemented. `apps/chat/src/server-api/conversations.api.ts` must already export the `deleteAllConversations()` wrapper and `ConversationDeletionResultDto` must be available from `@epam/chat-api-client`.

## Impact

- `libs/conversation-panel/src/models/ConversationPanel.ts` — `ConversationPanelProps` gains `headerActions?: ReactNode`.
- `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx` — forwards `headerActions` to `SidebarPanel.rightActions`.
- `apps/chat/src/context/ConversationsContext.tsx` — adds `deleteAllConversations` method to context type and provider.
- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` — adds overflow trigger, dropdown items, confirmation popup, and error notification for delete-all.
- `apps/chat/src/constants/translation-keys.ts` — 7 new enum members on `ConversationPanelI18nKeys`.
- `apps/chat/src/i18n/locales/en.json` — 7 new strings under `conversationPanel`.
- No changes to `apps/chat-api`, `libs/chat-api-client`, or `apps/chat/src/server-api/`.

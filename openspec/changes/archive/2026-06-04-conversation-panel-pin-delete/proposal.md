## Why

Users have no way to organise or remove conversations from the panel. Adding per-item **Pin** and **Delete** actions directly on conversation rows lets users surface important chats to a dedicated Pinned section and permanently remove conversations they no longer need. Pin state is persisted server-side so it survives page reloads and is consistent across browser sessions.

## What Changes

- **Hover action trigger on conversation rows** — each row gains an `IconDotsVertical` trigger button (`DialIconButton`) that appears on hover and opens a `DialDropdown` menu. The app supplies menu items via a `getActions(item) => DropdownItem[]` callback, making the lib action-agnostic and ready for future additions. When no callback is provided, no trigger is rendered.
- **`ConversationRow` extracted** to its own file — owns `isMenuOpen` state so the trigger stays visible while the dropdown is open.
- **New `PATCH /api/v1/conversations/pin` endpoint** — accepts `{ path: string, isPinned: boolean }` where `path` is the full DIAL Core resource URL. Reads `conversation-pins.json` from the user's DIAL Core appdata bucket (falling back to the conversations bucket) via the Files API, updates the `pinnedIds` set, and writes it back using a FormData body so openapi-fetch generates a valid `multipart/form-data; boundary=…` header.
- **`isPinned` in `ConversationListItemDto`** — `GET /api/v1/conversations/list` reads the pins file in parallel with the DIAL Core metadata call and sets `isPinned: true` on matching items.
- **Delete wired to existing endpoint** — `DELETE /api/v1/conversations` is called after a danger-variant `DialConfirmationPopup` confirmation. On success the item is removed optimistically from the context list; if the deleted conversation is active, the app navigates to `ROUTES.ROOT` before the API call.
- **Delete also cleans up pins** — `deleteConversation` in the service fires a fire-and-forget `pinConversation(id, false, ...)` call to remove the deleted id from the pins file.
- **`ConversationsContext` mutations** — `pinConversation(id, isPinned)` is `async`: applies an optimistic local update, awaits the API call, and **reverts the update on failure** (so pin state never silently desynchronises from the server); `deleteConversation(id)` applies an optimistic removal and calls the API; `refreshConversations()` re-fetches the list and is called automatically when `activeConversationId` changes to an id not in the current list (handles newly created conversations).

## Capabilities

### New Capabilities

- `conversation-pin`: Pin or unpin a conversation from the panel dropdown. Pinned conversations appear in the "Pinned" collapsible section. Pin state persisted server-side in `conversation-pins.json` in the user's DIAL Core appdata bucket (or conversation bucket if appdata is unavailable) and merged into every `listConversations` response.
- `conversation-delete-from-panel`: Delete a conversation via the panel dropdown. A `DialConfirmationPopup` (danger variant) confirms before deletion. The deleted conversation's id is also removed from the pins file. Navigation to new chat fires immediately when deleting the active conversation.

### Modified Capabilities

- `conversation-panel`: Conversation rows show a dots trigger button on hover that opens a dropdown menu. The lib accepts a `getActions(item) => DropdownItem[]` callback instead of individual action props — any number of actions can be added by the consuming app without lib changes.
- `conversations-api`: `GET /api/v1/conversations/list` items now include `isPinned: boolean`. New `PATCH /api/v1/conversations/pin` endpoint added.

## Impact

- **`libs/conversation-panel`**: `ConversationPanelProps` and `ConversationGroupProps` replace individual action props with `getActions?: (item: ConversationHistoryItem) => DropdownItem[]` and `actionsLabel?: string`. New `ConversationRow` component in `ConversationGroup/ConversationRow.tsx`. Trigger button styled via `--cp-trigger-bg` / `--cp-trigger-icon` CSS vars.
- **`apps/chat-api`**: new `PinConversationDto`; `ConversationListItemDto` gains `isPinned`; `ConversationService` gains private `getPinnedIds`, `savePinnedIds`, and public `pinConversation`; `listConversations` updated to merge pins; `deleteConversation` cleans up pins; `ConversationController` gains `PATCH /pin`; `SessionPayload` and `SessionUser` gain `appdata: string` (resolved alongside `bucket` in `SessionGuard`); `pinConversation`, `listConversations`, and `deleteConversation` accept `appdata` and use `appdata || bucket` as the preference storage bucket.
- **`libs/chat-api-client`**: must be regenerated (`npm run openapi:sdk`) to include `patchConversationPin` and updated `ConversationListItemDto`.
- **`apps/chat`**: `conversations.api.ts` gains `pinConversation` wrapper; `ConversationsContext` gains `pinConversation`, `deleteConversation`, and `refreshConversations`; `ConversationPanelView` builds `getActions` and renders `DialConfirmationPopup`; new i18n keys for all action labels and delete confirmation.
- **No breaking changes** — `getActions` is optional; existing `ConversationPanel` consumers are unaffected. `isPinned` defaults to `false` on the list response until the client is regenerated.

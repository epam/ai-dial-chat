## Why

Users have no way to revisit or switch between past conversations — every session starts fresh from the root route. A collapsible left-side panel listing conversation history gives users quick access to prior work and matches the pattern established by the existing `SidebarPanel` and `Navigation` components.

## What Changes

- **New `libs/conversation-history` library** — exports a `ConversationHistoryPanel` component: a collapsible sidebar panel with a header containing a toggle icon and a scrollable conversation list body. The lib is host-agnostic; the app supplies conversation data and callbacks.
- **New `GET /api/v1/conversations` endpoint** in `apps/chat-api` — returns a paginated list of conversation metadata (id, title, updatedAt) for the authenticated user.
- **New conversations list API wrapper** in `apps/chat/src/server-api/` — thin wrapper around the generated client for the new list endpoint.
- **New `ConversationsContext`** in `apps/chat/src/context/` — fetches and holds the conversation list; exposes it to the layout.
- **Layout integration** in `apps/chat/src/app/app.tsx` — renders `ConversationHistoryPanel` between `Navigation` and `<main>` on desktop; on mobile it renders as a drawer overlay. Panel open/closed state lives in `app.tsx`; the `Header` receives a toggle callback.

## Capabilities

### New Capabilities

- `conversation-history-panel`: Collapsible left sidebar listing past conversations — "Chats" header with expand/collapse toggle, **New chat** button, **search input**, **filter tabs** (All / My chats / Shared / Organization), grouped sections (Pinned + My chats), conversation rows with icon and title; responsive (desktop persistent panel, mobile drawer overlay).
- `conversation-search`: Controlled text input inside the panel that filters the visible conversation list client-side by title match.
- `new-chat-button`: Prominent button at the top of the panel that calls `onNewChat` to create a new conversation.
- `conversation-filter-tabs`: Segmented tab control (All / My chats / Shared / Organization) that switches which subset of conversations is shown.
- `conversation-groups`: Conversation list rendered in collapsible named sections — **Pinned** (conversations flagged `isPinned: true`) and **My chats** (the rest) — each section can be toggled open/closed independently.

### Modified Capabilities

- `conversations-api`: New `GET /api/v1/conversations` list endpoint returning paginated `ConversationMetadataDto[]`; response items gain optional `isPinned` and `source` fields to support grouping and filter tabs.

## Impact

- **`libs/conversation-history`**: new library — `ConversationHistoryPanel`, `ConversationHistoryItem` (gains `isPinned`, `source`), `ConversationHistoryPanelProps` / `ConversationHistoryColors` model types; new internal `SearchInput`, `FilterTabs`, `ConversationGroup` sub-components.
- **`apps/chat-api`**: `src/conversations/` — new list handler, DTO (gains `isPinned`, `source`), service method.
- **`apps/chat`**: `server-api/conversations.api.ts` (new `listConversations`), new `ConversationsContext`, `app.tsx` layout change, `Header` toggle button; new i18n keys for search placeholder, filter tab labels, group headings, and new-chat button.
- **No breaking changes** — new endpoint and new component; existing routes and data shapes unchanged.

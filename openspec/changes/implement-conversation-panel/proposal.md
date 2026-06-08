## Why

Users have no way to revisit or switch between past conversations — every session starts fresh from the root route. A collapsible left-side panel listing conversation history gives users quick access to prior work and matches the pattern established by the existing `SidebarPanel` and `Navigation` components.

## What Changes

- **New `libs/conversation-panel` library** — exports a `ConversationPanel` component: a collapsible sidebar panel with a header, a scrollable conversation list body, search input, filter tabs, and grouped collapsible sections. The lib is host-agnostic; the app supplies conversation data and callbacks.
- **New `GET /api/v1/conversations/list` endpoint** in `apps/chat-api` — returns a cursor-paginated list of conversation metadata (id, title, updatedAt) for the authenticated user, backed by DIAL Core metadata.
- **New conversations list API wrapper** in `apps/chat/src/server-api/conversations.api.ts` — thin wrapper around the generated `@epam/chat-api-client` `listConversations` method.
- **New `ConversationsContext`** in `apps/chat/src/context/ConversationsContext.tsx` — fetches and holds the conversation list; exposes it to `ConversationPanelView`.
- **New `ConversationPanelView`** in `apps/chat/src/components/ConversationPanel/` — app-level adapter that wires `ConversationsContext`, i18n, and routing callbacks into `ConversationPanel`.
- **Layout integration** in `apps/chat/src/app/app.tsx` — renders `ConversationPanelView` on the left. Panel open/closed state lives in `app.tsx` (persisted to `localStorage`); the `Header` receives a toggle callback.
- **Toggle button in `Header.tsx`** — on **desktop**: history panel toggle icon (`SideBarLeft`/`SideBarRight`, `hidden desktop:flex`). On **mobile**: a separate `IconLayoutSidebarRight` open button (`desktop:hidden`) visible only when the panel is closed; when open, an `IconX` button inside the panel header closes it.

## Capabilities

### New Capabilities

- `conversation-panel`: Collapsible left sidebar listing past conversations — panel title, **New chat** button, **search input**, **filter tabs** (All / My chats / Shared / Organization), grouped collapsible sections (Pinned + My chats), conversation rows with optional icon and title; responsive (desktop: persistent 320px panel; mobile: full-width drawer overlay, closed by default, open via `IconLayoutSidebarRight` in header, close via `IconX` inside panel header).
- `conversation-search`: Controlled text input inside the panel that filters the visible conversation list client-side by title match (state owned inside `ConversationPanel`).
- `new-chat-button`: Prominent button at the top of the panel that calls `onNewChat` prop.
- `conversation-filter-tabs`: Segmented tab control (All / My chats / Shared / Organization) using `FilterTab` string enum; state owned inside `ConversationPanel`.
- `conversation-groups`: Conversation list rendered in two collapsible named sections — **Pinned** (`isPinned: true`) and **My chats** (the rest) — each section can be toggled open/closed independently; state inside `ConversationPanel`.

### Modified Capabilities

- `conversations-api`: New `GET /api/v1/conversations/list` endpoint with cursor-based pagination (`nextToken`) and optional `path` scope parameter. Response shape: `ConversationListResponseDto { items: ConversationListItemDto[], nextToken? }`.

## Impact

- **`libs/conversation-panel`**: new library — `ConversationPanel`, `ConversationPanelProps`, `ConversationPanelStyles`, `ConversationHistoryColors`, `ConversationHistoryTypography`, `ConversationHistoryItem`, `ConversationSource` enum, `FilterTab` enum, `FilterLabels`, `ConversationGroupProps`.
- **`apps/chat-api`**: `src/conversations/` — new `GET /api/v1/conversations/list` handler, `ListConversationsQueryDto`, `ConversationListResponseDto`, `ConversationListItemDto`, service `listConversations` method.
- **`libs/chat-api-client`**: regenerated with `listConversations` operation.
- **`apps/chat`**: `server-api/conversations.api.ts` (new `listConversations` wrapper), new `ConversationsContext` and `ConversationsProvider`, new `ConversationPanelView` component, `app.tsx` layout change, `Header.tsx` toggle button; i18n keys for all panel strings.
- **No breaking changes** — new endpoint and new component; existing routes and data shapes unchanged.

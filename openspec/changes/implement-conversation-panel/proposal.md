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

- `conversation-history-panel`: Collapsible left sidebar listing past conversations — expand/collapse toggle in the header, conversation rows with title and date, responsive (desktop persistent panel, mobile drawer overlay).

### Modified Capabilities

- `conversations-api`: New `GET /api/v1/conversations` list endpoint returning paginated `ConversationMetadataDto[]`.

## Impact

- **`libs/conversation-history`**: new library — `ConversationHistoryPanel`, `ConversationHistoryItem`, `ConversationHistoryPanelProps` / `ConversationHistoryColors` model types.
- **`apps/chat-api`**: `src/conversations/` — new list handler, DTO, service method.
- **`apps/chat`**: `server-api/conversations.api.ts` (new `listConversations`), new `ConversationsContext`, `app.tsx` layout change, `Header` toggle button.
- **No breaking changes** — new endpoint and new component; existing routes and data shapes unchanged.

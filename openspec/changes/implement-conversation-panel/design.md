## Context

The app currently has a `Navigation` icon bar on the left (`libs/sidebar` → `SidebarPanel`, used for right-side source panel too) and a `ConversationSourcesPanelView` on the right. There is no panel listing past conversations. The `ConversationsApi` generated client exposes `getConversation`, `saveConversation`, and `deleteConversation` but no list endpoint. The `SidebarPanel` base component already provides a fixed-width `<aside>` with a 48px header bar and a scrollable body — the new panel can reuse it or replicate its pattern inside the lib.

## Goals / Non-Goals

**Goals:**
- A left-side `ConversationHistoryPanel` component in a new `libs/conversation-history` lib.
- Header contains: panel title and a collapse/expand icon button (chevron or sidebar icon).
- On desktop: persistent panel, 280px wide, pushes `<main>` content.
- On mobile: full-height drawer overlay, triggered from the `Header` hamburger/menu button.
- Conversation rows show title and relative/absolute date; clicking navigates to the conversation.
- New backend list endpoint `GET /api/v1/conversations` returns paginated metadata.
- Responsive: uses `useIsMobile` / `useBreakpoint` from `apps/chat/src/hooks/breakpoint/`.

**Non-Goals:**
- No conversation search or filtering in this slice.
- No conversation rename or delete from the panel.
- No infinite scroll — first page (20 items) only in this change.
- No persistence of panel open/closed preference across sessions.

## Decisions

### 1. New lib (`libs/conversation-history`) vs extending `libs/sidebar`

`SidebarPanel` is a generic panel shell. The conversation-history panel has domain-specific content (conversation rows, date formatting, navigation). Mixing domain content into a generic lib violates lib isolation. A dedicated `libs/conversation-history` lib keeps domain knowledge co-located and keeps `libs/sidebar` generic.

**Decision:** New `libs/conversation-history` lib. It may use `SidebarPanel` from `libs/sidebar` as its structural shell, or replicate the pattern if the dependency is not desirable.

### 2. Collapse/expand — `isOpen` in app vs inside lib

The panel's visibility state must be shared between the `Header` (toggle button) and the panel itself. Both live in `apps/chat`. The lib receives `isOpen` and `onToggle` as props — it owns no open/closed state itself. This keeps the lib stateless w.r.t. visibility and lets the app control layout (add/remove panel from DOM or CSS-hide it).

**Decision:** `isOpen: boolean` and `onToggle: () => void` as required props. On desktop the panel uses CSS (`hidden` / `flex`) to show/hide without unmounting. On mobile the app conditionally renders the drawer overlay.

### 3. Toggle icon placement — inside `ConversationHistoryPanel` header vs `Header` component

Two options:
- **A.** Toggle icon in the panel's own header (visible only when panel is open).
- **B.** Toggle icon always in the app `Header` bar (visible regardless of panel state).

**Decision: A** — the toggle icon lives in the `ConversationHistoryPanel` header. When the panel is collapsed on desktop, the icon button is the only visible element (narrow strip or the header collapses to icon-only width). On mobile, the `Header` already has the hamburger for the Navigation drawer; a separate tap target in the panel header avoids crowding the top bar.

### 4. Panel width and collapse behaviour on desktop

- **Expanded:** 280px, `flex-shrink-0`, pushes `<main>` via flex row layout.
- **Collapsed:** 0px wide (panel hidden with `w-0 overflow-hidden`) OR icon-only strip (48px). Icon-only strip is friendlier UX but more complex.

**Decision:** Start with full hide (`w-0 overflow-hidden` with CSS transition) for simplicity. Icon-only strip can be added as a follow-up.

### 5. Backend list endpoint — `GET /api/v1/conversations`

The `ConversationsApi` client has no list operation. Options:
- **A.** Add the endpoint to `apps/chat-api`, regenerate the client.
- **B.** Call a DIAL Core listing API from the backend and proxy it.

**Decision: A** — add a NestJS endpoint that returns persisted conversations from the in-memory store (current persistence layer). This stays consistent with the existing `createConversation` / `getConversation` pattern. A real DB layer is a follow-up.

Response shape: `ConversationMetadataDto[]` with `{ id, title, updatedAt }`. Paginated via `?limit` and `?offset` query params; default limit 20.

### 6. Data fetching — context vs hook

Conversation list is needed in the layout (`app.tsx`), not deep in a route. A `ConversationsContext` (matching the `DeploymentsContext` pattern) fetches on mount and re-fetches after `createConversation` / `saveConversation` mutations.

**Decision:** `ConversationsContext` in `apps/chat/src/context/ConversationsContext.tsx`, consumed by `app.tsx` and by `ConversationHistoryPanel` via a passed prop.

## Risks / Trade-offs

- **[Risk] No list endpoint yet — in-memory store returns all conversations** → Mitigation: cap at 20 with pagination params from day one so the UI won't need changes when a DB layer is added.
- **[Risk] Mobile drawer and Navigation drawer both use overlay** → Mitigation: they are mutually exclusive (conversation panel on conversation routes only); `app.tsx` closes one before opening the other.
- **[Trade-off] `libs/conversation-history` uses `libs/sidebar` as a dep** — adds a cross-lib dependency. Acceptable since `libs/sidebar` is a stable, generic panel shell with no app-specific knowledge.
- **[Trade-off] Panel hidden via CSS rather than unmounted** — keeps scroll position on re-open but keeps the list mounted even when hidden. Acceptable for 20 items.

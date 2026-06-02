## Context

The app currently has a `Navigation` icon bar on the left (`libs/sidebar` → `SidebarPanel`, used for right-side source panel too) and a `ConversationSourcesPanelView` on the right. There is no panel listing past conversations. The `ConversationsApi` generated client exposes `getConversation`, `saveConversation`, and `deleteConversation` but no list endpoint. The `SidebarPanel` base component already provides a fixed-width `<aside>` with a 48px header bar and a scrollable body — the new panel can reuse it or replicate its pattern inside the lib.

## Goals / Non-Goals

**Goals:**
- A left-side `ConversationHistoryPanel` component in a new `libs/conversation-history` lib.
- Header contains: "Chats" panel title and a collapse/expand icon button.
- **New chat button** — full-width button below the header to start a new conversation.
- **Search input** — "Search chat…" text field that filters the visible list by title client-side.
- **Filter tabs** — segmented control: All / My chats / Shared / Organization.
- **Grouped sections** — Pinned (conversations with `isPinned: true`) and My chats; each section is collapsible with a chevron.
- Conversation rows show an icon and title; clicking navigates to the conversation.
- On desktop: persistent panel, 280px wide, pushes `<main>` content.
- On mobile: full-height drawer overlay, triggered from the `Header` hamburger/menu button.
- New backend list endpoint `GET /api/v1/conversations` returns paginated metadata (gains `isPinned`, `source`).
- Responsive: uses `useIsMobile` / `useBreakpoint` from `apps/chat/src/hooks/breakpoint/`.

**Non-Goals:**
- No conversation rename or delete from the panel.
- No infinite scroll — first page (20 items) only in this change.
- No server-side search — filtering is client-side over the loaded page.
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

Response shape: `ConversationMetadataDto[]` with `{ id, title, updatedAt, isPinned?, source? }`. Paginated via `?limit` and `?offset` query params; default limit 20.

### 6. Data fetching — context vs hook

Conversation list is needed in the layout (`app.tsx`), not deep in a route. A `ConversationsContext` (matching the `DeploymentsContext` pattern) fetches on mount and re-fetches after `createConversation` / `saveConversation` mutations.

**Decision:** `ConversationsContext` in `apps/chat/src/context/ConversationsContext.tsx`, consumed by `app.tsx` and by `ConversationHistoryPanel` via a passed prop.

### 7. New chat button — lib prop vs app-level button

The "New chat" button triggers navigation/mutation (app-owned). Options:
- **A.** Button rendered by `ConversationHistoryPanel`, fires `onNewChat` prop — lib stays declarative.
- **B.** Button rendered by the app above the panel.

**Decision: A** — `onNewChat: () => void` required prop. The lib renders the button with the correct styling; the app wires the handler. This keeps the full panel visual self-contained in one component.

### 8. Search — client-side vs server-side

The initial load cap is 20 items. Options:
- **A.** Filter locally in the component over the loaded items (simple, zero latency).
- **B.** Debounce and re-fetch with a `?search=` query param.

**Decision: A** — local filter for this slice. Search state is `useState<string>` inside the lib; no prop needed. Server-side search can be added later when pagination beyond 20 is introduced.

### 9. Filter tabs — lib-managed vs app-managed state

The active tab controls which subset of items is displayed:
- **A.** Tab state lives inside the lib; `ConversationHistoryPanel` receives all items and filters internally.
- **B.** Tab state lives in the app; the app passes pre-filtered items and the active tab as a prop.

**Decision: A** — tab state (`useState<FilterTab>`) inside the lib. The app passes the full list; the component applies the active-tab filter itself. This minimises the surface area of props and keeps filtering co-located with the UI. The lib does NOT know about REST endpoints — it receives `source` values as plain strings.

`FilterTab = 'all' | 'my-chats' | 'shared' | 'organization'`. An item matches a tab when `item.source === tab` (or tab is `'all'`).

### 10. Grouped sections — Pinned + My chats

Pinned items are those with `isPinned: true`; the rest go into "My chats". Each group is rendered as a collapsible `<section>` with a disclosure button. Collapse state for each group is `useState<boolean>` inside the lib (default: expanded). Groups with zero matching items after search+tab filter are hidden.

**Decision:** Group collapse state lives inside the lib. No prop needed — groups always start expanded.

## Risks / Trade-offs

- **[Risk] No list endpoint yet — in-memory store returns all conversations** → Mitigation: cap at 20 with pagination params from day one so the UI won't need changes when a DB layer is added.
- **[Risk] Mobile drawer and Navigation drawer both use overlay** → Mitigation: they are mutually exclusive (conversation panel on conversation routes only); `app.tsx` closes one before opening the other.
- **[Trade-off] `libs/conversation-history` uses `libs/sidebar` as a dep** — adds a cross-lib dependency. Acceptable since `libs/sidebar` is a stable, generic panel shell with no app-specific knowledge.
- **[Trade-off] Panel hidden via CSS rather than unmounted** — keeps scroll position on re-open but keeps the list mounted even when hidden. Acceptable for 20 items.
- **[Trade-off] Client-side search over 20 items** — fast but stale after the initial load. Acceptable for this slice; server-side search is a follow-up when pagination grows.
- **[Trade-off] Tab and group-collapse state is internal to the lib** — state is reset when the panel unmounts on mobile. Acceptable since the panel stays mounted on desktop (CSS hide).
